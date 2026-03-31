import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import or_
from sqlmodel import col, delete, func, select

from app import crud
from app.api.deps import CurrentAccount, SessionDep
from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.models import (
    Account,
    AccountCreate,
    AccountPublic,
    AccountRegister,
    AccountRole,
    AccountsPublic,
    AccountUpdate,
    AccountUpdateMe,
    Item,
    Message,
    UpdatePassword,
)
from app.utils import generate_new_account_email, send_email

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _account_in_scope(session: SessionDep, current: Account, account_id: uuid.UUID) -> bool:
    if current.role == AccountRole.admin:
        return True
    if current.id == account_id:
        return True
    target = session.get(Account, account_id)
    if target is None:
        return False
    if current.role == AccountRole.user_level_1:
        return target.parent_id == current.id
    return False


def _can_create_role(creator: Account, role: AccountRole) -> bool:
    """Admin may create L1 and L2; User level 1 only L2; User level 2 cannot create."""
    if creator.role == AccountRole.admin:
        return role in (AccountRole.user_level_1, AccountRole.user_level_2)
    if creator.role == AccountRole.user_level_1:
        return role == AccountRole.user_level_2
    return False


def _resolve_parent_id_for_create(
    *,
    current_account: Account,
    account_in: AccountCreate,
) -> uuid.UUID:
    """
    Hierarchy Admin → L1 → L2. If parent_id is omitted, use the current user's id when
    valid. Admin creating User level 2 must send parent_id (a User level 1 id).
    """
    effective = account_in.parent_id

    if effective is None:
        if account_in.role == AccountRole.user_level_1:
            if current_account.role != AccountRole.admin:
                raise HTTPException(
                    status_code=400,
                    detail="Only an admin can create User level 1 accounts",
                )
            return current_account.id
        if account_in.role == AccountRole.user_level_2:
            if current_account.role == AccountRole.user_level_1:
                return current_account.id
            if current_account.role == AccountRole.admin:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "parent_id is required when an admin creates a User level 2 "
                        "account (must reference a User level 1 account)"
                    ),
                )
            raise HTTPException(status_code=403, detail="Not enough permissions")
        raise HTTPException(status_code=400, detail="Invalid role")

    if current_account.role == AccountRole.user_level_1:
        if account_in.role != AccountRole.user_level_2:
            raise HTTPException(
                status_code=400,
                detail="User level 1 can only create User level 2 accounts",
            )
        if effective != current_account.id:
            raise HTTPException(
                status_code=400,
                detail="User level 1 can only create User level 2 with themselves as parent",
            )
    return effective


