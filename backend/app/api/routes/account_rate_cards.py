import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import and_, func
from sqlmodel import Session, col, select

from app.api.deps import CurrentAccount, SessionDep
from app.models import (
    Account,
    AccountRateCard,
    AccountRateCardCreate,
    AccountRateCardPublic,
    AccountRateCardResolvedListPublic,
    AccountRateCardResolvedPublic,
    AccountRole,
    Category,
)

router = APIRouter(prefix="/account-rate-cards", tags=["account-rate-cards"])


def _account_in_scope(session: Session, current: Account, account_id: uuid.UUID) -> bool:
    if current.role == AccountRole.admin:
        return session.get(Account, account_id) is not None
    if current.id == account_id:
        return True
    target = session.get(Account, account_id)
    if target is None:
        return False
    if current.role == AccountRole.user_level_1:
        return target.parent_id == current.id
    return False


@router.get("/by-account/{account_id}", response_model=AccountRateCardResolvedListPublic)
def read_effective_rate_cards_by_account(
    account_id: uuid.UUID,
    session: SessionDep,
    current_account: CurrentAccount,
) -> Any:
    if not _account_in_scope(session, current_account, account_id):
        raise HTTPException(
            status_code=403,
            detail="The account doesn't have enough privileges",
        )

    # Always return all root categories; missing pricing defaults to 0 / null effective_date.
    root_categories = session.exec(
        select(Category).where(col(Category.parent_id).is_(None)).order_by(col(Category.name))
    ).all()

    utc_now = datetime.now(timezone.utc)
    ranked_subquery = (
        select(
            AccountRateCard.category_id.label("category_id"),
            AccountRateCard.unit_rate.label("unit_rate"),
            AccountRateCard.surcharge.label("surcharge"),
            AccountRateCard.effective_date.label("effective_date"),
            func.row_number()
            .over(
                partition_by=AccountRateCard.category_id,
                order_by=(
                    AccountRateCard.effective_date.desc(),
                    AccountRateCard.created_at.desc(),
                ),
            )
            .label("rn"),
        )
        .where(
            and_(
                AccountRateCard.account_id == account_id,
                AccountRateCard.effective_date <= utc_now,
            )
        )
        .subquery()
    )

    latest_rows = session.exec(
        select(
            ranked_subquery.c.category_id,
            ranked_subquery.c.unit_rate,
            ranked_subquery.c.surcharge,
            ranked_subquery.c.effective_date,
        ).where(ranked_subquery.c.rn == 1)
    ).all()
    latest_by_category = {row.category_id: row for row in latest_rows}

    data: list[AccountRateCardResolvedPublic] = []
    for category in root_categories:
        latest = latest_by_category.get(category.id)
        data.append(
            AccountRateCardResolvedPublic(
                category_id=category.id,
                category_name=category.name,
                unit_rate=(latest.unit_rate if latest else Decimal("0")),
                surcharge=(latest.surcharge if latest else Decimal("0")),
                effective_date=(latest.effective_date if latest else None),
            )
        )

    return AccountRateCardResolvedListPublic(
        account_id=account_id,
        effective_on=utc_now.date(),
        data=data,
        count=len(data),
    )


@router.post("/", response_model=AccountRateCardPublic)
def create_account_rate_card(
    *,
    session: SessionDep,
    current_account: CurrentAccount,
    body: AccountRateCardCreate,
) -> Any:
    if not _account_in_scope(session, current_account, body.account_id):
        raise HTTPException(
            status_code=403,
            detail="The account doesn't have enough privileges",
        )

    category = session.get(Category, body.category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    utc_today = datetime.now(timezone.utc).date()
    if body.effective_date.date() < utc_today:
        raise HTTPException(
            status_code=400,
            detail="effective_date must be today or a future date (UTC date)",
        )

    row = AccountRateCard(
        account_id=body.account_id,
        category_id=body.category_id,
        unit_rate=body.unit_rate,
        surcharge=body.surcharge,
        effective_date=body.effective_date,
        created_by_id=current_account.id,
        updated_by_id=current_account.id,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row
