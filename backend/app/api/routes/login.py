import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm

from app import crud
from app.api.deps import CurrentAccount, SessionDep, get_current_active_admin
from app.core import security
from app.core.config import settings
from app.core.password_reset_rate_limit import allow as rate_limit_allow
from app.models import AccountPublic, AccountUpdate, Message, NewPassword, Token
from app.utils import (
    generate_password_reset_token,
    generate_reset_password_email,
    send_email,
    verify_password_reset_token,
)

logger = logging.getLogger(__name__)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"

router = APIRouter(tags=["login"])


@router.post("/login/access-token")
def login_access_token(
    session: SessionDep, form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> Token:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    user = crud.authenticate(
        session=session, email=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(status_code=400, detail="Email hoặc mật khẩu không chính xác")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Tài khoản không hoạt động")
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    user.last_login_at = datetime.now(timezone.utc)
    session.add(user)
    session.commit()
    session.refresh(user)
    return Token(
        access_token=security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        user=AccountPublic.model_validate(user),
    )


@router.post("/login/test-token", response_model=AccountPublic)
def test_token(current_account: CurrentAccount) -> Any:
    """
    Test access token
    """
    return current_account


@router.post("/password-recovery/{email}")
def recover_password(request: Request, email: str, session: SessionDep) -> Message:
    """
    Gửi email đặt lại mật khẩu (nếu cấu hình SMTP). Luôn trả cùng một thông báo để giảm lộ email có tồn tại.
    Giới hạn tần suất theo IP và theo email.
    """
    normalized = email.strip().lower()
    window_sec = float(settings.PASSWORD_RESET_RATE_LIMIT_WINDOW_HOURS * 3600)

    if not rate_limit_allow(
        f"pwd_reset:ip:{_client_ip(request)}",
        max_requests=settings.PASSWORD_RESET_MAX_PER_IP_PER_HOUR,
        window_seconds=window_sec,
    ):
        raise HTTPException(
            status_code=429,
            detail="Quá nhiều yêu cầu. Vui lòng thử lại sau vài phút.",
        )
    if not rate_limit_allow(
        f"pwd_reset:email:{normalized}",
        max_requests=settings.PASSWORD_RESET_MAX_PER_EMAIL_PER_HOUR,
        window_seconds=window_sec,
    ):
        raise HTTPException(
            status_code=429,
            detail="Quá nhiều yêu cầu cho địa chỉ này. Vui lòng thử lại sau.",
        )

    account = crud.get_account_by_email(session=session, email=normalized)

    if account and settings.emails_enabled:
        try:
            password_reset_token = generate_password_reset_token(email=normalized)
            email_data = generate_reset_password_email(
                email_to=account.email, email=normalized, token=password_reset_token
            )
            send_email(
                email_to=account.email,
                subject=email_data.subject,
                html_content=email_data.html_content,
            )
        except Exception:
            logger.exception("Không gửi được email khôi phục mật khẩu")
    elif account and not settings.emails_enabled:
        logger.warning(
            "Yêu cầu khôi phục mật khẩu nhưng chưa cấu hình SMTP / EMAILS_FROM_EMAIL"
        )

    return Message(
        message="Nếu email đã đăng ký, chúng tôi đã gửi hướng dẫn khôi phục mật khẩu."
    )


@router.post("/reset-password/")
def reset_password(session: SessionDep, body: NewPassword) -> Message:
    """Đặt lại mật khẩu bằng token gửi qua email."""
    email = verify_password_reset_token(token=body.token)
    if not email:
        raise HTTPException(
            status_code=400,
            detail="Liên kết không hợp lệ hoặc đã hết hạn.",
        )
    account = crud.get_account_by_email(session=session, email=email)
    if not account:
        raise HTTPException(
            status_code=400,
            detail="Liên kết không hợp lệ hoặc đã hết hạn.",
        )
    if not account.is_active:
        raise HTTPException(status_code=400, detail="Tài khoản đang không hoạt động.")
    user_in_update = AccountUpdate(password=body.new_password)
    crud.update_account(
        session=session,
        db_account=account,
        account_in=user_in_update,
        updated_by_id=None,
    )
    return Message(message="Đặt lại mật khẩu thành công. Bạn có thể đăng nhập.")


@router.post(
    "/password-recovery-html-content/{email}",
    dependencies=[Depends(get_current_active_admin)],
    response_class=HTMLResponse,
)
def recover_password_html_content(email: str, session: SessionDep) -> Any:
    """
    HTML Content for Password Recovery
    """
    account = crud.get_account_by_email(session=session, email=email)

    if not account:
        raise HTTPException(
            status_code=404,
            detail="The account with this email does not exist in the system.",
        )
    password_reset_token = generate_password_reset_token(email=email)
    email_data = generate_reset_password_email(
        email_to=account.email, email=email, token=password_reset_token
    )

    return HTMLResponse(
        content=email_data.html_content, headers={"subject:": email_data.subject}
    )
