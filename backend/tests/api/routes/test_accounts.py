import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app import crud
from app.core.config import settings
from app.core.security import verify_password
from app.models import Account, AccountCreate, AccountRole
from tests.utils.account import create_random_account
from tests.utils.utils import random_email, random_lower_string


def _admin(db: Session) -> Account:
    a = crud.get_account_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert a is not None
    return a


def _create_l1(db: Session, email: str, password: str) -> Account:
    admin = _admin(db)
    ac = AccountCreate(
        email=email,
        password=password,
        full_name="Test",
        phone=None,
        description=None,
        role=AccountRole.user_level_1,
        parent_id=admin.id,
    )
    return crud.create_account(
        session=db, account_create=ac, created_by_id=admin.id
    )


def test_get_accounts_admin_me(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/accounts/me", headers=superuser_token_headers
    )
    current = r.json()
    assert current
    assert current["is_active"] is True
    assert current["role"] == AccountRole.admin.value
    assert current["email"] == settings.FIRST_SUPERUSER


def test_get_accounts_normal_user_me(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/accounts/me", headers=normal_user_token_headers
    )
    current = r.json()
    assert current
    assert current["is_active"] is True
    assert current["role"] == AccountRole.user_level_1.value
    assert current["email"] == settings.EMAIL_TEST_USER


