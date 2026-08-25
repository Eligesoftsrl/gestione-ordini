"""
Regression tests for calculate_order_status via PUT /api/orders/{id}/items/by-index/{i}/status.
Expected state transitions:
  - all pending -> in_attesa
  - mix (some ready + some pending) -> in_preparazione
  - all ready -> pronto
  - any problem -> sospeso
"""
import os
import pytest
import requests
from datetime import date

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('REACT_APP_BACKEND_URL')
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"
BASE_URL = BASE_URL.rstrip('/')

TODAY = date.today().isoformat()


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def seed(api):
    cat = api.post(f"{BASE_URL}/api/categories", json={"name": "TEST_StatusCat", "order": 998}).json()
    dish = api.post(f"{BASE_URL}/api/dishes", json={
        "name": "TEST_StatusDish", "basePrice": 5.0, "categoryId": cat["id"]
    }).json()

    menu_get = api.get(f"{BASE_URL}/api/menus/date/{TODAY}")
    if menu_get.status_code == 404:
        menu = api.post(f"{BASE_URL}/api/menus", json={"date": TODAY}).json()
    else:
        menu = menu_get.json()

    api.post(f"{BASE_URL}/api/menus/{menu['id']}/items",
             json={"dishId": dish["id"], "portions": 50, "dailyPrice": 5.0, "notes": ""})

    order = api.post(f"{BASE_URL}/api/orders?menu_date={TODAY}",
                     json={"channel": "persona", "serviceType": "in_sede",
                           "customerName": "TEST_StatusCustomer"}).json()
    # add 2 items
    api.post(f"{BASE_URL}/api/orders/{order['id']}/items",
             json={"dishId": dish["id"], "quantity": 1, "customPrice": 5.0})
    api.post(f"{BASE_URL}/api/orders/{order['id']}/items",
             json={"dishId": dish["id"], "quantity": 1, "customPrice": 5.0})

    yield {"order_id": order["id"], "dish_id": dish["id"], "cat_id": cat["id"]}

    api.delete(f"{BASE_URL}/api/orders/{order['id']}")
    api.delete(f"{BASE_URL}/api/dishes/{dish['id']}")
    api.delete(f"{BASE_URL}/api/categories/{cat['id']}")


def _set(api, order_id, idx, status):
    return api.put(f"{BASE_URL}/api/orders/{order_id}/items/by-index/{idx}/status",
                   json={"itemStatus": status})


def test_all_pending_is_in_attesa(api, seed):
    _set(api, seed["order_id"], 0, "pending")
    r = _set(api, seed["order_id"], 1, "pending")
    assert r.status_code == 200
    assert r.json()["status"] == "in_attesa"


def test_mix_ready_and_pending_is_in_preparazione(api, seed):
    _set(api, seed["order_id"], 0, "ready")
    _set(api, seed["order_id"], 1, "pending")
    order = api.get(f"{BASE_URL}/api/orders/{seed['order_id']}").json()
    assert order["status"] == "in_preparazione"


def test_all_ready_is_pronto(api, seed):
    _set(api, seed["order_id"], 0, "ready")
    r = _set(api, seed["order_id"], 1, "ready")
    assert r.json()["status"] == "pronto"


def test_any_problem_is_sospeso(api, seed):
    _set(api, seed["order_id"], 0, "problem")
    r = _set(api, seed["order_id"], 1, "ready")
    assert r.json()["status"] == "sospeso"
    # reset for cleanup safety
    _set(api, seed["order_id"], 0, "pending")
    _set(api, seed["order_id"], 1, "pending")
