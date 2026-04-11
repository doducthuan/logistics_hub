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
    RateCard,
    RateCardCreate,
    RateCardHistoryEntryPublic,
    RateCardHistoryPublic,
    RateCardPublic,
    RateCardResolvedListPublic,
    RateCardResolvedPublic,
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


@router.get("/by-account/{account_id}", response_model=RateCardResolvedListPublic)
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
            RateCard.category_id.label("category_id"),
            RateCard.unit_rate.label("unit_rate"),
            RateCard.surcharge.label("surcharge"),
            RateCard.effective_date.label("effective_date"),
            func.row_number()
            .over(
                partition_by=RateCard.category_id,
                order_by=(
                    RateCard.effective_date.desc(),
                    RateCard.created_at.desc(),
                ),
            )
            .label("rn"),
        )
        .where(
            and_(
                RateCard.account_id == account_id,
                RateCard.effective_date <= utc_now,
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

    data: list[RateCardResolvedPublic] = []
    for category in root_categories:
        latest = latest_by_category.get(category.id)
        data.append(
            RateCardResolvedPublic(
                category_id=category.id,
                category_name=category.name,
                unit_rate=(latest.unit_rate if latest else Decimal("0")),
                surcharge=(latest.surcharge if latest else Decimal("0")),
                effective_date=(latest.effective_date if latest else None),
            )
        )

    return RateCardResolvedListPublic(
        account_id=account_id,
        effective_on=utc_now.date(),
        data=data,
        count=len(data),
    )


@router.get(
    "/by-account/{account_id}/category/{category_id}/history",
    response_model=RateCardHistoryPublic,
)
def read_rate_card_history_for_category(
    account_id: uuid.UUID,
    category_id: uuid.UUID,
    session: SessionDep,
    current_account: CurrentAccount,
) -> Any:
    if not _account_in_scope(session, current_account, account_id):
        raise HTTPException(
            status_code=403,
            detail="The account doesn't have enough privileges",
        )

    category = session.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    rows = session.exec(
        select(RateCard)
        .where(
            RateCard.account_id == account_id,
            RateCard.category_id == category_id,
        )
        .order_by(
            col(RateCard.effective_date).desc(),
            col(RateCard.created_at).desc(),
        )
    ).all()

    utc_now = datetime.now(timezone.utc)
    past_or_now = [r for r in rows if r.effective_date <= utc_now]
    active: RateCard | None = None
    if past_or_now:
        active = max(past_or_now, key=lambda r: (r.effective_date, r.created_at or datetime.min.replace(tzinfo=timezone.utc)))

    history: list[RateCardHistoryEntryPublic] = []
    for row in rows:
        is_current = active is not None and row.id == active.id
        history.append(
            RateCardHistoryEntryPublic(
                effective_date=row.effective_date,
                unit_rate=row.unit_rate,
                surcharge=row.surcharge,
                is_currently_effective=is_current,
            )
        )

    return RateCardHistoryPublic(
        account_id=account_id,
        category_id=category_id,
        category_name=category.name,
        data=history,
        count=len(history),
    )


@router.post("/", response_model=RateCardPublic)
def create_account_rate_card(
    *,
    session: SessionDep,
    current_account: CurrentAccount,
    body: RateCardCreate,
) -> Any:
    if not _account_in_scope(session, current_account, body.account_id):
        raise HTTPException(
            status_code=403,
            detail="The account doesn't have enough privileges",
        )

    if body.account_id == current_account.id:
        raise HTTPException(
            status_code=403,
            detail="Cannot create rate card versions for your own account; view only.",
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

    row = RateCard(
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
