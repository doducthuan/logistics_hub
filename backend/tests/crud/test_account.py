from fastapi.encoders import jsonable_encoder
from pwdlib.hashers.bcrypt import BcryptHasher
from sqlmodel import Session

from app import crud
from app.core.security import verify_password
from app.models import Account, AccountCreate, AccountRole, AccountUpdate
from tests.utils.utils import random_email, random_lower_string


def _admin(db: Session) -> Account:
    from app.core.config import settings

    a = crud.get_account_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert a is not None
    return a


def test_create_account(db: Session) -> None:
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
    user = crud.create_account(
        session=db, account_create=user_in, created_by_id=admin.id
    )
    assert user.email == email
    assert hasattr(user, "hashed_password")


def test_authenticate_account(db: Session) -> None:
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
    user = crud.create_account(
        session=db, account_create=user_in, created_by_id=admin.id
    )
    authenticated = crud.authenticate(session=db, email=email, password=password)
    assert authenticated
    assert user.email == authenticated.email


def test_not_authenticate_account(db: Session) -> None:
    email = random_email()
    password = random_lower_string()
    user = crud.authenticate(session=db, email=email, password=password)
    assert user is None


def test_check_if_account_is_active(db: Session) -> None:
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
    user = crud.create_account(
        session=db, account_create=user_in, created_by_id=admin.id
    )
    assert user.is_active is True


def test_check_if_account_is_active_inactive(db: Session) -> None:
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
    user = crud.create_account(
        session=db, account_create=user_in, created_by_id=admin.id
    )
    crud.update_account(
        session=db,
        db_account=user,
        account_in=AccountUpdate(is_active=False),
        updated_by_id=admin.id,
    )
    db.refresh(user)
    assert user.is_active is False


def test_get_account(db: Session) -> None:
    password = random_lower_string()
    username = random_email()
    admin = _admin(db)
    user_in = AccountCreate(
        email=username,
        password=password,
        full_name="Test",
        phone=None,
        description=None,
        role=AccountRole.user_level_1,
        parent_id=admin.id,
    )
    user = crud.create_account(
        session=db, account_create=user_in, created_by_id=admin.id
    )
    user_2 = db.get(Account, user.id)
    assert user_2
    assert user.email == user_2.email
    assert jsonable_encoder(user) == jsonable_encoder(user_2)


def test_update_account(db: Session) -> None:
    password = random_lower_string()
    email = random_email()
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
    user = crud.create_account(
        session=db, account_create=user_in, created_by_id=admin.id
    )
    new_password = random_lower_string()
    user_in_update = AccountUpdate(password=new_password)
    if user.id is not None:
        crud.update_account(
            session=db, db_account=user, account_in=user_in_update, updated_by_id=admin.id
        )
    user_2 = db.get(Account, user.id)
    assert user_2
    assert user.email == user_2.email
    verified, _ = verify_password(new_password, user_2.hashed_password)
    assert verified


def test_authenticate_account_with_bcrypt_upgrades_to_argon2(db: Session) -> None:
    """Test that a user with bcrypt password hash gets upgraded to argon2 on login."""
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
        role=AccountRole.user_level_1,
        parent_id=admin.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    assert user.hashed_password.startswith("$2")

    authenticated_user = crud.authenticate(session=db, email=email, password=password)
    assert authenticated_user
    assert authenticated_user.email == email

    db.refresh(authenticated_user)

    assert authenticated_user.hashed_password.startswith("$argon2")

    verified, updated_hash = verify_password(
        password, authenticated_user.hashed_password
    )
    assert verified
    assert updated_hash is None
