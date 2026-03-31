import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import SessionDep
from app.core.security import get_password_hash
from app.models import Account, AccountPublic, AccountRole

router = APIRouter(tags=["private"], prefix="/private")


class PrivateAccountCreate(BaseModel):
    email: str
    password: str
    full_name: str
    phone: str | None = None
    description: str | None = None
    role: AccountRole = AccountRole.admin
    parent_id: uuid.UUID | None = None


@router.post("/accounts/", response_model=AccountPublic)
def create_account_private(
    user_in: PrivateAccountCreate, session: SessionDep
) -> Any:
    """
    Create a new account (local dev helper).
    """

    account = Account(
        email=user_in.email,
        full_name=user_in.full_name,
        phone=user_in.phone,
        description=user_in.description,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
        parent_id=user_in.parent_id,
    )

    session.add(account)
    session.commit()
    session.refresh(account)

    return account