@router.get(
    "/",
    response_model=AccountsPublic,
)
def read_accounts(
    session: SessionDep,
    current_account: CurrentAccount,
    parent_id: uuid.UUID | None = None,
    keyword: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    if current_account.role == AccountRole.user_level_2:
        raise HTTPException(
            status_code=403,
            detail="User level 2 cannot access the accounts list",
        )

    if current_account.role in (AccountRole.admin, AccountRole.user_level_1):
        # Admin chỉ tạo User cấp 1 → chỉ hiển thị các tài khoản có parent_id = admin.
        # User cấp 1 chỉ tạo User cấp 2 → chỉ hiển thị các tài khoản có parent_id = L1.
        # Không gộp cháu (L2 của L1) vào danh sách của admin.
        statement = select(Account).where(Account.parent_id == current_account.id)
        if parent_id is not None:
            statement = statement.where(Account.parent_id == parent_id)

    if keyword:
        search = f"%{keyword.strip()}%"
        if search != "%%":
            statement = statement.where(
                or_(
                    Account.full_name.ilike(search),
                    Account.email.ilike(search),
                    Account.phone.ilike(search),
                    Account.description.ilike(search),
                )
            )

    count_statement = select(func.count()).select_from(statement.subquery())
    count = session.exec(count_statement).one()

    statement = statement.order_by(col(Account.created_at).desc()).offset(skip).limit(limit)

    accounts = session.exec(statement).all()
    return AccountsPublic(data=accounts, count=count)


@router.post("/", response_model=AccountPublic)
def create_account(
    *,
    session: SessionDep,
    current_account: CurrentAccount,
    account_in: AccountCreate,
) -> Any:
    if current_account.role == AccountRole.admin:
        resolved_role = AccountRole.user_level_1
    elif current_account.role == AccountRole.user_level_1:
        resolved_role = AccountRole.user_level_2
    else:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    resolved_in = account_in.model_copy(
        update={
            "role": resolved_role,
            "parent_id": current_account.id,
        }
    )

    try:
        account = crud.create_account(
            session=session,
            account_create=resolved_in,
            created_by_id=current_account.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if settings.emails_enabled and account_in.email:
        email_data = generate_new_account_email(
            email_to=account_in.email,
            username=account_in.email,
            password=account_in.password,
        )
        send_email(
            email_to=account_in.email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )
    return account


@router.post("/signup", response_model=AccountPublic)
def register_account(session: SessionDep, body: AccountRegister) -> Any:
    parent = session.get(Account, body.parent_id)
    if not parent or not parent.is_active:
        raise HTTPException(status_code=400, detail="Invalid parent account")
    if parent.role != AccountRole.user_level_1:
        raise HTTPException(
            status_code=400,
            detail="parent_id must be a valid User level 1 account",
        )
    create_in = AccountCreate(
        email=body.email,
        password=body.password,
        full_name=body.full_name,
        phone=body.phone,
        description=body.description,
        parent_id=body.parent_id,
        role=AccountRole.user_level_2,
    )
    try:
        return crud.create_account(
            session=session,
            account_create=create_in,
            created_by_id=None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.patch("/me", response_model=AccountPublic)
def update_account_me(
    *, session: SessionDep, body: AccountUpdateMe, current_account: CurrentAccount
) -> Any:
    if body.email:
        existing = crud.get_account_by_email(session=session, email=body.email)
        if existing and existing.id != current_account.id:
            raise HTTPException(
                status_code=409, detail="Account with this email already exists"
            )
    if body.phone:
        existing = crud.get_account_by_phone(session=session, phone=body.phone)
        if existing and existing.id != current_account.id:
            raise HTTPException(
                status_code=409, detail="Account with this phone already exists"
            )
    data = body.model_dump(exclude_unset=True)
    current_account.sqlmodel_update(data)
    session.add(current_account)
    session.commit()
    session.refresh(current_account)
    return current_account


@router.patch("/me/password", response_model=Message)
def update_password_me(
    *, session: SessionDep, body: UpdatePassword, current_account: CurrentAccount
) -> Any:
    verified, _ = verify_password(body.current_password, current_account.hashed_password)
    if not verified:
        raise HTTPException(status_code=400, detail="Incorrect password")
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=400, detail="New password cannot be the same as the current one"
        )
    current_account.hashed_password = get_password_hash(body.new_password)
    session.add(current_account)
    session.commit()
    return Message(message="Password updated successfully")


@router.get("/me", response_model=AccountPublic)
def read_account_me(current_account: CurrentAccount) -> Any:
    return current_account


@router.delete("/me", response_model=Message)
def delete_account_me(session: SessionDep, current_account: CurrentAccount) -> Any:
    if current_account.role == AccountRole.admin:
        raise HTTPException(
            status_code=403, detail="Admin accounts are not allowed to delete themselves"
        )
    if crud.account_has_children(session=session, account_id=current_account.id):
        raise HTTPException(
            status_code=400,
            detail="Cannot delete account that still has child accounts",
        )
    session.delete(current_account)
    session.commit()
    return Message(message="Account deleted successfully")


@router.get("/{account_id}", response_model=AccountPublic)
def read_account_by_id(
    account_id: uuid.UUID, session: SessionDep, current_account: CurrentAccount
) -> Any:
    if not _account_in_scope(session, current_account, account_id):
        raise HTTPException(
            status_code=403,
            detail="The account doesn't have enough privileges",
        )
    account = session.get(Account, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.patch("/{account_id}", response_model=AccountPublic)
def update_account(
    *,
    session: SessionDep,
    account_id: uuid.UUID,
    account_in: AccountUpdate,
    current_account: CurrentAccount,
) -> Any:
    if not _account_in_scope(session, current_account, account_id):
        raise HTTPException(
            status_code=403,
            detail="The account doesn't have enough privileges",
        )
    db_account = session.get(Account, account_id)
    if not db_account:
        raise HTTPException(
            status_code=404,
            detail="The account with this id does not exist in the system",
        )
    if account_in.is_active is not None:
        can_update_active = current_account.role == AccountRole.admin
        if (
            current_account.role == AccountRole.user_level_1
            and db_account.role == AccountRole.user_level_2
            and db_account.parent_id == current_account.id
        ):
            can_update_active = True
        if not can_update_active:
            raise HTTPException(
                status_code=403,
                detail="Only admin or direct manager can change active status",
            )
    if current_account.role != AccountRole.admin:
        if account_in.role is not None and account_in.role != db_account.role:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        if account_in.parent_id is not None and account_in.parent_id != db_account.parent_id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
    try:
        return crud.update_account(
            session=session,
            db_account=db_account,
            account_in=account_in,
            updated_by_id=current_account.id,
        )
    except ValueError as e:
        msg = str(e)
        if "already exists" in msg:
            raise HTTPException(status_code=409, detail=msg) from e
        raise HTTPException(status_code=400, detail=msg) from e


@router.delete("/{account_id}", response_model=Message)
def delete_account(
    session: SessionDep,
    current_account: CurrentAccount,
    account_id: uuid.UUID,
) -> Any:
    db_account = session.get(Account, account_id)
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    if db_account.id == current_account.id:
        if current_account.role == AccountRole.admin:
            raise HTTPException(
                status_code=403, detail="Admin accounts are not allowed to delete themselves"
            )
        raise HTTPException(status_code=403, detail="Use DELETE /accounts/me to delete yourself")

    if current_account.role == AccountRole.admin:
        if crud.account_has_children(session=session, account_id=account_id):
            raise HTTPException(
                status_code=400,
                detail="Cannot delete account that still has child accounts",
            )
        statement = delete(Item).where(col(Item.owner_id) == account_id)
        session.exec(statement)
        session.delete(db_account)
        session.commit()
        return Message(message="Account deleted successfully")

    if current_account.role == AccountRole.user_level_1:
        if db_account.parent_id != current_account.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        if db_account.role != AccountRole.user_level_2:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        if crud.account_has_children(session=session, account_id=account_id):
            raise HTTPException(
                status_code=400,
                detail="Cannot delete account that still has child accounts",
            )
        statement = delete(Item).where(col(Item.owner_id) == account_id)
        session.exec(statement)
        session.delete(db_account)
        session.commit()
        return Message(message="Account deleted successfully")

    raise HTTPException(status_code=403, detail="Not enough permissions")
