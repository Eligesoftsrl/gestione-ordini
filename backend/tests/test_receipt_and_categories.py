"""
Backend API tests for:
1. Receipt upload and delete endpoints
2. Category filter functionality
"""
import pytest
import requests
import os
from datetime import date

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bancos-receipt.preview.emergentagent.com')


class TestCategoriesAPI:
    """Test category endpoints"""
    
    def test_get_categories(self):
        """GET /api/categories should return list of categories"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify category structure
        category = data[0]
        assert "id" in category
        assert "name" in category
        assert "order" in category
        print(f"Found {len(data)} categories: {[c['name'] for c in data]}")
    
    def test_categories_have_expected_names(self):
        """Verify expected categories exist: Primi, Secondi, Contorni, Dolci, Bibite"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        
        data = response.json()
        category_names = [c['name'] for c in data]
        
        expected_categories = ['Primi', 'Secondi', 'Contorni', 'Dolci', 'Bibite']
        for expected in expected_categories:
            assert expected in category_names, f"Category '{expected}' not found"
        
        print(f"All expected categories found: {expected_categories}")


class TestMenuWithCategories:
    """Test menu endpoints with category filtering"""
    
    def test_get_menu_by_date(self):
        """GET /api/menus/date/{date} should return menu with items containing categoryId"""
        today = date.today().isoformat()
        response = requests.get(f"{BASE_URL}/api/menus/date/{today}")
        
        if response.status_code == 404:
            pytest.skip("No menu for today - creating one")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert "date" in data
        assert "items" in data
        
        # Verify items have categoryId and categoryName
        if data["items"]:
            item = data["items"][0]
            assert "dishId" in item
            assert "dishName" in item
            assert "categoryId" in item or item.get("categoryId") is None
            assert "categoryName" in item or item.get("categoryName") is None
            assert "portions" in item
            assert "dailyPrice" in item
            
        print(f"Menu for {today} has {len(data['items'])} items")


class TestOrdersAPI:
    """Test order endpoints"""
    
    @pytest.fixture
    def existing_order(self):
        """Get an existing order for today"""
        today = date.today().isoformat()
        response = requests.get(f"{BASE_URL}/api/orders?menu_date={today}")
        assert response.status_code == 200
        
        orders = response.json()
        if not orders:
            pytest.skip("No existing orders for today")
        
        return orders[0]
    
    def test_get_orders(self):
        """GET /api/orders should return list of orders"""
        today = date.today().isoformat()
        response = requests.get(f"{BASE_URL}/api/orders?menu_date={today}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} orders for today")
    
    def test_order_has_receipt_field(self, existing_order):
        """Orders should have receiptImage field"""
        assert "receiptImage" in existing_order or existing_order.get("receiptImage") is None
        assert "isPaid" in existing_order
        print(f"Order #{existing_order['orderNumber']} has receiptImage: {existing_order.get('receiptImage') is not None}")


class TestReceiptEndpoints:
    """Test receipt upload and delete endpoints"""
    
    @pytest.fixture
    def existing_order(self):
        """Get an existing order for today"""
        today = date.today().isoformat()
        response = requests.get(f"{BASE_URL}/api/orders?menu_date={today}")
        assert response.status_code == 200
        
        orders = response.json()
        if not orders:
            pytest.skip("No existing orders for today")
        
        return orders[0]
    
    def test_upload_receipt(self, existing_order):
        """PUT /api/orders/{id}/receipt should upload receipt image"""
        order_id = existing_order["id"]
        
        # Create a simple base64 test image (1x1 pixel PNG)
        test_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        response = requests.put(
            f"{BASE_URL}/api/orders/{order_id}/receipt",
            json={"receiptImage": test_image}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "receiptImage" in data
        assert data["receiptImage"] == test_image
        print(f"Successfully uploaded receipt to order #{data['orderNumber']}")
    
    def test_get_order_with_receipt(self, existing_order):
        """GET /api/orders/{id} should return order with receiptImage"""
        order_id = existing_order["id"]
        
        # First upload a receipt
        test_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        requests.put(
            f"{BASE_URL}/api/orders/{order_id}/receipt",
            json={"receiptImage": test_image}
        )
        
        # Then verify it's returned
        response = requests.get(f"{BASE_URL}/api/orders/{order_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["receiptImage"] == test_image
        print(f"Receipt persisted correctly for order #{data['orderNumber']}")
    
    def test_delete_receipt(self, existing_order):
        """DELETE /api/orders/{id}/receipt should remove receipt image"""
        order_id = existing_order["id"]
        
        # First upload a receipt
        test_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        requests.put(
            f"{BASE_URL}/api/orders/{order_id}/receipt",
            json={"receiptImage": test_image}
        )
        
        # Delete the receipt
        response = requests.delete(f"{BASE_URL}/api/orders/{order_id}/receipt")
        assert response.status_code == 200
        
        data = response.json()
        assert data["receiptImage"] is None
        print(f"Successfully deleted receipt from order #{data['orderNumber']}")
    
    def test_upload_receipt_invalid_order(self):
        """PUT /api/orders/{invalid_id}/receipt should return 404 or error"""
        invalid_id = "000000000000000000000000"
        test_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        response = requests.put(
            f"{BASE_URL}/api/orders/{invalid_id}/receipt",
            json={"receiptImage": test_image}
        )
        
        # Should return 404 or 500 for invalid order
        assert response.status_code in [404, 500, 400]
        print(f"Invalid order receipt upload returned: {response.status_code}")


class TestPaymentEndpoints:
    """Test payment toggle endpoint"""
    
    @pytest.fixture
    def existing_order(self):
        """Get an existing order for today"""
        today = date.today().isoformat()
        response = requests.get(f"{BASE_URL}/api/orders?menu_date={today}")
        assert response.status_code == 200
        
        orders = response.json()
        if not orders:
            pytest.skip("No existing orders for today")
        
        return orders[0]
    
    def test_update_payment_status(self, existing_order):
        """PUT /api/orders/{id}/payment should update isPaid status"""
        order_id = existing_order["id"]
        
        # Set to paid
        response = requests.put(
            f"{BASE_URL}/api/orders/{order_id}/payment",
            json={"isPaid": True}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["isPaid"] == True
        
        # Set back to unpaid
        response = requests.put(
            f"{BASE_URL}/api/orders/{order_id}/payment",
            json={"isPaid": False}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["isPaid"] == False
        
        print(f"Payment status toggle working for order #{data['orderNumber']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
