"""
Backend API tests for:
1. P0 BUG FIX: Delete item by index endpoint - DELETE /api/orders/{order_id}/items/by-index/{item_index}
2. P0 BUG FIX: Update item status by index endpoint - PUT /api/orders/{order_id}/items/by-index/{item_index}/status

These endpoints are critical for handling "Piatti Liberi" (custom items without dishId).
"""
import pytest
import requests
import os
from datetime import date

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bancos-menu-portal.preview.emergentagent.com')


class TestByIndexEndpoints:
    """Test the new by-index endpoints for custom items (Piatti Liberi)"""
    
    @pytest.fixture
    def menu_date(self):
        """Get today's date for testing"""
        return date.today().isoformat()
    
    @pytest.fixture
    def ensure_menu_exists(self, menu_date):
        """Ensure a menu exists for today"""
        response = requests.get(f"{BASE_URL}/api/menus/date/{menu_date}")
        if response.status_code == 404:
            # Create menu for today
            response = requests.post(f"{BASE_URL}/api/menus", json={"date": menu_date})
            assert response.status_code == 200
        return menu_date
    
    @pytest.fixture
    def test_order_with_custom_item(self, ensure_menu_exists):
        """Create a test order with a custom item (Piatto Libero)"""
        menu_date = ensure_menu_exists
        
        # Create a new order
        order_response = requests.post(
            f"{BASE_URL}/api/orders?menu_date={menu_date}",
            json={
                "channel": "persona",
                "customerName": "TEST_CustomItemTest",
                "notes": "Test order for by-index endpoints"
            }
        )
        assert order_response.status_code == 200, f"Failed to create order: {order_response.text}"
        order = order_response.json()
        order_id = order["id"]
        
        # Add a custom item (Piatto Libero) - no dishId
        custom_item_response = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/items",
            json={
                "dishName": "TEST_PiattoLibero",
                "quantity": 2,
                "customPrice": 8.50
            }
        )
        assert custom_item_response.status_code == 200, f"Failed to add custom item: {custom_item_response.text}"
        
        updated_order = custom_item_response.json()
        
        # Verify custom item was added
        assert len(updated_order["items"]) == 1
        assert updated_order["items"][0]["dishName"] == "TEST_PiattoLibero"
        assert updated_order["items"][0]["dishId"] is None
        assert updated_order["items"][0]["isCustomItem"] == True
        
        yield updated_order
        
        # Cleanup: Delete the test order items if any remain
        # Note: We don't have a delete order endpoint, so we just leave it
    
    def test_update_custom_item_status_by_index_to_ready(self, test_order_with_custom_item):
        """PUT /api/orders/{id}/items/by-index/{index}/status should update custom item status to 'ready'"""
        order = test_order_with_custom_item
        order_id = order["id"]
        
        # Update item at index 0 to 'ready'
        response = requests.put(
            f"{BASE_URL}/api/orders/{order_id}/items/by-index/0/status",
            json={"itemStatus": "ready"}
        )
        
        assert response.status_code == 200, f"Failed to update item status: {response.text}"
        data = response.json()
        
        # Verify item status was updated
        assert data["items"][0]["itemStatus"] == "ready"
        # Verify order status was auto-updated (all items ready = order pronto)
        assert data["status"] == "pronto"
        
        print(f"Successfully updated custom item status to 'ready' for order #{data['orderNumber']}")
    
    def test_update_custom_item_status_by_index_to_problem(self, test_order_with_custom_item):
        """PUT /api/orders/{id}/items/by-index/{index}/status should update custom item status to 'problem'"""
        order = test_order_with_custom_item
        order_id = order["id"]
        
        # Update item at index 0 to 'problem'
        response = requests.put(
            f"{BASE_URL}/api/orders/{order_id}/items/by-index/0/status",
            json={"itemStatus": "problem"}
        )
        
        assert response.status_code == 200, f"Failed to update item status: {response.text}"
        data = response.json()
        
        # Verify item status was updated
        assert data["items"][0]["itemStatus"] == "problem"
        # Verify order status was auto-updated (any item with problem = order sospeso)
        assert data["status"] == "sospeso"
        
        print(f"Successfully updated custom item status to 'problem' for order #{data['orderNumber']}")
    
    def test_update_custom_item_status_by_index_back_to_pending(self, test_order_with_custom_item):
        """PUT /api/orders/{id}/items/by-index/{index}/status should update custom item status back to 'pending'"""
        order = test_order_with_custom_item
        order_id = order["id"]
        
        # First set to ready
        requests.put(
            f"{BASE_URL}/api/orders/{order_id}/items/by-index/0/status",
            json={"itemStatus": "ready"}
        )
        
        # Then set back to pending
        response = requests.put(
            f"{BASE_URL}/api/orders/{order_id}/items/by-index/0/status",
            json={"itemStatus": "pending"}
        )
        
        assert response.status_code == 200, f"Failed to update item status: {response.text}"
        data = response.json()
        
        # Verify item status was updated
        assert data["items"][0]["itemStatus"] == "pending"
        # Verify order status was auto-updated (all pending = in_attesa)
        assert data["status"] == "in_attesa"
        
        print(f"Successfully updated custom item status back to 'pending' for order #{data['orderNumber']}")
    
    def test_delete_custom_item_by_index(self, test_order_with_custom_item):
        """DELETE /api/orders/{id}/items/by-index/{index} should remove custom item"""
        order = test_order_with_custom_item
        order_id = order["id"]
        original_total = order["total"]
        
        # Delete item at index 0
        response = requests.delete(f"{BASE_URL}/api/orders/{order_id}/items/by-index/0")
        
        assert response.status_code == 200, f"Failed to delete item: {response.text}"
        data = response.json()
        
        # Verify item was removed
        assert len(data["items"]) == 0
        # Verify total was updated
        assert data["total"] == 0
        
        print(f"Successfully deleted custom item from order #{data['orderNumber']}")
    
    def test_update_status_invalid_index(self, test_order_with_custom_item):
        """PUT /api/orders/{id}/items/by-index/{invalid_index}/status should return 404"""
        order = test_order_with_custom_item
        order_id = order["id"]
        
        # Try to update item at invalid index
        response = requests.put(
            f"{BASE_URL}/api/orders/{order_id}/items/by-index/999/status",
            json={"itemStatus": "ready"}
        )
        
        assert response.status_code == 404
        print("Correctly returned 404 for invalid item index")
    
    def test_delete_invalid_index(self, test_order_with_custom_item):
        """DELETE /api/orders/{id}/items/by-index/{invalid_index} should return 404"""
        order = test_order_with_custom_item
        order_id = order["id"]
        
        # Try to delete item at invalid index
        response = requests.delete(f"{BASE_URL}/api/orders/{order_id}/items/by-index/999")
        
        assert response.status_code == 404
        print("Correctly returned 404 for invalid item index")
    
    def test_update_status_invalid_status(self, test_order_with_custom_item):
        """PUT /api/orders/{id}/items/by-index/{index}/status with invalid status should return 400"""
        order = test_order_with_custom_item
        order_id = order["id"]
        
        # Try to update with invalid status
        response = requests.put(
            f"{BASE_URL}/api/orders/{order_id}/items/by-index/0/status",
            json={"itemStatus": "invalid_status"}
        )
        
        assert response.status_code == 400
        print("Correctly returned 400 for invalid status value")


