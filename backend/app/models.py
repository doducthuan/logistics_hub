import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import EmailStr, field_validator
from sqlalchemy import Column, DateTime, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlmodel import Field, Relationship, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(timezone.utc)


class AccountRole(str, enum.Enum):
    """Admin → many User cấp 1 → many User cấp 2."""

    admin = "admin"
    user_level_1 = "user_level_1"
    user_level_2 = "user_level_2"


# --- Reusable audit base (kế thừa bởi các bảng domain khác) ---


class EntityBase(SQLModel, table=False):
    """Các trường audit chung: id, thời gian, người thao tác, trạng thái kích hoạt."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )
    updated_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )
    created_by_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="account.id",
    )
    updated_by_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="account.id",
    )
    is_active: bool = Field(default=True)


# --- Account ---


class AccountCore(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    phone: str | None = Field(default=None, unique=True, index=True, max_length=32)
    full_name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    parent_id: uuid.UUID | None = Field(default=None, foreign_key="account.id")


class AccountBase(AccountCore):
    role: AccountRole


class AccountCreate(AccountBase):
    password: str = Field(min_length=8, max_length=128)

    @field_validator("role", mode="before")
    @classmethod
    def coerce_role(cls, v: AccountRole | str) -> AccountRole:
        if isinstance(v, AccountRole):
            return v
        return AccountRole(v)


class AccountRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    description: str | None = Field(default=None, max_length=2000)
    parent_id: uuid.UUID = Field(
        description="Bắt buộc: User cấp 1 (parent) phải tồn tại để đăng ký User cấp 2"
    )


class AccountUpdate(SQLModel):
    email: EmailStr | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    phone: str | None = Field(default=None, max_length=32)
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    parent_id: uuid.UUID | None = None
    role: AccountRole | None = None
    is_active: bool | None = None


class AccountUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    description: str | None = Field(default=None, max_length=2000)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class Account(AccountCore, EntityBase, table=True):
    hashed_password: str
    last_login_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )
    role: AccountRole = Field(
        sa_column=Column(
            SAEnum(AccountRole, native_enum=False, length=32),
            nullable=False,
        )
    )

    parent: Optional["Account"] = Relationship(
        back_populates="children",
        sa_relationship_kwargs={
            "remote_side": lambda: [Account.id],
            "foreign_keys": lambda: [Account.parent_id],
        },
    )
    children: list["Account"] = Relationship(
        back_populates="parent",
        sa_relationship_kwargs={
            "foreign_keys": lambda: [Account.parent_id],
        },
    )


class AccountPublic(AccountBase):
    id: uuid.UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None
    created_by_id: uuid.UUID | None = None
    updated_by_id: uuid.UUID | None = None
    is_active: bool = True
    last_login_at: datetime | None = None


class AccountsPublic(SQLModel):
    data: list[AccountPublic]
    count: int


# --- Category (loại mặt hàng — cây phân cấp parent_id) ---


class CategoryCore(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    parent_id: uuid.UUID | None = Field(default=None, foreign_key="category.id")


class CategoryCreate(CategoryCore):
    pass


class CategoryUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    is_active: bool | None = None


class Category(CategoryCore, EntityBase, table=True):
    __table_args__ = (UniqueConstraint("parent_id", "name", name="uq_category_parent_name"),)

    parent: Optional["Category"] = Relationship(
        back_populates="children",
        sa_relationship_kwargs={
            "remote_side": lambda: [Category.id],
            "foreign_keys": lambda: [Category.parent_id],
        },
    )
    children: list["Category"] = Relationship(
        back_populates="parent",
        sa_relationship_kwargs={
            "foreign_keys": lambda: [Category.parent_id],
        },
    )


class CategoryPublic(CategoryCore):
    id: uuid.UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None
    created_by_id: uuid.UUID | None = None
    updated_by_id: uuid.UUID | None = None
    is_active: bool = True
    # Join Account.full_name ở tầng API — client không cần GET /accounts/{id} (tránh 403 user cấp 2).
    created_by_full_name: str | None = None
    updated_by_full_name: str | None = None


class CategoriesPublic(SQLModel):
    data: list[CategoryPublic]
    count: int


# --- Item (giữ template; owner trỏ tới account) ---


class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


class ItemCreate(ItemBase):
    pass


class ItemUpdate(ItemBase):
    title: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore


class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    owner_id: uuid.UUID = Field(
        foreign_key="account.id", nullable=False, ondelete="CASCADE"
    )
    owner: Optional["Account"] = Relationship()


class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


class Message(SQLModel):
    message: str


class Token(SQLModel):
    """OAuth2 token; `user` là snapshot profile khi login (tránh round-trip GET /accounts/me)."""

    access_token: str
    token_type: str = "bearer"
    user: AccountPublic | None = None


class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)
