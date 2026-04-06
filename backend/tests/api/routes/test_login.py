from unittest.mock import patch

from fastapi.testclient import TestClient
from pwdlib.hashers.bcrypt import BcryptHasher
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.models import Account, AccountCreate, AccountRole
from app.utils import generate_password_reset_token
from tests.utils.utils import random_email, random_lower_string


def _admin(db: Session) -> Account:
    a = crud.get_account_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert a is not None
    return a


def test_get_access_token(client: TestClient) -> None:
    login_data = {
        "username": settings.FIRST_SUPERUSER,
        "password": settings.FIRST_SUPERUSER_PASSWORD,
    }
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    tokens = r.json()
    assert r.status_code == 200
    assert "access_token" in tokens
    assert tokens["access_token"]
    assert tokens.get("user") is not None
    assert tokens["user"]["email"] == settings.FIRST_SUPERUSER


def test_get_access_token_incorrect_password(client: TestClient) -> None:
    login_data = {
        "username": settings.FIRST_SUPERUSER,
        "password": "incorrect",
    }
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    assert r.status_code == 400


def test_use_access_token(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/login/test-token",
        headers=superuser_token_headers,
    )
    result = r.json()
    assert r.status_code == 200
    assert "email" in result


def test_recovery_password(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    with (
        patch("app.core.config.settings.SMTP_HOST", "smtp.example.com"),
        patch("app.core.config.settings.SMTP_USER", "admin@example.com"),
    ):
        email = "test@example.com"
        r = client.post(
            f"{settings.API_V1_STR}/password-recovery/{email}",
            headers=normal_user_token_headers,
        )
        assert r.status_code == 200
        assert r.json() == {
            "message": "Nếu email đã đăng ký, chúng tôi đã gửi hướng dẫn khôi phục mật khẩu."
        }


def test_recovery_password_user_not_exits(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    email = "jVgQr@example.com"
    r = client.post(
        f"{settings.API_V1_STR}/password-recovery/{email}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200
    assert r.json() == {
        "message": "Nếu email đã đăng ký, chúng tôi đã gửi hướng dẫn khôi phục mật khẩu."
    }


def test_recovery_password_rate_limited_by_ip(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    """Sau PASSWORD_RESET_MAX_PER_IP_PER_HOUR yêu cầu từ cùng IP → 429."""
    with (
        patch("app.core.config.settings.SMTP_HOST", "smtp.example.com"),
        patch("app.core.config.settings.SMTP_USER", "admin@example.com"),
    ):
        max_ip = settings.PASSWORD_RESET_MAX_PER_IP_PER_HOUR
        for i in range(max_ip):
            r = client.post(
                f"{settings.API_V1_STR}/password-recovery/rate{i}@example.com",
                headers=normal_user_token_headers,
            )
            assert r.status_code == 200, i
        r = client.post(
            f"{settings.API_V1_STR}/password-recovery/rate_overflow@example.com",
            headers=normal_user_token_headers,
        )
        assert r.status_code == 429
        assert "Quá nhiều yêu cầu" in r.json()["detail"]


def test_reset_password(client: TestClient, db: Session) -> None:
    email = random_email()
    password = random_lower_string()
    new_password = random_lower_string()

    admin = _admin(db)
    user_create = AccountCreate(
        email=email,
        full_name="Test User",
        password=password,
        phone=None,
        description=None,
        role=AccountRole.user_level_1,
        parent_id=admin.id,
    )
    user = crud.create_account(
        session=db, account_create=user_create, created_by_id=admin.id
    )
    token = generate_password_reset_token(email=email)
    data = {"new_password": new_password, "token": token}

    r = client.post(
        f"{settings.API_V1_STR}/reset-password/",
        json=data,
    )

    assert r.status_code == 200
    assert r.json() == {
        "message": "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập."
    }

    db.refresh(user)
    verified, _ = verify_password(new_password, user.hashed_password)
    assert verified


def test_reset_password_invalid_token(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"new_password": "changethis", "token": "invalid"}
    r = client.post(
        f"{settings.API_V1_STR}/reset-password/",
        headers=superuser_token_headers,
        json=data,
    )
    response = r.json()

    assert "detail" in response
    assert r.status_code == 400
    assert response["detail"] == "Liên kết không hợp lệ hoặc đã hết hạn."


def test_login_with_bcrypt_password_upgrades_to_argon2(
    client: TestClient, db: Session
) -> None:
    email = random_email()
    password = random_lower_string()

    bcrypt_hasher = BcryptHasher()
    bcrypt_hash = bcrypt_hasher.hash(password)
    assert bcrypt_hash.startswith("$2")

    admin = _admin(db)
    user = Account(
        email=email,
        full_name="Test",
        hashed_password=bcrypt_hash,
        is_active=True,
        role=AccountRole.user_level_1,
        parent_id=admin.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    assert user.hashed_password.startswith("$2")

    login_data = {"username": email, "password": password}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    assert r.status_code == 200
    tokens = r.json()
    assert "access_token" in tokens

    db.refresh(user)

    assert user.hashed_password.startswith("$argon2")

    verified, updated_hash = verify_password(password, user.hashed_password)
    assert verified
    assert updated_hash is None


def test_login_with_argon2_password_keeps_hash(client: TestClient, db: Session) -> None:
    email = random_email()
    password = random_lower_string()

    argon2_hash = get_password_hash(password)
    assert argon2_hash.startswith("$argon2")

    admin = _admin(db)
    user = Account(
        email=email,
        full_name="Test",
        hashed_password=argon2_hash,
        is_active=True,
        role=AccountRole.user_level_1,
        parent_id=admin.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    original_hash = user.hashed_password

    login_data = {"username": email, "password": password}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    assert r.status_code == 200
    tokens = r.json()
    assert "access_token" in tokens

    db.refresh(user)

    assert user.hashed_password == original_hash
    assert user.hashed_password.startswith("$argon2")
