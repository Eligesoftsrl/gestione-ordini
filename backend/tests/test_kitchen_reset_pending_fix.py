"""
Test suite for the FIX: when the user activates sendToKitchen (false -> true)
on an order item, the backend must force itemStatus='pending' and recalculate
order.status. Deactivation (true -> false) must NOT touch itemStatus.
Also verifies regressions:
- PATCH other fields (quantity/notes) alone must NOT touch itemStatus
- GET /api/kitchen reflects reset propagation end-to-end
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


def _ensure_menu_and_dish(api, name_suffix):
    cat_res = api.post(f"{BASE_URL}/api/categories", json={"name": f"TEST_ResetCat_{name_suffix}", "order": 999})
    assert cat_res.status_code == 200, cat_res.text
    cat_id = cat_res.json()["id"]

    dish_res = api.post(f"{BASE_URL}/api/dishes", json={
        "name": f"TEST_ResetDish_{name_suffix}",
        "description": "Reset pending fix",
        "basePrice": 8.0,
        "categoryId": cat_id,
    })
    assert dish_res.status_code == 200, dish_res.text
    dish_id = dish_res.json()["id"]

    menu_get = api.get(f"{BASE_URL}/api/menus/date/{TODAY}")
    if menu_get.status_code == 404:
        menu_res = api.post(f"{BASE_URL}/api/menus", json={"date": TODAY})
        assert menu_res.status_code == 200, menu_res.text
        menu_id = menu_res.json()["id"]
    else:
        menu_id = menu_get.json()["id"]

    add_res = api.post(f"{BASE_URL}/api/menus/{menu_id}/items", json={
        "dishId": dish_id, "portions": 50, "dailyPrice": 9.0, "notes": ""
    })
    assert add_res.status_code in (200, 400), add_res.text
    return cat_id, dish_id, menu_id


def _create_order_with_item(api, dish_id, qty=2):
    order_res = api.post(
        f"{BASE_URL}/api/orders?menu_date={TODAY}",
        json={"channel": "persona", "serviceType": "in_sede", "customerName": "TEST_ResetCust"}
    )
    assert order_res.status_code == 200, order_res.text
    order_id = order_res.json()["id"]
    add_item_res = api.post(f"{BASE_URL}/api/orders/{order_id}/items", json={
        "dishId": dish_id, "quantity": qty, "customPrice": 9.0, "notes": ""
    })
    assert add_item_res.status_code == 200, add_item_res.text
    return order_id


def _set_item_status(api, order_id, idx, status):
    r = api.put(f"{BASE_URL}/api/orders/{order_id}/items/by-index/{idx}/status",
                json={"itemStatus": status})
    assert r.status_code == 200, r.text
    return r.json()


def _set_send_to_kitchen(api, order_id, idx, flag):
    r = api.patch(f"{BASE_URL}/api/orders/{order_id}/items/by-index/{idx}",
                  json={"sendToKitchen": flag})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def setup(api):
    created = []
    cat_id, dish_id, menu_id = _ensure_menu_and_dish(api, "MAIN")
    yield {"cat_id": cat_id, "dish_id": dish_id, "menu_id": menu_id, "orders": created}
    # Cleanup
    for oid in created:
        api.delete(f"{BASE_URL}/api/orders/{oid}")
    api.delete(f"{BASE_URL}/api/dishes/{dish_id}")
    api.delete(f"{BASE_URL}/api/categories/{cat_id}")


class TestKitchenActivationResetsPending:
    def test_activation_from_ready_resets_to_pending_and_status(self, api, setup):
        """CORE BUG FIX: item.itemStatus='ready' + sendToKitchen=false
           -> PATCH sendToKitchen=true -> itemStatus MUST become 'pending'
           and order.status MUST be recalculated (in_attesa for all-pending).
        """
        order_id = _create_order_with_item(api, setup["dish_id"], qty=2)
        setup["orders"].append(order_id)

        # Precondition: mark item[0] as ready (sendToKitchen still False by default)
        after_ready = _set_item_status(api, order_id, 0, "ready")
        assert after_ready["items"][0]["itemStatus"] == "ready"
        assert after_ready["items"][0].get("sendToKitchen", False) is False
        # Order should now be 'pronto' (all items ready)
        assert after_ready["status"] == "pronto", f"expected pronto, got {after_ready['status']}"

        # ACT: activate sendToKitchen
        resp = _set_send_to_kitchen(api, order_id, 0, True)
        item = resp["items"][0]
        assert item["sendToKitchen"] is True
        assert item["itemStatus"] == "pending", \
            f"BUG NOT FIXED: expected pending after activation, got {item['itemStatus']}"
        assert resp["status"] == "in_attesa", \
            f"Order status not recalculated. Expected in_attesa, got {resp['status']}"

        # GET verifies persistence
        got = api.get(f"{BASE_URL}/api/orders/{order_id}").json()
        assert got["items"][0]["itemStatus"] == "pending"
        assert got["status"] == "in_attesa"

    def test_deactivation_does_not_touch_itemStatus(self, api, setup):
        """Deactivation (true->false) must NOT reset itemStatus."""
        order_id = _create_order_with_item(api, setup["dish_id"], qty=1)
        setup["orders"].append(order_id)

        # Precondition: activate kitchen then set item ready
        _set_send_to_kitchen(api, order_id, 0, True)
        after_ready = _set_item_status(api, order_id, 0, "ready")
        assert after_ready["items"][0]["itemStatus"] == "ready"
        assert after_ready["items"][0]["sendToKitchen"] is True
        assert after_ready["status"] == "pronto"

        # ACT: deactivate kitchen
        resp = _set_send_to_kitchen(api, order_id, 0, False)
        item = resp["items"][0]
        assert item["sendToKitchen"] is False
        assert item["itemStatus"] == "ready", \
            f"Regression: deactivation touched itemStatus (now {item['itemStatus']})"
        # Order status: since kitchen_activated=False we do NOT recalc; stays pronto
        assert resp["status"] == "pronto", \
            f"Regression: deactivation changed order.status ({resp['status']})"

    def test_activation_from_pending_keeps_pending(self, api, setup):
        """Activation with itemStatus already pending -> stays pending, status recalculated."""
        order_id = _create_order_with_item(api, setup["dish_id"], qty=1)
        setup["orders"].append(order_id)

        resp = _set_send_to_kitchen(api, order_id, 0, True)
        item = resp["items"][0]
        assert item["itemStatus"] == "pending"
        assert item["sendToKitchen"] is True
        assert resp["status"] == "in_attesa"

    def test_activation_from_problem_resets_to_pending(self, api, setup):
        """Activation on 'problem' item resets to pending and recalculates status."""
        order_id = _create_order_with_item(api, setup["dish_id"], qty=1)
        setup["orders"].append(order_id)

        after_problem = _set_item_status(api, order_id, 0, "problem")
        assert after_problem["items"][0]["itemStatus"] == "problem"
        assert after_problem["status"] == "sospeso"

        resp = _set_send_to_kitchen(api, order_id, 0, True)
        item = resp["items"][0]
        assert item["itemStatus"] == "pending", \
            f"Expected pending after activation from problem, got {item['itemStatus']}"
        assert item["sendToKitchen"] is True
        assert resp["status"] == "in_attesa"

    def test_kitchen_endpoint_reflects_reset(self, api, setup):
        """GET /api/kitchen returns entry with itemStatus='pending' post-activation."""
        order_id = _create_order_with_item(api, setup["dish_id"], qty=3)
        setup["orders"].append(order_id)

        _set_item_status(api, order_id, 0, "ready")
        _set_send_to_kitchen(api, order_id, 0, True)

        kres = api.get(f"{BASE_URL}/api/kitchen?menu_date={TODAY}")
        assert kres.status_code == 200
        groups = kres.json()
        our_group = next((g for g in groups if g["dishName"] == "TEST_ResetDish_MAIN"), None)
        assert our_group is not None, "Test dish not found in kitchen aggregation"
        entry = next((e for e in our_group["entries"] if e["orderId"] == order_id), None)
        assert entry is not None
        assert entry["itemStatus"] == "pending", \
            f"Kitchen aggregation stale/wrong: {entry['itemStatus']}"
        assert entry["quantity"] == 3

    def test_activation_combined_with_other_fields(self, api, setup):
        """PATCH {sendToKitchen:true, quantity:3, notes:'x'} on ready item
           -> all updates applied AND itemStatus reset to pending, status recalc."""
        order_id = _create_order_with_item(api, setup["dish_id"], qty=1)
        setup["orders"].append(order_id)

        _set_item_status(api, order_id, 0, "ready")
        pre = api.get(f"{BASE_URL}/api/orders/{order_id}").json()
        assert pre["status"] == "pronto"

        r = api.patch(f"{BASE_URL}/api/orders/{order_id}/items/by-index/0",
                      json={"sendToKitchen": True, "quantity": 3, "notes": "combined-test"})
        assert r.status_code == 200, r.text
        body = r.json()
        item = body["items"][0]
        assert item["sendToKitchen"] is True
        assert item["quantity"] == 3
        assert item["notes"] == "combined-test"
        assert item["itemStatus"] == "pending"
        # subtotal must be recomputed
        assert item["subtotal"] == item["unitPrice"] * 3
        assert body["status"] == "in_attesa"

    def test_patch_quantity_only_does_not_touch_itemStatus(self, api, setup):
        """REGRESSION: PATCH quantity alone on a 'ready' item MUST NOT reset status."""
        order_id = _create_order_with_item(api, setup["dish_id"], qty=1)
        setup["orders"].append(order_id)

        _set_item_status(api, order_id, 0, "ready")
        r = api.patch(f"{BASE_URL}/api/orders/{order_id}/items/by-index/0",
                      json={"quantity": 4})
        assert r.status_code == 200, r.text
        item = r.json()["items"][0]
        assert item["quantity"] == 4
        assert item["itemStatus"] == "ready", \
            f"Regression: quantity-only PATCH touched itemStatus ({item['itemStatus']})"
        # Order should still be pronto because we didn't touch itemStatus
        assert r.json()["status"] == "pronto"

    def test_patch_notes_only_does_not_touch_itemStatus(self, api, setup):
        """REGRESSION: PATCH notes alone must NOT reset itemStatus."""
        order_id = _create_order_with_item(api, setup["dish_id"], qty=1)
        setup["orders"].append(order_id)

        _set_item_status(api, order_id, 0, "ready")
        r = api.patch(f"{BASE_URL}/api/orders/{order_id}/items/by-index/0",
                      json={"notes": "just-notes"})
        assert r.status_code == 200, r.text
        item = r.json()["items"][0]
        assert item["notes"] == "just-notes"
        assert item["itemStatus"] == "ready"
        assert r.json()["status"] == "pronto"

    def test_repeated_activation_is_idempotent(self, api, setup):
        """Calling PATCH sendToKitchen=true twice: second call is NOT a transition,
           so it should NOT reset a subsequent 'ready' status.
        """
        order_id = _create_order_with_item(api, setup["dish_id"], qty=1)
        setup["orders"].append(order_id)

        # First activation (from default False)
        r1 = _set_send_to_kitchen(api, order_id, 0, True)
        assert r1["items"][0]["sendToKitchen"] is True
        assert r1["items"][0]["itemStatus"] == "pending"

        # Now mark ready
        after_ready = _set_item_status(api, order_id, 0, "ready")
        assert after_ready["items"][0]["itemStatus"] == "ready"
        assert after_ready["status"] == "pronto"

        # Second "activation" call: sendToKitchen was already True, no transition
        r2 = _set_send_to_kitchen(api, order_id, 0, True)
        item = r2["items"][0]
        # Since kitchen was already active, no reset should be triggered
        assert item["sendToKitchen"] is True
        assert item["itemStatus"] == "ready", \
            f"Regression: repeated activation reset itemStatus ({item['itemStatus']})"
        assert r2["status"] == "pronto"
