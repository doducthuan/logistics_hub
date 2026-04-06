import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlmodel import Session, col, func, select

from app import crud
from app.api.deps import CurrentAccount, SessionDep, get_current_active_admin
from app.models import (
    Account,
    CategoriesPublic,
    Category,
    CategoryCreate,
    CategoryPublic,
    CategoryUpdate,
    Message,
)

router = APIRouter(prefix="/categories", tags=["categories"])

CurrentAdmin = Annotated[Account, Depends(get_current_active_admin)]


def _collect_audit_ids(categories: list[Category]) -> set[uuid.UUID]:
    ids: set[uuid.UUID] = set()
    for c in categories:
        if c.created_by_id is not None:
            ids.add(c.created_by_id)
        if c.updated_by_id is not None:
            ids.add(c.updated_by_id)
    return ids


def _audit_name_map(session: Session, account_ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not account_ids:
        return {}
    rows = session.exec(select(Account).where(col(Account.id).in_(account_ids))).all()
    return {a.id: a.full_name for a in rows}


def _category_to_public(category: Category, name_by_id: dict[uuid.UUID, str]) -> CategoryPublic:
    return CategoryPublic(
        id=category.id,
        name=category.name,
        description=category.description,
        parent_id=category.parent_id,
        created_at=category.created_at,
        updated_at=category.updated_at,
        created_by_id=category.created_by_id,
        updated_by_id=category.updated_by_id,
        is_active=category.is_active,
        created_by_full_name=name_by_id.get(category.created_by_id) if category.created_by_id else None,
        updated_by_full_name=name_by_id.get(category.updated_by_id) if category.updated_by_id else None,
    )


@router.get("/", response_model=CategoriesPublic)
def read_categories(
    session: SessionDep,
    _auth: CurrentAccount,
    parent_id: Annotated[
        uuid.UUID | None,
        Query(description="Bỏ qua để lấy các loại gốc (parent_id null)"),
    ] = None,
    keyword: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """Mọi user đăng nhập đều xem được."""
    statement = select(Category)
    if parent_id is None:
        statement = statement.where(col(Category.parent_id).is_(None))
    else:
        statement = statement.where(Category.parent_id == parent_id)

    if keyword:
        search = f"%{keyword.strip()}%"
        if search != "%%":
            statement = statement.where(
                or_(
                    Category.name.ilike(search),
                    Category.description.ilike(search),
                )
            )

    count_statement = select(func.count()).select_from(statement.subquery())
    count = session.exec(count_statement).one()

    statement = statement.order_by(col(Category.created_at).desc()).offset(skip).limit(limit)
    rows = list(session.exec(statement).all())
    name_by_id = _audit_name_map(session, _collect_audit_ids(rows))
    return CategoriesPublic(
        data=[_category_to_public(c, name_by_id) for c in rows],
        count=count,
    )


@router.get("/{category_id}", response_model=CategoryPublic)
def read_category(
    category_id: uuid.UUID,
    session: SessionDep,
    _auth: CurrentAccount,
) -> Any:
    """Chi tiết một loại — mọi user đăng nhập."""
    row = session.get(Category, category_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Category not found")
    audit_ids = {x for x in (row.created_by_id, row.updated_by_id) if x is not None}
    name_by_id = _audit_name_map(session, audit_ids)
    return _category_to_public(row, name_by_id)


@router.post("/", response_model=CategoryPublic)
def create_category(
    *,
    session: SessionDep,
    admin: CurrentAdmin,
    body: CategoryCreate,
) -> Any:
    """Chỉ admin."""
    try:
        db_row = crud.create_category(
            session=session,
            category_in=body,
            created_by_id=admin.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    audit_ids = {x for x in (db_row.created_by_id, db_row.updated_by_id) if x is not None}
    return _category_to_public(db_row, _audit_name_map(session, audit_ids))


@router.patch("/{category_id}", response_model=CategoryPublic)
def update_category(
    *,
    session: SessionDep,
    admin: CurrentAdmin,
    category_id: uuid.UUID,
    body: CategoryUpdate,
) -> Any:
    """Chỉ admin."""
    db_row = session.get(Category, category_id)
    if db_row is None:
        raise HTTPException(status_code=404, detail="Category not found")
    try:
        updated = crud.update_category(
            session=session,
            db_category=db_row,
            category_in=body,
            updated_by_id=admin.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    audit_ids = {x for x in (updated.created_by_id, updated.updated_by_id) if x is not None}
    return _category_to_public(updated, _audit_name_map(session, audit_ids))


@router.delete("/{category_id}", response_model=Message)
def delete_category(
    session: SessionDep,
    _admin: CurrentAdmin,
    category_id: uuid.UUID,
) -> Any:
    """Chỉ admin; không xóa khi còn loại con."""
    db_row = session.get(Category, category_id)
    if db_row is None:
        raise HTTPException(status_code=404, detail="Category not found")
    if crud.category_has_children(session=session, category_id=category_id):
        raise HTTPException(
            status_code=400,
            detail="Cannot delete category that still has child categories",
        )
    session.delete(db_row)
    session.commit()
    return Message(message="Category deleted successfully")
