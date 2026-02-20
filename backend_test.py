#!/usr/bin/env python3
"""
Backend API Testing for Restaurant POS System
Tests all core API endpoints and validates business logic
"""

import requests
import json
from datetime import datetime, date
import os
import sys

# Backend URL configuration
BACKEND_URL = "https://pdf-tablet-engine.preview.emergentagent.com/api"

def print_test_result(test_name, success, message=""):
    """Print formatted test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if message:
        print(f"   {message}")
    print()

def test_api_health():
    """Test if API is responding"""
    try:
        response = requests.get(f"{BACKEND_URL}/")
        return response.status_code == 200, response.json() if response.status_code == 200 else None
    except Exception as e:
        return False, str(e)

def test_dishes_api():
    """Test Dishes API (GET /dishes, POST /dishes, PUT /dishes/{id})"""
    print("=== TESTING DISHES API ===")
    
    # Test GET /dishes
    try:
        response = requests.get(f"{BACKEND_URL}/dishes")
        success = response.status_code == 200
        dishes = response.json() if success else []
        print_test_result("GET /dishes", success, f"Retrieved {len(dishes)} dishes")
    except Exception as e:
        print_test_result("GET /dishes", False, str(e))
        return False
    
    # Test POST /dishes
    try:
        test_dish = {
            "name": "Test Dish API",
            "description": "Test dish for API validation",
            "basePrice": 15.50
        }
        response = requests.post(f"{BACKEND_URL}/dishes", json=test_dish)
        success = response.status_code == 200
        created_dish = response.json() if success else None
        dish_id = created_dish["id"] if created_dish else None
        print_test_result("POST /dishes", success, f"Created dish ID: {dish_id}")
    except Exception as e:
        print_test_result("POST /dishes", False, str(e))
        return False
    
    if not dish_id:
        return False
    
    # Test PUT /dishes/{id}
    try:
        update_data = {
            "name": "Updated Test Dish",
            "basePrice": 18.00,
            "active": True
        }
        response = requests.put(f"{BACKEND_URL}/dishes/{dish_id}", json=update_data)
        success = response.status_code == 200
        updated_dish = response.json() if success else None
        print_test_result("PUT /dishes/{id}", success, f"Updated dish: {updated_dish['name'] if updated_dish else 'Failed'}")
    except Exception as e:
        print_test_result("PUT /dishes/{id}", False, str(e))
        return False
    
    return True

def test_daily_menu_api():
    """Test Daily Menu API (GET /menus/date/{date}, POST /menus, POST /menus/{id}/items)"""
    print("=== TESTING DAILY MENU API ===")
    
    test_date = "2026-02-20"
    
    # Test GET /menus/date/{date}
    try:
        response = requests.get(f"{BACKEND_URL}/menus/date/{test_date}")
        success = response.status_code == 200
        menu = response.json() if success else None
        menu_id = menu["id"] if menu else None
        print_test_result(f"GET /menus/date/{test_date}", success, f"Retrieved menu ID: {menu_id}")
    except Exception as e:
        print_test_result(f"GET /menus/date/{test_date}", False, str(e))
        # Try to create menu if it doesn't exist
        try:
            create_response = requests.post(f"{BACKEND_URL}/menus", json={"date": test_date})
            if create_response.status_code == 200:
                menu = create_response.json()
                menu_id = menu["id"]
                print_test_result("POST /menus (fallback)", True, f"Created menu ID: {menu_id}")
            else:
                return False
        except Exception as create_e:
            print_test_result("POST /menus (fallback)", False, str(create_e))
            return False
    
    if not menu_id:
        return False
    
    # Get a dish to add to menu
    try:
        dishes_response = requests.get(f"{BACKEND_URL}/dishes")
        dishes = dishes_response.json() if dishes_response.status_code == 200 else []
        if not dishes:
            print_test_result("GET dishes for menu", False, "No dishes available")
            return False
        test_dish = dishes[0]
    except Exception as e:
        print_test_result("GET dishes for menu", False, str(e))
        return False
    
    # Test POST /menus/{id}/items
    try:
        menu_item = {
            "dishId": test_dish["id"],
            "portions": 20,
            "dailyPrice": 18.50,
            "notes": "Test menu item"
        }
        response = requests.post(f"{BACKEND_URL}/menus/{menu_id}/items", json=menu_item)
        success = response.status_code == 200
        updated_menu = response.json() if success else None
        items_count = len(updated_menu["items"]) if updated_menu else 0
        print_test_result("POST /menus/{id}/items", success, f"Menu now has {items_count} items")
    except Exception as e:
        print_test_result("POST /menus/{id}/items", False, str(e))
        return False
    
    return True

def test_orders_api():
    """Test Orders API (POST /orders, POST /orders/{id}/items, PUT /orders/{id}/status)"""
    print("=== TESTING ORDERS API ===")
    
    test_date = "2026-02-20"
    
    # Get menu for test date
    try:
        menu_response = requests.get(f"{BACKEND_URL}/menus/date/{test_date}")
        if menu_response.status_code != 200:
            print_test_result("GET menu for orders test", False, "No menu available for test date")
            return False
        menu = menu_response.json()
        if not menu["items"]:
            print_test_result("GET menu items for orders test", False, "No items in menu")
            return False
        menu_item = menu["items"][0]
    except Exception as e:
        print_test_result("GET menu for orders test", False, str(e))
        return False
    
    # Test POST /orders
    try:
        order_data = {
            "channel": "telefono",
            "customerName": "Mario Rossi",
            "notes": "Test order"
        }
        response = requests.post(f"{BACKEND_URL}/orders?menu_date={test_date}", json=order_data)
        success = response.status_code == 200
        created_order = response.json() if success else None
        order_id = created_order["id"] if created_order else None
        order_number = created_order["orderNumber"] if created_order else None
        print_test_result("POST /orders", success, f"Created order #{order_number}, ID: {order_id}")
    except Exception as e:
        print_test_result("POST /orders", False, str(e))
        return False
    
    if not order_id:
        return False
    
    # Store initial portions
    initial_portions = menu_item["portions"]
    
    # Test POST /orders/{id}/items (portion scaling)
    try:
        order_item = {
            "dishId": menu_item["dishId"],
            "quantity": 2
        }
        response = requests.post(f"{BACKEND_URL}/orders/{order_id}/items", json=order_item)
        success = response.status_code == 200
        updated_order = response.json() if success else None
        
        # Check if portions decreased
        updated_menu_response = requests.get(f"{BACKEND_URL}/menus/date/{test_date}")
        updated_menu = updated_menu_response.json() if updated_menu_response.status_code == 200 else None
        
        if updated_menu:
            updated_item = None
            for item in updated_menu["items"]:
                if item["dishId"] == menu_item["dishId"]:
                    updated_item = item
                    break
            
            if updated_item:
                portions_decreased = updated_item["portions"] == (initial_portions - 2)
                print_test_result("POST /orders/{id}/items", success and portions_decreased, 
                                f"Added 2 items, portions: {initial_portions} → {updated_item['portions']}")
            else:
                print_test_result("POST /orders/{id}/items", False, "Could not verify portion scaling")
        else:
            print_test_result("POST /orders/{id}/items", success, "Added items but could not verify portion scaling")
    except Exception as e:
        print_test_result("POST /orders/{id}/items", False, str(e))
        return False
    
    # Test PUT /orders/{id}/status
    try:
        status_update = {"status": "completato"}
        response = requests.put(f"{BACKEND_URL}/orders/{order_id}/status", json=status_update)
        success = response.status_code == 200
        updated_order = response.json() if success else None
        final_status = updated_order["status"] if updated_order else "unknown"
        print_test_result("PUT /orders/{id}/status", success, f"Status updated to: {final_status}")
    except Exception as e:
        print_test_result("PUT /orders/{id}/status", False, str(e))
        return False
    
    return True

def test_portion_blocking():
    """Test portion blocking when portions = 0 (VC-03)"""
    print("=== TESTING PORTION BLOCKING (VC-03) ===")
    
    test_date = "2026-02-20"
    
    # Get menu and find an item with low portions or create one
    try:
        menu_response = requests.get(f"{BACKEND_URL}/menus/date/{test_date}")
        if menu_response.status_code != 200:
            print_test_result("GET menu for portion blocking test", False, "No menu available")
            return False
        
        menu = menu_response.json()
        menu_id = menu["id"]
        
        # Find item with 0 portions or create one
        zero_portions_item = None
        for item in menu["items"]:
            if item["portions"] == 0:
                zero_portions_item = item
                break
        
        if not zero_portions_item:
            # Set first item to 0 portions
            if menu["items"]:
                first_item = menu["items"][0]
                # Update portions to 0
                update_response = requests.put(
                    f"{BACKEND_URL}/menus/{menu_id}/items/{first_item['dishId']}",
                    json={"portions": 0}
                )
                if update_response.status_code == 200:
                    zero_portions_item = first_item.copy()
                    zero_portions_item["portions"] = 0
                    print_test_result("Setup 0 portions item", True, f"Set {first_item['dishName']} to 0 portions")
                else:
                    print_test_result("Setup 0 portions item", False, "Could not set item to 0 portions")
                    return False
            else:
                print_test_result("Setup 0 portions item", False, "No items in menu")
                return False
        
    except Exception as e:
        print_test_result("GET menu for portion blocking test", False, str(e))
        return False
    
    # Create test order
    try:
        order_data = {
            "channel": "telefono",
            "customerName": "Test Zero Portions",
            "notes": "Testing portion blocking"
        }
        response = requests.post(f"{BACKEND_URL}/orders?menu_date={test_date}", json=order_data)
        if response.status_code != 200:
            print_test_result("Create order for portion blocking test", False, "Could not create order")
            return False
        
        test_order = response.json()
        order_id = test_order["id"]
        
    except Exception as e:
        print_test_result("Create order for portion blocking test", False, str(e))
        return False
    
    # Try to add item with 0 portions (should fail)
    try:
        order_item = {
            "dishId": zero_portions_item["dishId"],
            "quantity": 1
        }
        response = requests.post(f"{BACKEND_URL}/orders/{order_id}/items", json=order_item)
        
        # Should return 400 error for insufficient portions
        blocked = response.status_code == 400
        error_msg = response.json().get("detail", "") if response.status_code == 400 else ""
        
        print_test_result("Portion blocking (VC-03)", blocked, 
                        f"Correctly blocked order: {error_msg}" if blocked else "Should have blocked 0 portions order")
        
    except Exception as e:
        print_test_result("Portion blocking (VC-03)", False, str(e))
        return False
    
    return True

def test_customers_api():
    """Test Customers API (CRUD operations)"""
    print("=== TESTING CUSTOMERS API ===")
    
    # Test POST /customers
    try:
        customer_data = {
            "name": "Giuseppe Verdi",
            "phone": "+39 333 1234567",
            "email": "giuseppe.verdi@email.com",
            "address": "Via Roma 123, Milano",
            "requiresInvoice": True,
            "notes": "Cliente VIP"
        }
        response = requests.post(f"{BACKEND_URL}/customers", json=customer_data)
        success = response.status_code == 200
        created_customer = response.json() if success else None
        customer_id = created_customer["id"] if created_customer else None
        print_test_result("POST /customers", success, f"Created customer ID: {customer_id}")
    except Exception as e:
        print_test_result("POST /customers", False, str(e))
        return False
    
    # Test GET /customers
    try:
        response = requests.get(f"{BACKEND_URL}/customers")
        success = response.status_code == 200
        customers = response.json() if success else []
        print_test_result("GET /customers", success, f"Retrieved {len(customers)} customers")
    except Exception as e:
        print_test_result("GET /customers", False, str(e))
        return False
    
    if not customer_id:
        return False
    
    # Test GET /customers/{id}
    try:
        response = requests.get(f"{BACKEND_URL}/customers/{customer_id}")
        success = response.status_code == 200
        customer = response.json() if success else None
        print_test_result("GET /customers/{id}", success, f"Retrieved customer: {customer['name'] if customer else 'Failed'}")
    except Exception as e:
        print_test_result("GET /customers/{id}", False, str(e))
        return False
    
    # Test PUT /customers/{id}
    try:
        update_data = {
            "phone": "+39 333 9876543",
            "notes": "Cliente VIP - Aggiornato"
        }
        response = requests.put(f"{BACKEND_URL}/customers/{customer_id}", json=update_data)
        success = response.status_code == 200
        updated_customer = response.json() if success else None
        print_test_result("PUT /customers/{id}", success, f"Updated customer phone: {updated_customer['phone'] if updated_customer else 'Failed'}")
    except Exception as e:
        print_test_result("PUT /customers/{id}", False, str(e))
        return False
    
    # Test GET /customers/{id}/orders
    try:
        response = requests.get(f"{BACKEND_URL}/customers/{customer_id}/orders")
        success = response.status_code == 200
        orders = response.json() if success else []
        print_test_result("GET /customers/{id}/orders", success, f"Retrieved {len(orders)} orders for customer")
    except Exception as e:
        print_test_result("GET /customers/{id}/orders", False, str(e))
        return False
    
    return True

def test_missed_sales_api():
    """Test Missed Sales API"""
    print("=== TESTING MISSED SALES API ===")
    
    # Test POST /missed-sales
    try:
        missed_sale_data = {
            "dishName": "Carbonara Speciale",
            "date": "2026-02-20",
            "timeSlot": "13:30",
            "channel": "telefono",
            "customerName": "Cliente X",
            "reason": "esaurito"
        }
        response = requests.post(f"{BACKEND_URL}/missed-sales", json=missed_sale_data)
        success = response.status_code == 200
        created_ms = response.json() if success else None
        ms_id = created_ms["id"] if created_ms else None
        print_test_result("POST /missed-sales", success, f"Created missed sale ID: {ms_id}")
    except Exception as e:
        print_test_result("POST /missed-sales", False, str(e))
        return False
    
    # Test GET /missed-sales
    try:
        response = requests.get(f"{BACKEND_URL}/missed-sales")
        success = response.status_code == 200
        missed_sales = response.json() if success else []
        print_test_result("GET /missed-sales", success, f"Retrieved {len(missed_sales)} missed sales")
    except Exception as e:
        print_test_result("GET /missed-sales", False, str(e))
        return False
    
    # Test GET /missed-sales with date filter
    try:
        response = requests.get(f"{BACKEND_URL}/missed-sales?date=2026-02-20")
        success = response.status_code == 200
        filtered_ms = response.json() if success else []
        print_test_result("GET /missed-sales?date=...", success, f"Retrieved {len(filtered_ms)} missed sales for 2026-02-20")
    except Exception as e:
        print_test_result("GET /missed-sales?date=...", False, str(e))
        return False
    
    return True

def test_reports_api():
    """Test Reports API endpoints"""
    print("=== TESTING REPORTS API ===")
    
    test_date = "2026-02-20"
    
    # Test GET /reports/daily-summary
    try:
        response = requests.get(f"{BACKEND_URL}/reports/daily-summary?date={test_date}")
        success = response.status_code == 200
        summary = response.json() if success else None
        total_orders = summary["totalOrders"] if summary else 0
        total_revenue = summary["totalRevenue"] if summary else 0
        print_test_result("GET /reports/daily-summary", success, f"Date: {test_date}, Orders: {total_orders}, Revenue: €{total_revenue}")
    except Exception as e:
        print_test_result("GET /reports/daily-summary", False, str(e))
        return False
    
    # Test GET /reports/top-dishes
    try:
        response = requests.get(f"{BACKEND_URL}/reports/top-dishes?limit=5")
        success = response.status_code == 200
        top_dishes = response.json() if success else []
        print_test_result("GET /reports/top-dishes", success, f"Retrieved top {len(top_dishes)} dishes")
    except Exception as e:
        print_test_result("GET /reports/top-dishes", False, str(e))
        return False
    
    # Test GET /reports/missed-sales-summary
    try:
        response = requests.get(f"{BACKEND_URL}/reports/missed-sales-summary")
        success = response.status_code == 200
        ms_summary = response.json() if success else None
        total_missed = ms_summary["totalMissedSales"] if ms_summary else 0
        print_test_result("GET /reports/missed-sales-summary", success, f"Total missed sales: {total_missed}")
    except Exception as e:
        print_test_result("GET /reports/missed-sales-summary", False, str(e))
        return False
    
    return True

def main():
    """Run all API tests"""
    print("🚀 STARTING RESTAURANT POS BACKEND API TESTS")
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 60)
    
    # Test API health
    health_ok, health_data = test_api_health()
    print_test_result("API Health Check", health_ok, str(health_data))
    
    if not health_ok:
        print("❌ API is not responding. Aborting tests.")
        sys.exit(1)
    
    # Track test results
    results = {}
    
    # Run all tests
    results["dishes"] = test_dishes_api()
    results["menu"] = test_daily_menu_api()
    results["orders"] = test_orders_api()
    results["portion_blocking"] = test_portion_blocking()
    results["customers"] = test_customers_api()
    results["missed_sales"] = test_missed_sales_api()
    results["reports"] = test_reports_api()
    
    # Summary
    print("=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for r in results.values() if r)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name.upper()} API")
    
    print(f"\nOverall: {passed}/{total} test suites passed")
    
    if passed == total:
        print("🎉 All tests passed!")
        return True
    else:
        print("⚠️  Some tests failed. Check details above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)