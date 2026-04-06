import uuid
from typing import Any

from sqlmodel import Session, col, select

from app.core.security import get_password_hash, verify_password
from app.models import (
    Account,
    AccountCreate,
    AccountRole,
    AccountUpdate,
    Category,
    CategoryCreate,
    CategoryUpdate,
    Item,
    ItemCreate,
)


def validate_account_hierarchy(
    *,
    role: AccountRole,
    parent_id: uuid.UUID | None,
    parent: Account | None,
) -> None:
    if role == AccountRole.admin:
        if parent_id is not None:
            raise ValueError("Admin account must not have parent_id")
        return
    if parent_id is None:
        raise ValueError("parent_id is required for this role")
    if parent is None:
        raise ValueError("Parent account not found")
    if role == AccountRole.user_level_1 and parent.role != AccountRole.admin:
        raise ValueError("User level 1 must have an Admin as parent")
    if role == AccountRole.user_level_2 and parent.role != AccountRole.user_level_1:
        raise ValueError("User level 2 must have a User level 1 as parent")


def get_account_by_email(*, session: Session, email: str) -> Account | None:
    statement = select(Account).where(Account.email == email)
    return session.exec(statement).first()


def get_account_by_phone(*, session: Session, phone: str) -> Account | None:
    statement = select(Account).where(Account.phone == phone)
    return session.exec(statement).first()


def create_account(
    *,
    session: Session,
    account_create: AccountCreate,
    created_by_id: uuid.UUID | None,
) -> Account:
    parent: Account | None = None
    if account_create.parent_id is not None:
        parent = session.get(Account, account_create.parent_id)
    validate_account_hierarchy(
        role=account_create.role,
        parent_id=account_create.parent_id,
        parent=parent,
    )
    if get_account_by_email(session=session, email=account_create.email):
        raise ValueError("Tài khoản với email này đã tồn tại trong hệ thống.")
    if account_create.phone and get_account_by_phone(
        session=session, phone=account_create.phone
    ):
        raise ValueError("Tài khoản với số điện thoại này đã tồn tại trong hệ thống.")

    payload = account_create.model_dump()
    payload.pop("password")
    db_obj = Account(
        **payload,
        hashed_password=get_password_hash(account_create.password),
        created_by_id=created_by_id,
        updated_by_id=created_by_id,
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_account(
    *,
    session: Session,
    db_account: Account,
    account_in: AccountUpdate,
    updated_by_id: uuid.UUID | None,
) -> Any:
    data = account_in.model_dump(exclude_unset=True)
    extra: dict[str, Any] = {}
    if "password" in data:
        extra["hashed_password"] = get_password_hash(data.pop("password"))
    new_role = data.get("role", db_account.role)
    new_parent_id = data.get("parent_id", db_account.parent_id)
    if "role" in data or "parent_id" in data:
        parent: Account | None = None
        if new_parent_id is not None:
            parent = session.get(Account, new_parent_id)
        validate_account_hierarchy(
            role=new_role,
            parent_id=new_parent_id,
            parent=parent,
        )
    if "email" in data and data["email"] != db_account.email:
        existing = get_account_by_email(session=session, email=data["email"])
        if existing and existing.id != db_account.id:
            raise ValueError("Account with this email already exists")
    if "phone" in data and data["phone"] != db_account.phone:
        if data["phone"]:
            existing = get_account_by_phone(session=session, phone=data["phone"])
            if existing and existing.id != db_account.id:
                raise ValueError("Account with this phone already exists")

    from datetime import datetime, timezone

    extra["updated_by_id"] = updated_by_id
    extra["updated_at"] = datetime.now(timezone.utc)
    db_account.sqlmodel_update(data, update=extra)
    session.add(db_account)
    session.commit()
    session.refresh(db_account)
    return db_account


DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$MjQyZWE1MzBjYjJlZTI0Yw$YTU4NGM5ZTZmYjE2NzZlZjY0ZWY3ZGRkY2U2OWFjNjk"


def authenticate(*, session: Session, email: str, password: str) -> Account | None:
    db_account = get_account_by_email(session=session, email=email)
    if not db_account:
        verify_password(password, DUMMY_HASH)
        return None
    verified, updated_password_hash = verify_password(
        password, db_account.hashed_password
    )
    if not verified:
        return None
    if updated_password_hash:
        db_account.hashed_password = updated_password_hash
        session.add(db_account)
        session.commit()
        session.refresh(db_account)
    return db_account


def create_item(*, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
    db_item = Item.model_validate(item_in, update={"owner_id": owner_id})
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item


def account_has_children(*, session: Session, account_id: uuid.UUID) -> bool:
    statement = select(Account.id).where(col(Account.parent_id) == account_id).limit(1)
    return session.exec(statement).first() is not None


def get_category_by_name_under_parent(
    *,
    session: Session,
    name: str,
    parent_id: uuid.UUID | None,
) -> Category | None:
    statement = select(Category).where(Category.name == name)
    if parent_id is None:
        statement = statement.where(col(Category.parent_id).is_(None))
    else:
        statement = statement.where(Category.parent_id == parent_id)
    return session.exec(statement).first()


def create_category(
    *,
    session: Session,
    category_in: CategoryCreate,
    created_by_id: uuid.UUID,
) -> Category:
    if category_in.parent_id is not None:
        parent = session.get(Category, category_in.parent_id)
        if parent is None:
            raise ValueError("Danh mục cha không tồn tại")
    if get_category_by_name_under_parent(
        session=session, name=category_in.name, parent_id=category_in.parent_id
    ):
        raise ValueError("Tên loại mặt hàng đã tồn tại trong cùng cấp")

    db_obj = Category(
        name=category_in.name,
        description=category_in.description,
        parent_id=category_in.parent_id,
        created_by_id=created_by_id,
        updated_by_id=created_by_id,
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_category(
    *,
    session: Session,
    db_category: Category,
    category_in: CategoryUpdate,
    updated_by_id: uuid.UUID,
) -> Category:
    from datetime import datetime, timezone

    data = category_in.model_dump(exclude_unset=True)
    new_name = data.get("name", db_category.name)
    new_parent_id = db_category.parent_id
    if "name" in data and new_name != db_category.name:
        existing = get_category_by_name_under_parent(
            session=session, name=new_name, parent_id=new_parent_id
        )
        if existing and existing.id != db_category.id:
            raise ValueError("Tên loại mặt hàng đã tồn tại trong cùng cấp")

    extra: dict[str, Any] = {
        "updated_by_id": updated_by_id,
        "updated_at": datetime.now(timezone.utc),
    }
    db_category.sqlmodel_update(data, update=extra)
    session.add(db_category)
    session.commit()
    session.refresh(db_category)
    return db_category


def category_has_children(*, session: Session, category_id: uuid.UUID) -> bool:
    statement = select(Category.id).where(col(Category.parent_id) == category_id).limit(1)
    return session.exec(statement).first() is not None
