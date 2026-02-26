from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
from bson import ObjectId
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'restaurant_pos')]

# Create the main app
app = FastAPI(title="Sistema Gestione Ordini Ristorazione")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============ MODELS ============

# Helper for ObjectId
class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, handler=None):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)

# Categorie (Categories)
class CategoryBase(BaseModel):
    name: str
    order: int = 0  # Per ordinare le categorie

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    order: Optional[int] = None

class Category(CategoryBase):
    id: str
    createdAt: datetime

# Piatti (Dishes)
class DishBase(BaseModel):
    name: str
    description: Optional[str] = ""
    basePrice: float
    categoryId: Optional[str] = None
    categoryName: Optional[str] = None
    isFavorite: bool = False  # Piatti preferiti

class DishCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    basePrice: float
    categoryId: Optional[str] = None
    isFavorite: bool = False

class DishUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    basePrice: Optional[float] = None
    categoryId: Optional[str] = None
    active: Optional[bool] = None
    isFavorite: Optional[bool] = None

class Dish(DishBase):
    id: str
    active: bool = True
    createdAt: datetime

    class Config:
        json_encoders = {ObjectId: str}

# Menu Item (for daily menu)
class MenuItemBase(BaseModel):
    dishId: str
    dishName: str
    categoryId: Optional[str] = None
    categoryName: Optional[str] = None
    portions: int
    dailyPrice: float
    notes: Optional[str] = ""

class MenuItemUpdate(BaseModel):
    portions: Optional[int] = None
    dailyPrice: Optional[float] = None
    notes: Optional[str] = None

# Menu Giornaliero (Daily Menu)
class DailyMenuBase(BaseModel):
    date: str  # YYYY-MM-DD format
    items: List[MenuItemBase] = []

class DailyMenuCreate(BaseModel):
    date: str

class DailyMenuAddItem(BaseModel):
    dishId: str
    portions: int
    dailyPrice: float
    notes: Optional[str] = ""

class DailyMenu(DailyMenuBase):
    id: str
    createdAt: datetime

# Order Item
class OrderItemBase(BaseModel):
    dishId: str
    dishName: str
    quantity: int
    unitPrice: float
    subtotal: float

# Ordini (Orders)
class OrderBase(BaseModel):
    channel: str  # whatsapp, telefono, persona
    items: List[OrderItemBase] = []
    total: float = 0
    status: str = "in_attesa"  # in_attesa, completato, annullato
    customerId: Optional[str] = None
    customerName: Optional[str] = None
    notes: Optional[str] = ""

class OrderCreate(BaseModel):
    channel: str
    customerId: Optional[str] = None
    customerName: Optional[str] = None
    notes: Optional[str] = ""

class OrderAddItem(BaseModel):
    dishId: str
    quantity: int

class OrderUpdateStatus(BaseModel):
    status: str

class Order(OrderBase):
    id: str
    orderNumber: int
    menuDate: str
    createdAt: datetime

# Mancate Vendite (Missed Sales)
class MissedSaleBase(BaseModel):
    dishName: str
    date: str
    timeSlot: str = "giornata"
    channel: str = "richiesta"
    quantity: int = 1  # Quantità richieste non soddisfatte
    customerId: Optional[str] = None
    customerName: Optional[str] = None
    reason: str = "esaurito"  # esaurito, non_nel_menu

class MissedSaleCreate(MissedSaleBase):
    pass

class MissedSale(MissedSaleBase):
    id: str
    createdAt: datetime

# Clienti (Customers)
class CustomerBase(BaseModel):
    name: str
    customerType: str = "persona"  # "persona" o "societa"
    partitaIva: Optional[str] = ""  # Obbligatorio per società
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    requiresInvoice: bool = False
    notes: Optional[str] = ""

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    customerType: Optional[str] = None
    partitaIva: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    requiresInvoice: Optional[bool] = None
    notes: Optional[str] = None

class Customer(CustomerBase):
    id: str
    createdAt: datetime

# ============ ROUTES - CATEGORIES ============

@api_router.get("/")
async def root():
    return {"message": "Sistema Gestione Ordini Ristorazione API"}

@api_router.post("/categories", response_model=Category)
async def create_category(category: CategoryCreate):
    category_dict = category.dict()
    category_dict["createdAt"] = datetime.utcnow()
    result = await db.categories.insert_one(category_dict)
    category_dict["id"] = str(result.inserted_id)
    return Category(**category_dict)

