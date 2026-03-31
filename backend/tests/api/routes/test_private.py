from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import Account


def test_create_account_private(client: TestClient, db: Session) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/private/accounts/",
        json={
            "email": "pollo@listo.com",
            "password": "password123",
            "full_name": "Pollo Listo",
        },
    )

    assert r.status_code == 200

    data = r.json()

    user = db.exec(select(Account).where(Account.id == data["id"])).first()

    assert user
    assert user.email == "pollo@listo.com"
    assert user.full_name == "Pollo Listo"
