"""
Backend tests for the Porzionatura feature and related bug fixes.
Covers:
- GET /api/porzionatura structure & totals
- Mutual exclusivity Kitchen vs Porzionatura (sendToKitchen)
- Quantity correctness (sum of entries == totalQuantity)
- daily-summary / top-dishes custom-item separation (dishId=None)
- Status toggle via PUT /orders/{id}/items/by-index/{i}/status recalculates order.status
- Regression: PATCH sendToKitchen=true resets itemStatus to pending
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://bancos-menu-portal.preview.emergentagent.com").rstrip("/")
MENU_DATE = "2026-06-22"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Porzionatura endpoint ----------

class TestPorzionaturaEndpoint:
    def test_returns_200_and_list(self, api):
        r = api.get(f"{BASE_URL}/api/porzionatura", params={"menu_date": MENU_DATE})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Expected seeded data on 2026-06-22"

    def test_group_shape(self, api):
        r = api.get(f"{BASE_URL}/api/porzionatura", params={"menu_date": MENU_DATE})
        for g in r.json():
            assert set(["dishName", "totalQuantity", "pendingQuantity", "entries"]).issubset(g.keys())
            assert isinstance(g["entries"], list)
            for e in g["entries"]:
                for k in ["orderId", "orderNumber", "itemIndex", "quantity",
                          "customerName", "serviceType", "deliveryTime",
                          "notes", "itemStatus", "isCustomItem"]:
                    assert k in e, f"missing key {k} in entry"

    def test_sorted_alphabetically(self, api):
        r = api.get(f"{BASE_URL}/api/porzionatura", params={"menu_date": MENU_DATE})
        names = [g["dishName"].lower() for g in r.json()]
        assert names == sorted(names)

    def test_total_quantity_equals_sum_of_entries(self, api):
        r = api.get(f"{BASE_URL}/api/porzionatura", params={"menu_date": MENU_DATE})
        for g in r.json():
            expected = sum(e["quantity"] for e in g["entries"])
            assert g["totalQuantity"] == expected, f"totalQuantity mismatch for {g['dishName']}"

    def test_pasta_zucchine_qty_3_single_entry(self, api):
        """The seed order has Pasta e Zucchine with quantity=3 as a single entry."""
        r = api.get(f"{BASE_URL}/api/porzionatura", params={"menu_date": MENU_DATE})
        pz = [g for g in r.json() if g["dishName"].lower() == "pasta e zucchine"]
        assert len(pz) == 1
        assert pz[0]["totalQuantity"] == 3
        assert len(pz[0]["entries"]) == 1
        assert pz[0]["entries"][0]["quantity"] == 3


# ---------- Mutual exclusivity with Kitchen ----------

class TestKitchenPorzionaturaMutualExclusivity:
    def _find_target(self, api):
        """Pick an item that has sendToKitchen=false in porzionatura."""
        r = api.get(f"{BASE_URL}/api/porzionatura", params={"menu_date": MENU_DATE})
        for g in r.json():
            for e in g["entries"]:
                return e, g["dishName"]
        pytest.skip("No porzionatura entries")

    def test_flag_sendtokitchen_moves_item(self, api):
        entry, dish_name = self._find_target(api)
        order_id, idx = entry["orderId"], entry["itemIndex"]

        # Flip sendToKitchen -> True
        r = api.patch(
            f"{BASE_URL}/api/orders/{order_id}/items/by-index/{idx}",
            json={"sendToKitchen": True},
        )
        assert r.status_code == 200, r.text

        try:
            # Should now appear in /kitchen
            k = api.get(f"{BASE_URL}/api/kitchen", params={"menu_date": MENU_DATE}).json()
            in_kitchen = any(
                any(e["orderId"] == order_id and e["itemIndex"] == idx for e in g["entries"])
                for g in k
            )
            assert in_kitchen, "Item should be visible in /kitchen after sendToKitchen=true"

            # Should NOT appear in /porzionatura
            p = api.get(f"{BASE_URL}/api/porzionatura", params={"menu_date": MENU_DATE}).json()
            in_porz = any(
                any(e["orderId"] == order_id and e["itemIndex"] == idx for e in g["entries"])
                for g in p
            )
            assert not in_porz, "Item should NOT be in /porzionatura after sendToKitchen=true"

            # Regression: itemStatus must be reset to pending after activation
            k = api.get(f"{BASE_URL}/api/kitchen", params={"menu_date": MENU_DATE}).json()
            for g in k:
                for e in g["entries"]:
                    if e["orderId"] == order_id and e["itemIndex"] == idx:
                        assert e["itemStatus"] == "pending", \
                            f"itemStatus should reset to pending, got {e['itemStatus']}"
        finally:
            # Restore: flip back
            api.patch(
                f"{BASE_URL}/api/orders/{order_id}/items/by-index/{idx}",
                json={"sendToKitchen": False},
            )


# ---------- Status toggle recalculates order.status ----------

class TestStatusToggleRecalc:
    def test_all_ready_makes_order_pronto_then_reverse(self, api):
        """Set all porzionatura items to ready → order.status should become pronto,
        then reverse one → order.status should recalc away from pronto."""
        p = api.get(f"{BASE_URL}/api/porzionatura", params={"menu_date": MENU_DATE}).json()
        entries = [(e["orderId"], e["itemIndex"]) for g in p for e in g["entries"]]
        if not entries:
            pytest.skip("No entries")

        order_id = entries[0][0]
        # Get initial order state
        o0 = api.get(f"{BASE_URL}/api/orders/{order_id}").json()
        initial_statuses = [it.get("itemStatus", "pending") for it in o0["items"]]
        # Collect items of this order in porzionatura + also kitchen (all items need to be ready for order pronto)
        all_items_indexes = list(range(len(o0["items"])))

        try:
            # Set all items to ready
            for i in all_items_indexes:
                r = api.put(
                    f"{BASE_URL}/api/orders/{order_id}/items/by-index/{i}/status",
                    json={"itemStatus": "ready"},
                )
                assert r.status_code == 200, r.text
            o1 = api.get(f"{BASE_URL}/api/orders/{order_id}").json()
            # If order was in a "closed" state (consegnato/annullato), calc may keep it,
            # so we accept pronto OR unchanged closed state.
            if o0["status"] not in ("consegnato", "annullato"):
                assert o1["status"] == "pronto", f"Expected pronto, got {o1['status']}"

            # Reverse: set item 0 back to pending
            r = api.put(
                f"{BASE_URL}/api/orders/{order_id}/items/by-index/0/status",
                json={"itemStatus": "pending"},
            )
            assert r.status_code == 200
            o2 = api.get(f"{BASE_URL}/api/orders/{order_id}").json()
            if o0["status"] not in ("consegnato", "annullato"):
                assert o2["status"] != "pronto", "Order should recalc away from pronto"
        finally:
            # Restore initial itemStatus values
            for i, st in enumerate(initial_statuses):
                api.put(
                    f"{BASE_URL}/api/orders/{order_id}/items/by-index/{i}/status",
                    json={"itemStatus": st},
                )


# ---------- Custom-dish separation in reports ----------

class TestCustomDishSeparation:
    def test_daily_summary_separates_custom_items(self, api):
        r = api.get(f"{BASE_URL}/api/reports/daily-summary", params={"date": MENU_DATE})
        assert r.status_code == 200
        data = r.json()
        sales = data["dishSales"]
        names = [s["dishName"].lower() for s in sales]
        # 4 different Insalata custom variants should be separate entries
        insalata_variants = [n for n in names if n.startswith("insalata")]
        assert len(insalata_variants) >= 2, \
            f"Expected multiple insalata custom variants as separate entries, got {insalata_variants}"
        # Also totals must be > 0
        for s in sales:
            assert s["quantity"] > 0

    def test_top_dishes_separates_custom_items(self, api):
        r = api.get(f"{BASE_URL}/api/reports/top-dishes",
                    params={"start_date": MENU_DATE, "end_date": MENU_DATE, "limit": 50})
        assert r.status_code == 200
        data = r.json()
        names = [d["dishName"].lower() for d in data]
        insalata_variants = [n for n in names if n.startswith("insalata")]
        assert len(insalata_variants) >= 2, \
            f"Expected multiple insalata custom variants in top-dishes, got {insalata_variants}"