@api_router.get("/categories", response_model=List[Category])
async def get_categories():
    categories = await db.categories.find().sort("order", 1).to_list(100)
    return [Category(id=str(c["_id"]), **{k: v for k, v in c.items() if k != "_id"}) for c in categories]

@api_router.put("/categories/{category_id}", response_model=Category)
async def update_category(category_id: str, category_update: CategoryUpdate):
    update_data = {k: v for k, v in category_update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nessun dato da aggiornare")
    
    result = await db.categories.update_one(
        {"_id": ObjectId(category_id)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Categoria non trovata")
    
    category = await db.categories.find_one({"_id": ObjectId(category_id)})
    return Category(id=str(category["_id"]), **{k: v for k, v in category.items() if k != "_id"})

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    # Check if any dishes use this category
    dishes_with_category = await db.dishes.count_documents({"categoryId": category_id})
    if dishes_with_category > 0:
        raise HTTPException(status_code=400, detail=f"Impossibile eliminare: {dishes_with_category} piatti usano questa categoria")
    
    result = await db.categories.delete_one({"_id": ObjectId(category_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Categoria non trovata")
    return {"message": "Categoria eliminata"}

# ============ ROUTES - DISHES ============

@api_router.post("/dishes", response_model=Dish)
async def create_dish(dish: DishCreate):
    dish_dict = dish.dict()
    dish_dict["active"] = True
    dish_dict["createdAt"] = datetime.utcnow()
    
    # Get category name if categoryId is provided
    if dish_dict.get("categoryId"):
        category = await db.categories.find_one({"_id": ObjectId(dish_dict["categoryId"])})
        if category:
            dish_dict["categoryName"] = category["name"]
        else:
            dish_dict["categoryId"] = None
            dish_dict["categoryName"] = None
    else:
        dish_dict["categoryName"] = None
    
    # Ensure isFavorite is set
    if "isFavorite" not in dish_dict:
        dish_dict["isFavorite"] = False
    
    result = await db.dishes.insert_one(dish_dict)
    dish_dict["id"] = str(result.inserted_id)
    return Dish(**dish_dict)

@api_router.get("/dishes", response_model=List[Dish])
async def get_dishes(active_only: bool = True, category_id: Optional[str] = None):
    query = {}
    if active_only:
        query["active"] = True
    if category_id:
        query["categoryId"] = category_id
    dishes = await db.dishes.find(query).to_list(1000)
    return [Dish(id=str(d["_id"]), **{k: v for k, v in d.items() if k != "_id"}) for d in dishes]

@api_router.get("/dishes/{dish_id}", response_model=Dish)
async def get_dish(dish_id: str):
    dish = await db.dishes.find_one({"_id": ObjectId(dish_id)})
    if not dish:
        raise HTTPException(status_code=404, detail="Piatto non trovato")
    return Dish(id=str(dish["_id"]), **{k: v for k, v in dish.items() if k != "_id"})

@api_router.put("/dishes/{dish_id}", response_model=Dish)
async def update_dish(dish_id: str, dish_update: DishUpdate):
    update_data = {k: v for k, v in dish_update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nessun dato da aggiornare")
    
    # Get category name if categoryId is being updated
    if "categoryId" in update_data:
        if update_data["categoryId"]:
            category = await db.categories.find_one({"_id": ObjectId(update_data["categoryId"])})
            if category:
                update_data["categoryName"] = category["name"]
            else:
                update_data["categoryId"] = None
                update_data["categoryName"] = None
        else:
            update_data["categoryName"] = None
    
    result = await db.dishes.update_one(
        {"_id": ObjectId(dish_id)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Piatto non trovato")
    
    dish = await db.dishes.find_one({"_id": ObjectId(dish_id)})
    return Dish(id=str(dish["_id"]), **{k: v for k, v in dish.items() if k != "_id"})

@api_router.delete("/dishes/{dish_id}")
async def deactivate_dish(dish_id: str):
    result = await db.dishes.update_one(
        {"_id": ObjectId(dish_id)},
        {"$set": {"active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Piatto non trovato")
    return {"message": "Piatto disattivato"}

# ============ ROUTES - DAILY MENU ============

@api_router.post("/menus", response_model=DailyMenu)
async def create_daily_menu(menu: DailyMenuCreate):
    # Check if menu already exists for this date
    existing = await db.daily_menus.find_one({"date": menu.date})
    if existing:
        raise HTTPException(status_code=400, detail="Menu già esistente per questa data")
    
    # Get all favorite dishes and add them automatically
    favorite_dishes = await db.dishes.find({"active": True, "isFavorite": True}).to_list(100)
    initial_items = []
    
    for dish in favorite_dishes:
        initial_items.append({
            "dishId": str(dish["_id"]),
            "dishName": dish["name"],
            "categoryId": dish.get("categoryId"),
            "categoryName": dish.get("categoryName"),
            "portions": 10,  # Default portions for favorites
            "dailyPrice": dish["basePrice"],
            "notes": ""
        })
    
    menu_dict = {
        "date": menu.date,
        "items": initial_items,
        "createdAt": datetime.utcnow()
    }
    result = await db.daily_menus.insert_one(menu_dict)
    menu_dict["id"] = str(result.inserted_id)
    return DailyMenu(**menu_dict)

@api_router.get("/menus", response_model=List[DailyMenu])
async def get_daily_menus(limit: int = 30):
    menus = await db.daily_menus.find().sort("date", -1).limit(limit).to_list(limit)
    return [DailyMenu(id=str(m["_id"]), **{k: v for k, v in m.items() if k != "_id"}) for m in menus]

@api_router.get("/menus/date/{date}", response_model=DailyMenu)
async def get_menu_by_date(date: str):
    menu = await db.daily_menus.find_one({"date": date})
    if not menu:
        raise HTTPException(status_code=404, detail="Menu non trovato per questa data")
    return DailyMenu(id=str(menu["_id"]), **{k: v for k, v in menu.items() if k != "_id"})

@api_router.get("/menus/{menu_id}", response_model=DailyMenu)
async def get_menu(menu_id: str):
    menu = await db.daily_menus.find_one({"_id": ObjectId(menu_id)})
    if not menu:
        raise HTTPException(status_code=404, detail="Menu non trovato")
    return DailyMenu(id=str(menu["_id"]), **{k: v for k, v in menu.items() if k != "_id"})

@api_router.post("/menus/{menu_id}/items", response_model=DailyMenu)
async def add_menu_item(menu_id: str, item: DailyMenuAddItem):
    # Get the dish
    dish = await db.dishes.find_one({"_id": ObjectId(item.dishId)})
    if not dish:
        raise HTTPException(status_code=404, detail="Piatto non trovato")
    
    menu_item = {
        "dishId": item.dishId,
        "dishName": dish["name"],
        "categoryId": dish.get("categoryId"),
        "categoryName": dish.get("categoryName"),
        "portions": item.portions,
        "dailyPrice": item.dailyPrice,
        "notes": item.notes or ""
    }
    
    result = await db.daily_menus.update_one(
        {"_id": ObjectId(menu_id)},
        {"$push": {"items": menu_item}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Menu non trovato")
    
    menu = await db.daily_menus.find_one({"_id": ObjectId(menu_id)})
    return DailyMenu(id=str(menu["_id"]), **{k: v for k, v in menu.items() if k != "_id"})

@api_router.put("/menus/{menu_id}/items/{dish_id}", response_model=DailyMenu)
async def update_menu_item(menu_id: str, dish_id: str, item_update: MenuItemUpdate):
    update_fields = {}
    if item_update.portions is not None:
        update_fields["items.$.portions"] = item_update.portions
    if item_update.dailyPrice is not None:
        update_fields["items.$.dailyPrice"] = item_update.dailyPrice
    if item_update.notes is not None:
        update_fields["items.$.notes"] = item_update.notes
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="Nessun dato da aggiornare")
    
    result = await db.daily_menus.update_one(
        {"_id": ObjectId(menu_id), "items.dishId": dish_id},
        {"$set": update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Menu o piatto non trovato")
    
    menu = await db.daily_menus.find_one({"_id": ObjectId(menu_id)})
    return DailyMenu(id=str(menu["_id"]), **{k: v for k, v in menu.items() if k != "_id"})

@api_router.delete("/menus/{menu_id}/items/{dish_id}", response_model=DailyMenu)
async def remove_menu_item(menu_id: str, dish_id: str):
    result = await db.daily_menus.update_one(
        {"_id": ObjectId(menu_id)},
        {"$pull": {"items": {"dishId": dish_id}}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Menu non trovato")
    
    menu = await db.daily_menus.find_one({"_id": ObjectId(menu_id)})
    return DailyMenu(id=str(menu["_id"]), **{k: v for k, v in menu.items() if k != "_id"})

# ============ ROUTES - ORDERS ============

@api_router.post("/orders", response_model=Order)
async def create_order(order: OrderCreate, menu_date: str):
    # Verify menu exists for this date
    menu = await db.daily_menus.find_one({"date": menu_date})
    if not menu:
        raise HTTPException(status_code=404, detail="Menu non trovato per questa data")
    
    # Get next order number
    last_order = await db.orders.find_one(
        {"menuDate": menu_date},
        sort=[("orderNumber", -1)]
    )
    next_number = (last_order["orderNumber"] + 1) if last_order else 1
    
    order_dict = {
        "orderNumber": next_number,
        "menuDate": menu_date,
        "channel": order.channel,
        "items": [],
        "total": 0,
        "status": "in_attesa",
        "customerId": order.customerId,
        "customerName": order.customerName,
        "notes": order.notes or "",
        "createdAt": datetime.utcnow()
    }
    
    result = await db.orders.insert_one(order_dict)
    order_dict["id"] = str(result.inserted_id)
    return Order(**order_dict)

@api_router.get("/orders", response_model=List[Order])
async def get_orders(menu_date: Optional[str] = None, status: Optional[str] = None, limit: int = 100):
    query = {}
    if menu_date:
        query["menuDate"] = menu_date
    if status:
        query["status"] = status
    
    orders = await db.orders.find(query).sort("createdAt", -1).limit(limit).to_list(limit)
    return [Order(id=str(o["_id"]), **{k: v for k, v in o.items() if k != "_id"}) for o in orders]

@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    return Order(id=str(order["_id"]), **{k: v for k, v in order.items() if k != "_id"})

@api_router.post("/orders/{order_id}/items", response_model=Order)
async def add_order_item(order_id: str, item: OrderAddItem):
    # Get the order
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    
    # Get the menu for this order's date
    menu = await db.daily_menus.find_one({"date": order["menuDate"]})
    if not menu:
        raise HTTPException(status_code=404, detail="Menu non trovato")
    
    # Find the dish in the menu
    menu_item = None
    for mi in menu["items"]:
        if mi["dishId"] == item.dishId:
            menu_item = mi
            break
    
    if not menu_item:
        raise HTTPException(status_code=400, detail="Piatto non presente nel menu del giorno")
    
    # Check portions availability (VC-02, VC-03)
    if menu_item["portions"] < item.quantity:
        raise HTTPException(
            status_code=400, 
            detail=f"Porzioni insufficienti. Disponibili: {menu_item['portions']}"
        )
    
    # Calculate subtotal
    subtotal = menu_item["dailyPrice"] * item.quantity
    
    # Create order item
    order_item = {
        "dishId": item.dishId,
        "dishName": menu_item["dishName"],
        "quantity": item.quantity,
        "unitPrice": menu_item["dailyPrice"],
        "subtotal": subtotal
    }
    
    # Update order with new item and recalculate total
    new_total = order["total"] + subtotal
    
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {
            "$push": {"items": order_item},
            "$set": {"total": new_total}
        }
    )
    
    # Decrease portions in menu (RF-03.6)
    new_portions = menu_item["portions"] - item.quantity
    await db.daily_menus.update_one(
        {"_id": ObjectId(menu["_id"]), "items.dishId": item.dishId},
        {"$set": {"items.$.portions": new_portions}}
    )
    
    # Return updated order
    updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return Order(id=str(updated_order["_id"]), **{k: v for k, v in updated_order.items() if k != "_id"})

@api_router.delete("/orders/{order_id}/items/{dish_id}", response_model=Order)
async def remove_order_item(order_id: str, dish_id: str):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    
    # Find the item to remove
    item_to_remove = None
    for item in order["items"]:
        if item["dishId"] == dish_id:
            item_to_remove = item
            break
    
    if not item_to_remove:
        raise HTTPException(status_code=404, detail="Piatto non trovato nell'ordine")
    
    # Update order
    new_total = order["total"] - item_to_remove["subtotal"]
    
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {
            "$pull": {"items": {"dishId": dish_id}},
            "$set": {"total": new_total}
        }
    )
    
    # Restore portions in menu
    menu = await db.daily_menus.find_one({"date": order["menuDate"]})
    if menu:
        for mi in menu["items"]:
            if mi["dishId"] == dish_id:
                new_portions = mi["portions"] + item_to_remove["quantity"]
                await db.daily_menus.update_one(
                    {"_id": ObjectId(menu["_id"]), "items.dishId": dish_id},
                    {"$set": {"items.$.portions": new_portions}}
                )
                break
    
    updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return Order(id=str(updated_order["_id"]), **{k: v for k, v in updated_order.items() if k != "_id"})

@api_router.put("/orders/{order_id}/status", response_model=Order)
async def update_order_status(order_id: str, status_update: OrderUpdateStatus):
    valid_statuses = ["in_attesa", "in_preparazione", "pronto", "sospeso"]
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Stato non valido")
    
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    
    # If suspending, restore portions
    if status_update.status == "sospeso" and order["status"] != "sospeso":
        menu = await db.daily_menus.find_one({"date": order["menuDate"]})
        if menu:
            for order_item in order["items"]:
                for mi in menu["items"]:
                    if mi["dishId"] == order_item["dishId"]:
                        new_portions = mi["portions"] + order_item["quantity"]
                        await db.daily_menus.update_one(
                            {"_id": ObjectId(menu["_id"]), "items.dishId": order_item["dishId"]},
                            {"$set": {"items.$.portions": new_portions}}
                        )
                        break
    
    # If un-suspending, reduce portions again
    if order["status"] == "sospeso" and status_update.status != "sospeso":
        menu = await db.daily_menus.find_one({"date": order["menuDate"]})
        if menu:
            for order_item in order["items"]:
                for mi in menu["items"]:
                    if mi["dishId"] == order_item["dishId"]:
                        new_portions = mi["portions"] - order_item["quantity"]
                        if new_portions < 0:
                            raise HTTPException(status_code=400, detail=f"Porzioni insufficienti per {order_item['dishName']}")
                        await db.daily_menus.update_one(
                            {"_id": ObjectId(menu["_id"]), "items.dishId": order_item["dishId"]},
                            {"$set": {"items.$.portions": new_portions}}
                        )
                        break
    
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"status": status_update.status}}
    )
    
    updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return Order(id=str(updated_order["_id"]), **{k: v for k, v in updated_order.items() if k != "_id"})

# ============ ROUTES - MISSED SALES ============

@api_router.post("/missed-sales", response_model=MissedSale)
async def create_missed_sale(missed_sale: MissedSaleCreate):
    ms_dict = missed_sale.dict()
    ms_dict["createdAt"] = datetime.utcnow()
    result = await db.missed_sales.insert_one(ms_dict)
    ms_dict["id"] = str(result.inserted_id)
    return MissedSale(**ms_dict)

@api_router.get("/missed-sales", response_model=List[MissedSale])
async def get_missed_sales(date: Optional[str] = None, limit: int = 100):
    query = {}
    if date:
        query["date"] = date
    
    missed_sales = await db.missed_sales.find(query).sort("createdAt", -1).limit(limit).to_list(limit)
    return [MissedSale(id=str(ms["_id"]), **{k: v for k, v in ms.items() if k != "_id"}) for ms in missed_sales]

# ============ ROUTES - CUSTOMERS ============

@api_router.post("/customers", response_model=Customer)
async def create_customer(customer: CustomerCreate):
    customer_dict = customer.dict()
    
    # Validazione: se è società, partitaIva è obbligatoria
    if customer_dict.get("customerType") == "societa":
        if not customer_dict.get("partitaIva") or customer_dict.get("partitaIva").strip() == "":
            raise HTTPException(status_code=400, detail="Partita IVA obbligatoria per le società")
    
    customer_dict["createdAt"] = datetime.utcnow()
    result = await db.customers.insert_one(customer_dict)
    customer_dict["id"] = str(result.inserted_id)
    return Customer(**customer_dict)

@api_router.get("/customers", response_model=List[Customer])
async def get_customers(search: Optional[str] = None, limit: int = 100):
    query = {}
    if search:
        # Cerca sia per nome che per partita IVA
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"partitaIva": {"$regex": search, "$options": "i"}}
        ]
    
    customers = await db.customers.find(query).sort("name", 1).limit(limit).to_list(limit)
    return [Customer(id=str(c["_id"]), **{k: v for k, v in c.items() if k != "_id"}) for c in customers]

@api_router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str):
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    return Customer(id=str(customer["_id"]), **{k: v for k, v in customer.items() if k != "_id"})

@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, customer_update: CustomerUpdate):
    update_data = {k: v for k, v in customer_update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nessun dato da aggiornare")
    
    result = await db.customers.update_one(
        {"_id": ObjectId(customer_id)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    return Customer(id=str(customer["_id"]), **{k: v for k, v in customer.items() if k != "_id"})

@api_router.get("/customers/{customer_id}/orders", response_model=List[Order])
async def get_customer_orders(customer_id: str):
    orders = await db.orders.find({"customerId": customer_id}).sort("createdAt", -1).to_list(1000)
    return [Order(id=str(o["_id"]), **{k: v for k, v in o.items() if k != "_id"}) for o in orders]

# ============ ROUTES - REPORTS ============

@api_router.get("/reports/daily-summary")
async def get_daily_summary(date: str):
    """Get daily summary including total orders, revenue, and dish breakdown"""
    orders = await db.orders.find({
        "menuDate": date,
        "status": {"$ne": "annullato"}
    }).to_list(1000)
    
    total_orders = len(orders)
    total_revenue = sum(o["total"] for o in orders)
    
    # Dish breakdown
    dish_sales = {}
    for order in orders:
        for item in order["items"]:
            dish_id = item["dishId"]
            if dish_id not in dish_sales:
                dish_sales[dish_id] = {
                    "dishName": item["dishName"],
                    "quantity": 0,
                    "revenue": 0
                }
            dish_sales[dish_id]["quantity"] += item["quantity"]
            dish_sales[dish_id]["revenue"] += item["subtotal"]
    
    # Channel breakdown
    channel_counts = {}
    for order in orders:
        channel = order["channel"]
        channel_counts[channel] = channel_counts.get(channel, 0) + 1
    
    # Get menu info
    menu = await db.daily_menus.find_one({"date": date})
    menu_items = menu["items"] if menu else []
    
    return {
        "date": date,
        "totalOrders": total_orders,
        "totalRevenue": total_revenue,
        "dishSales": list(dish_sales.values()),
        "channelBreakdown": channel_counts,
        "menuItems": menu_items
    }

@api_router.get("/reports/top-dishes")
async def get_top_dishes(start_date: Optional[str] = None, end_date: Optional[str] = None, limit: int = 10):
    """Get most sold dishes"""
    query = {"status": {"$ne": "annullato"}}
    if start_date:
        query["menuDate"] = {"$gte": start_date}
    if end_date:
        if "menuDate" in query:
            query["menuDate"]["$lte"] = end_date
        else:
            query["menuDate"] = {"$lte": end_date}
    
    orders = await db.orders.find(query).to_list(10000)
    
    dish_sales = {}
    for order in orders:
        for item in order["items"]:
            dish_id = item["dishId"]
            if dish_id not in dish_sales:
                dish_sales[dish_id] = {
                    "dishId": dish_id,
                    "dishName": item["dishName"],
                    "totalQuantity": 0,
                    "totalRevenue": 0
                }
            dish_sales[dish_id]["totalQuantity"] += item["quantity"]
            dish_sales[dish_id]["totalRevenue"] += item["subtotal"]
    
    sorted_dishes = sorted(dish_sales.values(), key=lambda x: x["totalQuantity"], reverse=True)
    return sorted_dishes[:limit]

@api_router.get("/reports/missed-sales-summary")
async def get_missed_sales_summary(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get missed sales summary"""
    query = {}
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    missed_sales = await db.missed_sales.find(query).to_list(10000)
    
    dish_counts = {}
    reason_counts = {"esaurito": 0, "non_nel_menu": 0}
    
    for ms in missed_sales:
        dish_name = ms["dishName"]
        dish_counts[dish_name] = dish_counts.get(dish_name, 0) + 1
        reason = ms.get("reason", "esaurito")
        if reason in reason_counts:
            reason_counts[reason] += 1
    
    sorted_dishes = sorted(dish_counts.items(), key=lambda x: x[1], reverse=True)
    
    return {
        "totalMissedSales": len(missed_sales),
        "byDish": [{"dishName": d[0], "count": d[1]} for d in sorted_dishes],
        "byReason": reason_counts
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