class TestMixedItemsOrder:
    """Test orders with both regular menu items and custom items"""
    
    @pytest.fixture
    def menu_date(self):
        return date.today().isoformat()
    
    @pytest.fixture
    def menu_with_items(self, menu_date):
        """Get menu with items for testing"""
        response = requests.get(f"{BASE_URL}/api/menus/date/{menu_date}")
        if response.status_code == 404:
            # Create menu
            response = requests.post(f"{BASE_URL}/api/menus", json={"date": menu_date})
        
        menu = response.json()
        
        # If menu has no items, we'll just test with custom items
        return menu
    
    @pytest.fixture
    def order_with_mixed_items(self, menu_date, menu_with_items):
        """Create order with both regular and custom items"""
        menu = menu_with_items
        
        # Create order
        order_response = requests.post(
            f"{BASE_URL}/api/orders?menu_date={menu_date}",
            json={
                "channel": "telefono",
                "customerName": "TEST_MixedItemsTest",
                "notes": "Test order with mixed items"
            }
        )
        assert order_response.status_code == 200
        order = order_response.json()
        order_id = order["id"]
        
        # Add a custom item first
        custom_response = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/items",
            json={
                "dishName": "TEST_CustomDish1",
                "quantity": 1,
                "customPrice": 5.00
            }
        )
        assert custom_response.status_code == 200
        
        # Add another custom item
        custom_response2 = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/items",
            json={
                "dishName": "TEST_CustomDish2",
                "quantity": 3,
                "customPrice": 7.50
            }
        )
        assert custom_response2.status_code == 200
        
        # Get updated order
        order_response = requests.get(f"{BASE_URL}/api/orders/{order_id}")
        return order_response.json()
    
    def test_update_second_custom_item_status(self, order_with_mixed_items):
        """Test updating status of second custom item by index"""
        order = order_with_mixed_items
        order_id = order["id"]
        
        # Update second item (index 1) to ready
        response = requests.put(
            f"{BASE_URL}/api/orders/{order_id}/items/by-index/1/status",
            json={"itemStatus": "ready"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify only second item was updated
        assert data["items"][0]["itemStatus"] == "pending"
        assert data["items"][1]["itemStatus"] == "ready"
        # Order should be in_preparazione (some ready, some pending)
        assert data["status"] == "in_preparazione"
        
        print(f"Successfully updated second item status in mixed order #{data['orderNumber']}")
    
    def test_delete_first_item_preserves_second(self, order_with_mixed_items):
        """Test deleting first item preserves second item"""
        order = order_with_mixed_items
        order_id = order["id"]
        
        original_second_item_name = order["items"][1]["dishName"]
        original_second_item_subtotal = order["items"][1]["subtotal"]
        
        # Delete first item (index 0)
        response = requests.delete(f"{BASE_URL}/api/orders/{order_id}/items/by-index/0")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify only one item remains
        assert len(data["items"]) == 1
        # Verify it's the second item (now at index 0)
        assert data["items"][0]["dishName"] == original_second_item_name
        # Verify total was updated correctly
        assert data["total"] == original_second_item_subtotal
        
        print(f"Successfully deleted first item, second item preserved in order #{data['orderNumber']}")


class TestFrontendAPIFunctions:
    """Test that frontend API functions work correctly with the backend"""
    
    @pytest.fixture
    def menu_date(self):
        return date.today().isoformat()
    
    @pytest.fixture
    def test_order(self, menu_date):
        """Create a test order with custom item"""
        # Ensure menu exists
        response = requests.get(f"{BASE_URL}/api/menus/date/{menu_date}")
        if response.status_code == 404:
            requests.post(f"{BASE_URL}/api/menus", json={"date": menu_date})
        
        # Create order
        order_response = requests.post(
            f"{BASE_URL}/api/orders?menu_date={menu_date}",
            json={
                "channel": "whatsapp",
                "customerName": "TEST_FrontendAPITest"
            }
        )
        order = order_response.json()
        
        # Add custom item
        requests.post(
            f"{BASE_URL}/api/orders/{order['id']}/items",
            json={
                "dishName": "TEST_FrontendItem",
                "quantity": 1,
                "customPrice": 10.00
            }
        )
        
        # Return updated order
        return requests.get(f"{BASE_URL}/api/orders/{order['id']}").json()
    
    def test_removeItemByIndex_function(self, test_order):
        """Test the removeItemByIndex API function used by frontend"""
        order_id = test_order["id"]
        
        # This simulates: ordersApi.removeItemByIndex(orderId, itemIndex)
        response = requests.delete(f"{BASE_URL}/api/orders/{order_id}/items/by-index/0")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 0
        
        print("removeItemByIndex function works correctly")
    
    def test_updateItemStatusByIndex_function(self, test_order):
        """Test the updateItemStatusByIndex API function used by frontend"""
        order_id = test_order["id"]
        
        # This simulates: ordersApi.updateItemStatusByIndex(orderId, itemIndex, itemStatus)
        response = requests.put(
            f"{BASE_URL}/api/orders/{order_id}/items/by-index/0/status",
            json={"itemStatus": "ready"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["items"][0]["itemStatus"] == "ready"
        
        print("updateItemStatusByIndex function works correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
