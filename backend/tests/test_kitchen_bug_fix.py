"""
Test suite for the Kitchen (Cucina) bug fix on the Reports section.
Bug: Tapping the kitchen row toggled itemStatus to 'ready' unintentionally.
Fix: The row is now a non-interactive View; only the dedicated 'Completa' button toggles ready.

This test suite validates BACKEND behavior:
- Flagging an item with sendToKitchen=true does NOT change itemStatus (stays 'pending')
- The /api/kitchen aggregation returns groups with entries including itemStatus='pending' by default
- PUT /api/orders/{id}/items/by-index/{i}/status toggles itemStatus (used by 'Completa' button)
- PATCH /api/orders/{id}/items/by-index/{i} with sendToKitchen only, does NOT touch itemStatus
"""
import os
import pytest
import requests
from datetime import datetime, date

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
    """Ensure there's a menu for today with at least one dish + create an order with 1 item."""
    # Create a category + dish first (to have a dishId to use)
    cat_res = api.post(f"{BASE_URL}/api/categories", json={"name": "TEST_KitchenBugCat", "order": 999})
    assert cat_res.status_code == 200, cat_res.text
    cat_id = cat_res.json()["id"]

    dish_res = api.post(f"{BASE_URL}/api/dishes", json={
        "name": "TEST_KitchenBugDish",
        "description": "For kitchen bug test",
        "basePrice": 10.0,
        "categoryId": cat_id,
    })
    assert dish_res.status_code == 200, dish_res.text
    dish_id = dish_res.json()["id"]

    # Ensure menu for TODAY exists (skip if already there)
    menu_get = api.get(f"{BASE_URL}/api/menus/date/{TODAY}")
    if menu_get.status_code == 404:
        menu_res = api.post(f"{BASE_URL}/api/menus", json={"date": TODAY})
        assert menu_res.status_code == 200, menu_res.text
        menu_id = menu_res.json()["id"]
    else:
        menu_id = menu_get.json()["id"]

    # Add our test dish to menu with 20 portions
    add_res = api.post(f"{BASE_URL}/api/menus/{menu_id}/items", json={
        "dishId": dish_id, "portions": 20, "dailyPrice": 12.0, "notes": ""
    })
    # Might already exist; that's fine - continue if 400 for duplicate.
    if add_res.status_code not in (200, 400):
        pytest.fail(f"Menu add failed: {add_res.status_code} {add_res.text}")

    # Create an order
    order_res = api.post(
        f"{BASE_URL}/api/orders?menu_date={TODAY}",
        json={"channel": "persona", "serviceType": "in_sede", "customerName": "TEST_KitchenBugCustomer"}
    )
    assert order_res.status_code == 200, order_res.text
    order_id = order_res.json()["id"]

    # Add the dish as an item to this order
    add_item_res = api.post(f"{BASE_URL}/api/orders/{order_id}/items", json={
        "dishId": dish_id, "quantity": 2, "customPrice": 12.0, "notes": ""
    })
    assert add_item_res.status_code == 200, add_item_res.text

    data = {
        "cat_id": cat_id,
        "dish_id": dish_id,
        "menu_id": menu_id,
        "order_id": order_id,
    }
    yield data
    # Cleanup: delete order + dish + category
    api.delete(f"{BASE_URL}/api/orders/{order_id}")
    api.delete(f"{BASE_URL}/api/dishes/{dish_id}")
    api.delete(f"{BASE_URL}/api/categories/{cat_id}")


class TestKitchenBugFix:
    def test_flag_send_to_kitchen_keeps_pending(self, api, seed):
        """Flagging sendToKitchen=true on an item must NOT change itemStatus."""
        order_id = seed["order_id"]

        # Fetch item[0] initial itemStatus
        order = api.get(f"{BASE_URL}/api/orders/{order_id}").json()
        initial_status = order["items"][0].get("itemStatus", "pending")
        assert initial_status == "pending", f"Expected pending, got {initial_status}"

        # PATCH: sendToKitchen=true only
        res = api.patch(f"{BASE_URL}/api/orders/{order_id}/items/by-index/0",
                        json={"sendToKitchen": True})
        assert res.status_code == 200, res.text
        item = res.json()["items"][0]
        assert item["sendToKitchen"] is True
        # KEY ASSERTION: itemStatus must NOT be touched
        assert item.get("itemStatus", "pending") == "pending", \
            f"BUG: sendToKitchen flag changed itemStatus to {item.get('itemStatus')}"

    def test_kitchen_endpoint_returns_pending_by_default(self, api, seed):
        """GET /api/kitchen should return the flagged item with itemStatus='pending'."""
        res = api.get(f"{BASE_URL}/api/kitchen?menu_date={TODAY}")
        assert res.status_code == 200, res.text
        groups = res.json()
        # Find our TEST dish
        our_group = next((g for g in groups if g["dishName"] == "TEST_KitchenBugDish"), None)
        assert our_group is not None, f"Test dish not found in kitchen groups: {[g['dishName'] for g in groups]}"
        assert our_group["totalQuantity"] >= 2
        assert our_group["pendingQuantity"] >= 2
        # Entry must have itemStatus pending, orderId, itemIndex
        entry = next((e for e in our_group["entries"] if e["orderId"] == seed["order_id"]), None)
        assert entry is not None
        assert entry["itemStatus"] == "pending"
        assert entry["itemIndex"] == 0
        assert entry["quantity"] == 2

    def test_toggle_item_status_to_ready(self, api, seed):
        """PUT /api/orders/{id}/items/by-index/{i}/status - simulate 'Completa' button tap."""
        order_id = seed["order_id"]
        res = api.put(f"{BASE_URL}/api/orders/{order_id}/items/by-index/0/status",
                      json={"itemStatus": "ready"})
        assert res.status_code == 200, res.text
        item = res.json()["items"][0]
        assert item["itemStatus"] == "ready"

        # Verify kitchen aggregation reflects it
        kres = api.get(f"{BASE_URL}/api/kitchen?menu_date={TODAY}").json()
        our_group = next((g for g in kres if g["dishName"] == "TEST_KitchenBugDish"), None)
        assert our_group is not None
        entry = next(e for e in our_group["entries"] if e["orderId"] == order_id)
        assert entry["itemStatus"] == "ready"
        # pendingQuantity should have decreased by our qty (2)
        # totalQuantity stays the same

    def test_toggle_item_status_back_to_pending(self, api, seed):
        """Simulate 'Fatto' button tap: toggle back to pending."""
        order_id = seed["order_id"]
        res = api.put(f"{BASE_URL}/api/orders/{order_id}/items/by-index/0/status",
                      json={"itemStatus": "pending"})
        assert res.status_code == 200, res.text
        item = res.json()["items"][0]
        assert item["itemStatus"] == "pending"

    def test_patch_sendtokitchen_does_not_toggle_ready_when_pending(self, api, seed):
        """Repeated PATCH with sendToKitchen must never accidentally set itemStatus to 'ready'."""
        order_id = seed["order_id"]
        # Toggle off
        r1 = api.patch(f"{BASE_URL}/api/orders/{order_id}/items/by-index/0",
                       json={"sendToKitchen": False})
        assert r1.status_code == 200
        assert r1.json()["items"][0].get("itemStatus", "pending") == "pending"
        # Toggle on
        r2 = api.patch(f"{BASE_URL}/api/orders/{order_id}/items/by-index/0",
                       json={"sendToKitchen": True})
        assert r2.status_code == 200
        assert r2.json()["items"][0].get("itemStatus", "pending") == "pending"
