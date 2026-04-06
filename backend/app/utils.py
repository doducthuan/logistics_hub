import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import emails  # type: ignore
import jwt
from jinja2 import Template
from jwt.exceptions import InvalidTokenError

from app.core import security
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Phân biệt JWT đặt lại mật khẩu với token đăng nhập (cùng SECRET_KEY / thuật toán).
PASSWORD_RESET_JWT_TYP = "pwd_reset"


@dataclass
class EmailData:
    html_content: str
    subject: str


def render_email_template(*, template_name: str, context: dict[str, Any]) -> str:
    template_str = (
        Path(__file__).parent / "email-templates" / "build" / template_name
    ).read_text(encoding="utf-8")
    html_content = Template(template_str).render(context)
    return html_content


def send_email(
    *,
    email_to: str,
    subject: str = "",
    html_content: str = "",
) -> None:
    assert settings.emails_enabled, "no provided configuration for email variables"
    message = emails.Message(
        subject=subject,
        html=html_content,
        mail_from=(settings.EMAILS_FROM_NAME, settings.EMAILS_FROM_EMAIL),
    )
    smtp_options = {"host": settings.SMTP_HOST, "port": settings.SMTP_PORT}
    if settings.SMTP_TLS:
        smtp_options["tls"] = True
    elif settings.SMTP_SSL:
        smtp_options["ssl"] = True
    if settings.SMTP_USER:
        smtp_options["user"] = settings.SMTP_USER
    if settings.SMTP_PASSWORD:
        smtp_options["password"] = settings.SMTP_PASSWORD
    response = message.send(to=email_to, smtp=smtp_options)
    code = getattr(response, "status_code", None)
    text = getattr(response, "status_text", None)

    # SMTP: mã 2yz = thành công (thường 250 = đã nhận mail để chuyển đi).
    if code is None:
        logger.warning(
            "SMTP không trả status_code; không xác nhận được đã gửi. response=%r",
            response,
        )
    elif not (200 <= code < 300):
        err = f"SMTP từ chối gửi: status_code={code} status_text={text!r}"
        logger.error("%s", err)
        raise RuntimeError(err)

    logger.info(
        "Gửi email thành công (SMTP status_code=%s status_text=%s)",
        code,
        text,
    )


def generate_test_email(email_to: str) -> EmailData:
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - Test email"
    html_content = render_email_template(
        template_name="test_email.html",
        context={"project_name": settings.PROJECT_NAME, "email": email_to},
    )
    return EmailData(html_content=html_content, subject=subject)


def generate_reset_password_email(email_to: str, email: str, token: str) -> EmailData:
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} — Khôi phục mật khẩu"
    base = str(settings.FRONTEND_HOST).rstrip("/")
    path = settings.PASSWORD_RESET_LINK_PATH
    if not path.startswith("/"):
        path = f"/{path}"
    link = f"{base}{path}?token={token}"
    html_content = render_email_template(
        template_name="reset_password.html",
        context={
            "project_name": project_name,
            "username": email,
            "email": email_to,
            "valid_hours": settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS,
            "link": link,
            "year": datetime.now(timezone.utc).year,
        },
    )
    return EmailData(html_content=html_content, subject=subject)


def generate_new_account_email(
    email_to: str, username: str, password: str
) -> EmailData:
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - New account for user {username}"
    html_content = render_email_template(
        template_name="new_account.html",
        context={
            "project_name": settings.PROJECT_NAME,
            "username": username,
            "password": password,
            "email": email_to,
            "link": settings.FRONTEND_HOST,
        },
    )
    return EmailData(html_content=html_content, subject=subject)


def generate_password_reset_token(email: str) -> str:
    delta = timedelta(hours=settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS)
    now = datetime.now(timezone.utc)
    expires = now + delta
    exp = expires.timestamp()
    sub = email.strip().lower()
    encoded_jwt = jwt.encode(
        {
            "exp": exp,
            "nbf": now.timestamp(),
            "sub": sub,
            "typ": PASSWORD_RESET_JWT_TYP,
        },
        settings.SECRET_KEY,
        algorithm=security.ALGORITHM,
    )
    return encoded_jwt


def verify_password_reset_token(token: str) -> str | None:
    try:
        decoded_token = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        if decoded_token.get("typ") != PASSWORD_RESET_JWT_TYP:
            return None
        sub = decoded_token.get("sub")
        if sub is None:
            return None
        return str(sub).strip().lower()
    except InvalidTokenError:
        return None
