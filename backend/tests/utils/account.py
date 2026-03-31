from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models import Account, AccountCreate, AccountRole, AccountUpdate
from tests.utils.utils import random_email, random_lower_string


def user_authentication_headers(
    *, client: TestClient, email: str, password: str
) -> dict[str, str]:
    data = {"username": email, "password": password}

    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=data)
    response = r.json()
    auth_token = response["access_token"]
    headers = {"Authorization": f"Bearer {auth_token}"}
    return headers


def _admin(db: Session) -> Account:
    admin = crud.get_account_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert admin is not None
    return admin


def create_random_account(db: Session) -> Account:
    email = random_email()
    password = random_lower_string()
    admin = _admin(db)
    user_in = AccountCreate(
        email=email,
        password=password,
        full_name="Test",
        phone=None,
        description=None,
        role=AccountRole.user_level_1,
        parent_id=admin.id,
    )
    return crud.create_account(
        session=db, account_create=user_in, created_by_id=admin.id
    )


def authentication_token_from_email(
    *, client: TestClient, email: str, db: Session
) -> dict[str, str]:
    """
    Return a valid token for the account with given email.

    If the account doesn't exist it is created first (User cấp 1 under Admin).
    """
    password = random_lower_string()
    admin = _admin(db)
    account = crud.get_account_by_email(session=db, email=email)
    if not account:
        user_in_create = AccountCreate(
            email=email,
            password=password,
            full_name="Test User",
            phone=None,
            description=None,
            role=AccountRole.user_level_1,
            parent_id=admin.id,
        )
        account = crud.create_account(
            session=db,
            account_create=user_in_create,
            created_by_id=admin.id,
        )
    else:
        user_in_update = AccountUpdate(password=password)
        account = crud.update_account(
            session=db,
            db_account=account,
            account_in=user_in_update,
            updated_by_id=admin.id,
        )

    return user_authentication_headers(client=client, email=email, password=password)
