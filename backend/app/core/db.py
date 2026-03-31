from sqlmodel import Session, create_engine, select

from app import crud
from app.core.config import settings
from app.models import Account, AccountCreate, AccountRole

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/fastapi/full-stack-fastapi-template/issues/28


def init_db(session: Session) -> None:
    # Tables should be created with Alembic migrations
    # But if you don't want to use migrations, create
    # the tables un-commenting the next lines
    # from sqlmodel import SQLModel

    # This works because the models are already imported and registered from app.models
    # SQLModel.metadata.create_all(engine)

    account = session.exec(
        select(Account).where(Account.email == settings.FIRST_SUPERUSER)
    ).first()
    if not account:
        account_in = AccountCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            full_name="Administrator",
            phone=None,
            description=None,
            role=AccountRole.admin,
            parent_id=None,
        )
        crud.create_account(
            session=session,
            account_create=account_in,
            created_by_id=None,
        )