def test_create_account_new_email(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    with (
        patch("app.utils.send_email", return_value=None),
        patch("app.core.config.settings.SMTP_HOST", "smtp.example.com"),
        patch("app.core.config.settings.SMTP_USER", "admin@example.com"),
    ):
        me = client.get(
            f"{settings.API_V1_STR}/accounts/me", headers=superuser_token_headers
        ).json()
        username = random_email()
        password = random_lower_string()
        data = {
            "email": username,
            "password": password,
            "full_name": "New",
            "role": AccountRole.user_level_1.value,
            "parent_id": str(me["id"]),
        }
        r = client.post(
            f"{settings.API_V1_STR}/accounts/",
            headers=superuser_token_headers,
            json=data,
        )
        assert 200 <= r.status_code < 300
        created = r.json()
        user = crud.get_account_by_email(session=db, email=username)
        assert user
        assert user.email == created["email"]


def test_get_existing_account_as_admin(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    username = random_email()
    password = random_lower_string()
    user = _create_l1(db, username, password)
    user_id = user.id
    r = client.get(
        f"{settings.API_V1_STR}/accounts/{user_id}",
        headers=superuser_token_headers,
    )
    assert 200 <= r.status_code < 300
    api_user = r.json()
    existing = crud.get_account_by_email(session=db, email=username)
    assert existing
    assert existing.email == api_user["email"]


def test_get_non_existing_account_as_admin(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/accounts/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404
    assert r.json() == {"detail": "Account not found"}


def test_get_existing_account_current_user(client: TestClient, db: Session) -> None:
    username = random_email()
    password = random_lower_string()
    user = _create_l1(db, username, password)
    user_id = user.id

    login_data = {
        "username": username,
        "password": password,
    }
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    tokens = r.json()
    a_token = tokens["access_token"]
    headers = {"Authorization": f"Bearer {a_token}"}

    r = client.get(
        f"{settings.API_V1_STR}/accounts/{user_id}",
        headers=headers,
    )
    assert 200 <= r.status_code < 300
    api_user = r.json()
    existing = crud.get_account_by_email(session=db, email=username)
    assert existing
    assert existing.email == api_user["email"]


def test_get_existing_account_permissions_error(
    db: Session,
    client: TestClient,
    normal_user_token_headers: dict[str, str],
) -> None:
    other = create_random_account(db)

    r = client.get(
        f"{settings.API_V1_STR}/accounts/{other.id}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403
    assert r.json() == {"detail": "The account doesn't have enough privileges"}


def test_get_non_existing_account_permissions_error(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
) -> None:
    user_id = uuid.uuid4()

    r = client.get(
        f"{settings.API_V1_STR}/accounts/{user_id}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403
    assert r.json() == {"detail": "The account doesn't have enough privileges"}


def test_create_account_existing_email(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    username = random_email()
    password = random_lower_string()
    _create_l1(db, username, password)
    me = client.get(
        f"{settings.API_V1_STR}/accounts/me", headers=superuser_token_headers
    ).json()
    data = {
        "email": username,
        "password": password,
        "full_name": "Dup",
        "role": AccountRole.user_level_1.value,
        "parent_id": str(me["id"]),
    }
    r = client.post(
        f"{settings.API_V1_STR}/accounts/",
        headers=superuser_token_headers,
        json=data,
    )
    created = r.json()
    assert r.status_code == 400
    assert "_id" not in created


def test_create_account_by_level2_forbidden(
    client: TestClient, db: Session
) -> None:
    """User level 2 cannot create accounts."""
    admin = _admin(db)
    l1 = _create_l1(db, random_email(), random_lower_string())
    l2_password = random_lower_string()
    l2_in = AccountCreate(
        email=random_email(),
        password=l2_password,
        full_name="L2",
        phone=None,
        description=None,
        role=AccountRole.user_level_2,
        parent_id=l1.id,
    )
    l2 = crud.create_account(
        session=db, account_create=l2_in, created_by_id=admin.id
    )
    login_data = {"username": l2.email, "password": l2_password}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get(f"{settings.API_V1_STR}/accounts/me", headers=headers).json()
    data = {
        "email": random_email(),
        "password": random_lower_string(),
        "full_name": "X",
        "role": AccountRole.user_level_2.value,
        "parent_id": str(me["id"]),
    }
    r = client.post(
        f"{settings.API_V1_STR}/accounts/",
        headers=headers,
        json=data,
    )
    assert r.status_code == 403


def test_retrieve_accounts(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    _create_l1(db, random_email(), random_lower_string())
    _create_l1(db, random_email(), random_lower_string())

    r = client.get(
        f"{settings.API_V1_STR}/accounts/", headers=superuser_token_headers
    )
    all_accounts = r.json()

    assert len(all_accounts["data"]) > 1
    assert "count" in all_accounts
    for item in all_accounts["data"]:
        assert "email" in item


def test_update_account_me(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    full_name = "Updated Name"
    email = random_email()
    data = {"full_name": full_name, "email": email}
    r = client.patch(
        f"{settings.API_V1_STR}/accounts/me",
        headers=normal_user_token_headers,
        json=data,
    )
    assert r.status_code == 200
    updated = r.json()
    assert updated["email"] == email
    assert updated["full_name"] == full_name

    user_query = select(Account).where(Account.email == email)
    user_db = db.exec(user_query).first()
    assert user_db
    assert user_db.email == email
    assert user_db.full_name == full_name


def test_update_password_me(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    new_password = random_lower_string()
    data = {
        "current_password": settings.FIRST_SUPERUSER_PASSWORD,
        "new_password": new_password,
    }
    r = client.patch(
        f"{settings.API_V1_STR}/accounts/me/password",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 200
    updated = r.json()
    assert updated["message"] == "Password updated successfully"

    user_query = select(Account).where(Account.email == settings.FIRST_SUPERUSER)
    user_db = db.exec(user_query).first()
    assert user_db
    assert user_db.email == settings.FIRST_SUPERUSER
    verified, _ = verify_password(new_password, user_db.hashed_password)
    assert verified

    old_data = {
        "current_password": new_password,
        "new_password": settings.FIRST_SUPERUSER_PASSWORD,
    }
    r = client.patch(
        f"{settings.API_V1_STR}/accounts/me/password",
        headers=superuser_token_headers,
        json=old_data,
    )
    db.refresh(user_db)

    assert r.status_code == 200
    verified, _ = verify_password(
        settings.FIRST_SUPERUSER_PASSWORD, user_db.hashed_password
    )
    assert verified


def test_update_password_me_incorrect_password(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    new_password = random_lower_string()
    data = {"current_password": new_password, "new_password": new_password}
    r = client.patch(
        f"{settings.API_V1_STR}/accounts/me/password",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "Incorrect password"


def test_update_account_me_email_exists(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    username = random_email()
    password = random_lower_string()
    other = _create_l1(db, username, password)

    data = {"email": other.email}
    r = client.patch(
        f"{settings.API_V1_STR}/accounts/me",
        headers=normal_user_token_headers,
        json=data,
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "Account with this email already exists"


def test_update_password_me_same_password_error(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {
        "current_password": settings.FIRST_SUPERUSER_PASSWORD,
        "new_password": settings.FIRST_SUPERUSER_PASSWORD,
    }
    r = client.patch(
        f"{settings.API_V1_STR}/accounts/me/password",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 400
    assert (
        r.json()["detail"] == "New password cannot be the same as the current one"
    )


def test_register_account(client: TestClient, db: Session) -> None:
    l1 = _create_l1(db, random_email(), random_lower_string())
    username = random_email()
    password = random_lower_string()
    full_name = random_lower_string()
    data = {
        "email": username,
        "password": password,
        "full_name": full_name,
        "parent_id": str(l1.id),
    }
    r = client.post(
        f"{settings.API_V1_STR}/accounts/signup",
        json=data,
    )
    assert r.status_code == 200
    created = r.json()
    assert created["email"] == username
    assert created["full_name"] == full_name
    assert created["role"] == AccountRole.user_level_2.value

    user_query = select(Account).where(Account.email == username)
    user_db = db.exec(user_query).first()
    assert user_db
    assert user_db.email == username
    assert user_db.full_name == full_name
    verified, _ = verify_password(password, user_db.hashed_password)
    assert verified


def test_register_account_already_exists_error(client: TestClient, db: Session) -> None:
    l1 = _create_l1(db, random_email(), random_lower_string())
    password = random_lower_string()
    full_name = random_lower_string()
    data = {
        "email": settings.FIRST_SUPERUSER,
        "password": password,
        "full_name": full_name,
        "parent_id": str(l1.id),
    }
    r = client.post(
        f"{settings.API_V1_STR}/accounts/signup",
        json=data,
    )
    assert r.status_code == 400
    assert (
        r.json()["detail"]
        == "The account with this email already exists in the system"
    )


def test_update_account(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    username = random_email()
    password = random_lower_string()
    user = _create_l1(db, username, password)

    data = {"full_name": "Updated_full_name"}
    r = client.patch(
        f"{settings.API_V1_STR}/accounts/{user.id}",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 200
    updated = r.json()

    assert updated["full_name"] == "Updated_full_name"

    user_query = select(Account).where(Account.email == username)
    user_db = db.exec(user_query).first()
    db.refresh(user_db)
    assert user_db
    assert user_db.full_name == "Updated_full_name"


def test_update_account_not_exists(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"full_name": "Updated_full_name"}
    r = client.patch(
        f"{settings.API_V1_STR}/accounts/{uuid.uuid4()}",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 404
    assert r.json()["detail"] == "The account with this id does not exist in the system"


def test_update_account_email_exists(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    username = random_email()
    password = random_lower_string()
    user = _create_l1(db, username, password)

    username2 = random_email()
    password2 = random_lower_string()
    user2 = _create_l1(db, username2, password2)

    data = {"email": user2.email}
    r = client.patch(
        f"{settings.API_V1_STR}/accounts/{user.id}",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "Account with this email already exists"


def test_delete_account_me(client: TestClient, db: Session) -> None:
    username = random_email()
    password = random_lower_string()
    user = _create_l1(db, username, password)
    user_id = user.id

    login_data = {
        "username": username,
        "password": password,
    }
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    tokens = r.json()
    a_token = tokens["access_token"]
    headers = {"Authorization": f"Bearer {a_token}"}

    r = client.delete(
        f"{settings.API_V1_STR}/accounts/me",
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["message"] == "Account deleted successfully"
    result = db.exec(select(Account).where(Account.id == user_id)).first()
    assert result is None


def test_delete_account_me_as_admin(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.delete(
        f"{settings.API_V1_STR}/accounts/me",
        headers=superuser_token_headers,
    )
    assert r.status_code == 403
    assert r.json()["detail"] == "Admin accounts are not allowed to delete themselves"


def test_delete_account_admin(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    username = random_email()
    password = random_lower_string()
    user = _create_l1(db, username, password)
    user_id = user.id
    r = client.delete(
        f"{settings.API_V1_STR}/accounts/{user_id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json()["message"] == "Account deleted successfully"
    result = db.exec(select(Account).where(Account.id == user_id)).first()
    assert result is None


def test_delete_account_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.delete(
        f"{settings.API_V1_STR}/accounts/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404
    assert r.json()["detail"] == "Account not found"


def test_delete_account_current_admin_error(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    super_user = crud.get_account_by_email(
        session=db, email=settings.FIRST_SUPERUSER
    )
    assert super_user
    user_id = super_user.id

    r = client.delete(
        f"{settings.API_V1_STR}/accounts/{user_id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 403
    assert (
        r.json()["detail"] == "Admin accounts are not allowed to delete themselves"
    )


def test_delete_account_without_privileges(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    other = create_random_account(db)

    r = client.delete(
        f"{settings.API_V1_STR}/accounts/{other.id}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403
    assert r.json()["detail"] == "Not enough permissions"
