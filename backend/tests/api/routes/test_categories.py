from fastapi.testclient import TestClient

from app.core.config import settings


def test_categories_list_requires_auth(client: TestClient) -> None:
    r = client.get(f"{settings.API_V1_STR}/categories/")
    assert r.status_code == 401


def test_categories_list_as_normal_user(client: TestClient, normal_user_token_headers: dict[str, str]) -> None:
    r = client.get(f"{settings.API_V1_STR}/categories/", headers=normal_user_token_headers)
    assert r.status_code == 200
    body = r.json()
    assert "data" in body
    assert "count" in body


def test_create_category_as_admin(client: TestClient, superuser_token_headers: dict[str, str]) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/categories/",
        headers=superuser_token_headers,
        json={"name": "Nhóm A", "description": "Mô tả", "parent_id": None},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Nhóm A"
    cid = data["id"]

    r2 = client.get(f"{settings.API_V1_STR}/categories/{cid}", headers=superuser_token_headers)
    assert r2.status_code == 200
    assert r2.json()["name"] == "Nhóm A"


def test_create_category_forbidden_for_non_admin(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/categories/",
        headers=normal_user_token_headers,
        json={"name": "Hack"},
    )
    assert r.status_code == 403


def test_create_category_with_children_one_request(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/categories/with-children",
        headers=superuser_token_headers,
        json={
            "name": "Nhóm bundle",
            "description": "cha",
            "children": [
                {"name": "Con 1", "description": "a"},
                {"name": "Con 2"},
            ],
        },
    )
    assert r.status_code == 200
    parent = r.json()
    assert parent["name"] == "Nhóm bundle"
    pid = parent["id"]

    listed = client.get(
        f"{settings.API_V1_STR}/categories/",
        headers=superuser_token_headers,
        params={"parent_id": pid, "limit": 50},
    )
    assert listed.status_code == 200
    kids = listed.json()["data"]
    names = {x["name"] for x in kids}
    assert names == {"Con 1", "Con 2"}
