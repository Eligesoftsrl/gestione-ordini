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
from datetime import datetime
from bson import ObjectId
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=False)  # NON sovrascrivere le variabili di produzione

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')

# DB_NAME viene passato da Emergent in produzione
# In preview usa il default catering-dashboard-3
DB_NAME = os.environ.get('DB_NAME', 'catering-dashboard-3')

print(f"MONGO_URL: {mongo_url[:50]}...")
print(f"DB_NAME: {DB_NAME}")

try:
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
    db = client[DB_NAME]
    print(f"MongoDB client initialized successfully")
except Exception as e:
    print(f"ERROR connecting to MongoDB: {e}")
    # Fallback to localhost if Atlas fails
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client[DB_NAME]
    print(f"Fallback to localhost")

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

# Debug endpoint to check DB connection
@api_router.get("/debug/db-info")
async def get_db_info():
    """Returns info about current database connection"""
    return {
        "database_name": DB_NAME,
        "mongo_url": mongo_url.replace(mongo_url.split("@")[-1].split("/")[0] if "@" in mongo_url else "", "***") if "@" in mongo_url else mongo_url,
        "collections": await db.list_collection_names()
    }

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
    initialPortions: Optional[int] = None  # Porzioni iniziali (per tracciamento)
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
    dishId: Optional[str] = None  # None per piatti liberi
    dishName: str
    quantity: int
    unitPrice: float
    subtotal: float
    itemStatus: str = "pending"  # DERIVATO da portionStatuses (pending / in_preparazione / ready / problem)
    isCustomItem: bool = False
    sendToKitchen: bool = False
    portionStatuses: List[str] = []  # 1 stato per porzione (lunghezza = quantity)
    notes: Optional[str] = ""

# Ordini (Orders)
class OrderBase(BaseModel):
    channel: str  # whatsapp, telefono, persona
    serviceType: str = "in_sede"  # in_sede, da_ritirare, da_consegnare
    items: List[OrderItemBase] = []
    total: float = 0
    status: str = "in_attesa"  # in_attesa, in_preparazione, pronto, sospeso, consegnato
    isPaid: bool = True  # Default: ordine pagato. Il cliente segna come non pagato se necessario
    receiptImage: Optional[str] = None  # Base64 image of receipt
    customerId: Optional[str] = None
    customerName: Optional[str] = None
    notes: Optional[str] = ""
    deliveryTime: Optional[str] = ""  # Ora di consegna (es. "13:30"), opzionale

class OrderCreate(BaseModel):
    channel: str
    serviceType: str = "in_sede"  # Default: CONSUMA IN SEDE
    customerId: Optional[str] = None
    customerName: Optional[str] = None
    notes: Optional[str] = ""
    deliveryTime: Optional[str] = ""

class OrderUpdateCustomer(BaseModel):
    customerId: Optional[str] = None
    customerName: Optional[str] = None

class OrderUpdateInfo(BaseModel):
    """Generic patch endpoint for editable order header fields."""
    customerId: Optional[str] = None
    customerName: Optional[str] = None
    notes: Optional[str] = None
    deliveryTime: Optional[str] = None
    serviceType: Optional[str] = None

class OrderAddItem(BaseModel):
    dishId: Optional[str] = None  # None per piatti liberi
    dishName: Optional[str] = None  # Nome per piatti liberi
    quantity: int
    customPrice: Optional[float] = None  # Prezzo personalizzato (opzionale)
    notes: Optional[str] = ""  # Note per singola voce

class OrderUpdateStatus(BaseModel):
    status: str

class OrderItemStatusUpdate(BaseModel):
    itemStatus: str  # pending, ready, problem

class OrderItemUpdate(BaseModel):
    """Update editable fields of an order item. Allowed fields depend on isCustomItem."""
    quantity: Optional[int] = None
    notes: Optional[str] = None
    dishName: Optional[str] = None     # solo per piatti liberi
    unitPrice: Optional[float] = None  # solo per piatti liberi
    sendToKitchen: Optional[bool] = None  # flag "manda in cucina" (per tutti i piatti)

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
        "initialPortions": item.portions,  # Salva le porzioni iniziali
        "dailyPrice": item.dailyPrice,
        "notes": item.notes or ""
    }
    
    # LOG: Aggiunta piatto al menu
    logger.info(f"[PORZIONI] AGGIUNTA MENU - Piatto: {dish['name']}, Porzioni iniziali: {item.portions}, Menu ID: {menu_id}")
    
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
    # Get current state for logging
    menu = await db.daily_menus.find_one({"_id": ObjectId(menu_id)})
    current_item = None
    if menu:
        for item in menu.get('items', []):
            if item.get('dishId') == dish_id:
                current_item = item
                break
    
    update_fields = {}
    if item_update.portions is not None:
        update_fields["items.$.portions"] = item_update.portions
        # LOG: Modifica porzioni
        logger.info(f"[PORZIONI] MODIFICA MENU - Piatto: {current_item.get('dishName') if current_item else dish_id}, "
                   f"Porzioni PRIMA: {current_item.get('portions') if current_item else 'N/A'}, "
                   f"Porzioni DOPO: {item_update.portions}, Menu ID: {menu_id}")
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
        "serviceType": order.serviceType,
        "items": [],
        "total": 0,
        "status": "in_attesa",
        "isPaid": True,  # Default: ordine pagato
        "customerId": order.customerId,
        "customerName": order.customerName,
        "notes": order.notes or "",
        "deliveryTime": order.deliveryTime or "",
        "createdAt": datetime.utcnow()
    }
    
    result = await db.orders.insert_one(order_dict)
    order_dict["id"] = str(result.inserted_id)
    return Order(**order_dict)

@api_router.get("/orders", response_model=List[Order])
async def get_orders(
    menu_date: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    unpaid_only: bool = False,
):
    query = {}
    if menu_date:
        query["menuDate"] = menu_date
    elif date_from or date_to:
        date_query = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to
        query["menuDate"] = date_query
    if status:
        query["status"] = status
    if unpaid_only:
        query["isPaid"] = {"$ne": True}
    
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
    
    # CASO 1: Piatto libero (senza dishId)
    if not item.dishId:
        if not item.dishName:
            raise HTTPException(status_code=400, detail="Nome piatto richiesto per piatto libero")
        if item.customPrice is None or item.customPrice < 0:
            raise HTTPException(status_code=400, detail="Prezzo richiesto per piatto libero")
        
        # Create custom order item
        subtotal = item.customPrice * item.quantity
        order_item = {
            "dishId": None,
            "dishName": item.dishName,
            "quantity": item.quantity,
            "unitPrice": item.customPrice,
            "subtotal": subtotal,
            "isCustomItem": True,
            "itemStatus": "pending",
            "portionStatuses": ["pending"] * item.quantity,
            "notes": item.notes or ""
        }
        
        # Update order
        new_total = order["total"] + subtotal
        # If the order was already marked as ready/delivered, reset to "in_preparazione"
        # since adding new items means there is work to do again.
        update_set = {"total": new_total}
        if order.get("status") in ("pronto", "consegnato"):
            update_set["status"] = "in_preparazione"
            logger.info(f"[ORDINE] Stato resettato a 'in_preparazione' dopo aggiunta piatto (era: {order.get('status')})")
        await db.orders.update_one(
            {"_id": ObjectId(order_id)},
            {
                "$push": {"items": order_item},
                "$set": update_set
            }
        )
        
        logger.info(f"[ORDINE] Aggiunto piatto libero: {item.dishName} x{item.quantity} @ {item.customPrice}€")
        
        updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
        return Order(id=str(updated_order["_id"]), **{k: v for k, v in updated_order.items() if k != "_id"})
    
    # CASO 2: Piatto da menu (con dishId)
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
    
    # Check portions availability
    if menu_item["portions"] < item.quantity:
        raise HTTPException(
            status_code=400, 
            detail=f"Porzioni insufficienti. Disponibili: {menu_item['portions']}"
        )
    
    # Usa prezzo personalizzato se fornito, altrimenti prezzo del menu
    unit_price = item.customPrice if item.customPrice is not None else menu_item["dailyPrice"]
    subtotal = unit_price * item.quantity
    
    # Create order item
    order_item = {
        "dishId": item.dishId,
        "dishName": menu_item["dishName"],
        "quantity": item.quantity,
        "unitPrice": unit_price,
        "subtotal": subtotal,
        "isCustomItem": False,
        "itemStatus": "pending",
        "portionStatuses": ["pending"] * item.quantity,
        "notes": item.notes or ""
    }
    
    # Se il prezzo è stato modificato, logga
    if item.customPrice is not None and item.customPrice != menu_item["dailyPrice"]:
        logger.info(f"[ORDINE] Prezzo modificato per {menu_item['dishName']}: {menu_item['dailyPrice']}€ -> {unit_price}€")
    
    # Update order with new item and recalculate total
    new_total = order["total"] + subtotal
    # If the order was already marked as ready/delivered, reset to "in_preparazione"
    # since adding new items means there is work to do again.
    update_set = {"total": new_total}
    if order.get("status") in ("pronto", "consegnato"):
        update_set["status"] = "in_preparazione"
        logger.info(f"[ORDINE] Stato resettato a 'in_preparazione' dopo aggiunta piatto (era: {order.get('status')})")
    
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {
            "$push": {"items": order_item},
            "$set": update_set
        }
    )
    
    # Decrease portions in menu
    new_portions = menu_item["portions"] - item.quantity
    
    logger.info(f"[PORZIONI] ORDINE AGGIUNTO - Piatto: {menu_item['dishName']}, "
               f"Quantità ordinata: {item.quantity}, "
               f"Porzioni PRIMA: {menu_item['portions']}, Porzioni DOPO: {new_portions}, "
               f"Ordine ID: {order_id}")
    
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

@api_router.delete("/orders/{order_id}/items/by-index/{item_index}", response_model=Order)
async def remove_order_item_by_index(order_id: str, item_index: int):
    """Remove an item from order by its array index. Useful for custom items without dishId."""
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    
    items = order.get("items", [])
    if item_index < 0 or item_index >= len(items):
        raise HTTPException(status_code=404, detail="Indice piatto non valido")
    
    item_to_remove = items[item_index]
    
    # Calculate new total
    new_total = order["total"] - item_to_remove["subtotal"]
    
    # Remove item from array
    items.pop(item_index)
    
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"items": items, "total": new_total}}
    )
    
    # Restore portions in menu only for non-custom items
    dish_id = item_to_remove.get("dishId")
    if dish_id and not item_to_remove.get("isCustomItem"):
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

@api_router.patch("/orders/{order_id}/items/by-index/{item_index}", response_model=Order)
async def update_order_item(order_id: str, item_index: int, update: OrderItemUpdate):
    """Modifica i campi di un singolo item dell'ordine.
    - Item con isCustomItem=True (piatto libero): consente dishName, quantity, unitPrice, notes
    - Item con isCustomItem=False (da menu): consente solo quantity e notes
    Ricalcola subtotal e total automaticamente.
    Per piatti da menu, aggiorna le porzioni del menu se quantity cambia.
    """
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")

    items = order.get("items", [])
    if item_index < 0 or item_index >= len(items):
        raise HTTPException(status_code=404, detail="Indice piatto non valido")

    item = items[item_index]
    is_custom = item.get("isCustomItem", False)
    old_qty = item["quantity"]
    old_subtotal = item["subtotal"]

    # Aggiorna quantity (consentito per tutti)
    new_qty = update.quantity if update.quantity is not None else old_qty
    if new_qty < 1:
        raise HTTPException(status_code=400, detail="Quantità deve essere >= 1")
    item["quantity"] = new_qty

    # Aggiorna notes (consentito per tutti)
    if update.notes is not None:
        item["notes"] = update.notes

    # Campi extra solo per piatti liberi
    if is_custom:
        if update.dishName is not None:
            if not update.dishName.strip():
                raise HTTPException(status_code=400, detail="Nome piatto non può essere vuoto")
            item["dishName"] = update.dishName.strip()
        if update.unitPrice is not None:
            if update.unitPrice < 0:
                raise HTTPException(status_code=400, detail="Prezzo deve essere >= 0")
            item["unitPrice"] = update.unitPrice
    else:
        if update.dishName is not None or update.unitPrice is not None:
            raise HTTPException(
                status_code=400,
                detail="Su un piatto da menu si possono modificare solo quantità e note"
            )

    # Flag "manda in cucina" (consentito per tutti)
    # Se stiamo ATTIVANDO il flag (era false, diventa true), resettiamo TUTTE le porzioni a 'pending':
    # mandare un piatto in cucina implica che NON è ancora stato preparato.
    kitchen_activated = False
    if update.sendToKitchen is not None:
        was_kitchen = item.get("sendToKitchen", False)
        item["sendToKitchen"] = update.sendToKitchen
        if update.sendToKitchen and not was_kitchen:
            item["portionStatuses"] = ["pending"] * int(item.get("quantity", 1))
            item["itemStatus"] = "pending"
            kitchen_activated = True

    # Ricalcola subtotal
    item["subtotal"] = item["unitPrice"] * item["quantity"]

    # Riallinea portionStatuses alla nuova quantity (append pending / trim se necessario)
    item = ensure_portion_statuses(item)

    # Aggiorna total ordine
    new_total = order["total"] - old_subtotal + item["subtotal"]
    items[item_index] = item

    # Aggiorna porzioni menu per piatti collegati a menu (diff di quantità)
    qty_diff = new_qty - old_qty
    if qty_diff != 0 and not is_custom and item.get("dishId"):
        menu = await db.daily_menus.find_one({"date": order["menuDate"]})
        if menu:
            for mi in menu["items"]:
                if mi["dishId"] == item["dishId"]:
                    # qty_diff > 0 = serve più stock = riduci porzioni
                    new_portions = mi["portions"] - qty_diff
                    if new_portions < 0:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Porzioni insufficienti. Disponibili: {mi['portions']}"
                        )
                    await db.daily_menus.update_one(
                        {"_id": ObjectId(menu["_id"]), "items.dishId": item["dishId"]},
                        {"$set": {"items.$.portions": new_portions}}
                    )
                    logger.info(
                        f"[PORZIONI] MODIFICA QUANTITÀ - Piatto: {item['dishName']}, "
                        f"diff: {qty_diff:+d}, Porzioni DOPO: {new_portions}"
                    )
                    break

    # Se il flag cucina è stato attivato, ricalcola lo status dell'ordine
    # (perché abbiamo forzato itemStatus a 'pending' su questo item)
    update_fields: dict = {"items": items, "total": new_total}
    if kitchen_activated:
        update_fields["status"] = calculate_order_status(items)

    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": update_fields}
    )

    logger.info(f"[ORDINE] Modificato item #{item_index} ordine {order_id}: {item['dishName']}")

    updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return Order(id=str(updated_order["_id"]), **{k: v for k, v in updated_order.items() if k != "_id"})

@api_router.patch("/orders/{order_id}", response_model=Order)
async def update_order_info(order_id: str, update: OrderUpdateInfo):
    """Update editable header fields of an order: customer, notes, deliveryTime, serviceType."""
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    
    update_dict = {}
    if update.customerId is not None:
        update_dict["customerId"] = update.customerId
    if update.customerName is not None:
        update_dict["customerName"] = update.customerName
    if update.notes is not None:
        update_dict["notes"] = update.notes
    if update.deliveryTime is not None:
        update_dict["deliveryTime"] = update.deliveryTime
    if update.serviceType is not None:
        if update.serviceType not in ("in_sede", "da_ritirare", "da_consegnare"):
            raise HTTPException(status_code=400, detail="serviceType non valido")
        update_dict["serviceType"] = update.serviceType
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="Nessun dato da aggiornare")
    
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": update_dict}
    )
    logger.info(f"[ORDINE] Aggiornati campi {list(update_dict.keys())} per ordine {order_id}")
    
    updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return Order(id=str(updated_order["_id"]), **{k: v for k, v in updated_order.items() if k != "_id"})

@api_router.put("/orders/{order_id}/status", response_model=Order)
async def update_order_status(order_id: str, status_update: OrderUpdateStatus):
    valid_statuses = ["in_attesa", "in_preparazione", "pronto", "sospeso", "consegnato"]
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

# Helper: derive item status from portionStatuses list
def derive_item_status(item: dict) -> str:
    """Deriva itemStatus da portionStatuses:
    - Se assente/vuoto: fallback al vecchio itemStatus
    - any problem -> problem
    - all ready -> ready
    - mix (>=1 ready ma non tutti) -> in_preparazione
    - tutti pending -> pending
    """
    ps = item.get("portionStatuses") or []
    if not ps:
        return item.get("itemStatus", "pending")
    if "problem" in ps:
        return "problem"
    if all(s == "ready" for s in ps):
        return "ready"
    if any(s == "ready" for s in ps):
        return "in_preparazione"
    return "pending"


def ensure_portion_statuses(item: dict) -> dict:
    """Garantisce che l'item abbia portionStatuses coerente con quantity.
    Migra automaticamente items legacy (senza portionStatuses) usando itemStatus."""
    qty = int(item.get("quantity", 1))
    ps = list(item.get("portionStatuses") or [])
    legacy_status = item.get("itemStatus", "pending")
    if not ps:
        # Migrazione: replica lo status per tutte le porzioni
        ps = [legacy_status] * qty
    elif len(ps) < qty:
        # Aggiunta porzioni: nuove sono pending
        ps = ps + ["pending"] * (qty - len(ps))
    elif len(ps) > qty:
        # Rimozione porzioni: taglia
        ps = ps[:qty]
    item["portionStatuses"] = ps
    item["itemStatus"] = derive_item_status(item)
    return item


# Helper function to calculate order status based on item statuses
def calculate_order_status(items):
    """
    Calculate order status based on portion-level statuses:
    - All pending -> in_attesa
    - Any ready but not all -> in_preparazione
    - All ready -> pronto
    - Any problem -> sospeso
    """
    if not items:
        return "in_attesa"

    # Raccoglie tutti gli status di tutte le porzioni di tutti gli item
    all_portion_statuses = []
    for item in items:
        ps = item.get("portionStatuses") or []
        if ps:
            all_portion_statuses.extend(ps)
        else:
            # Legacy item: usa itemStatus replicato per quantity
            qty = int(item.get("quantity", 1))
            all_portion_statuses.extend([item.get("itemStatus", "pending")] * qty)

    if not all_portion_statuses:
        return "in_attesa"

    if "problem" in all_portion_statuses:
        return "sospeso"
    if all(s == "ready" for s in all_portion_statuses):
        return "pronto"
    if any(s == "ready" for s in all_portion_statuses):
        return "in_preparazione"
    return "in_attesa"

@api_router.put("/orders/{order_id}/items/{dish_id}/status", response_model=Order)
async def update_order_item_status(order_id: str, dish_id: str, status_update: OrderItemStatusUpdate):
    """Update the status of a specific item in an order and auto-update order status"""
    if status_update.itemStatus not in ["pending", "ready", "problem"]:
        raise HTTPException(status_code=400, detail="Status piatto non valido")
    
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    
    # Find and update the item
    item_found = False
    for item in order["items"]:
        if item["dishId"] == dish_id:
            item["itemStatus"] = status_update.itemStatus
            item_found = True
            break
    
    if not item_found:
        raise HTTPException(status_code=404, detail="Piatto non trovato nell'ordine")
    
    # Calculate new order status based on item statuses
    new_order_status = calculate_order_status(order["items"])
    
    # Update order
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "items": order["items"],
            "status": new_order_status
        }}
    )
    
    updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return Order(id=str(updated_order["_id"]), **{k: v for k, v in updated_order.items() if k != "_id"})

@api_router.put("/orders/{order_id}/items/by-index/{item_index}/status", response_model=Order)
async def update_order_item_status_by_index(order_id: str, item_index: int, status_update: OrderItemStatusUpdate):
    """Update the status of ALL portions of an item by its array index (Cucina 'Completa' o toggle globale)."""
    if status_update.itemStatus not in ["pending", "ready", "problem"]:
        raise HTTPException(status_code=400, detail="Status piatto non valido")
    
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    
    items = order.get("items", [])
    if item_index < 0 or item_index >= len(items):
        raise HTTPException(status_code=404, detail="Indice piatto non valido")
    
    # Assicura portionStatuses coerente
    items[item_index] = ensure_portion_statuses(items[item_index])
    # Applica lo status a TUTTE le porzioni
    qty = int(items[item_index].get("quantity", 1))
    items[item_index]["portionStatuses"] = [status_update.itemStatus] * qty
    items[item_index]["itemStatus"] = derive_item_status(items[item_index])
    
    # Calculate new order status based on all portion statuses
    new_order_status = calculate_order_status(items)
    
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"items": items, "status": new_order_status}}
    )
    
    updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return Order(id=str(updated_order["_id"]), **{k: v for k, v in updated_order.items() if k != "_id"})


@api_router.put("/orders/{order_id}/items/by-index/{item_index}/portion/{portion_index}/status", response_model=Order)
async def update_order_portion_status(order_id: str, item_index: int, portion_index: int, status_update: OrderItemStatusUpdate):
    """Aggiorna lo status di UNA singola porzione (usato da Porzionatura per granularità).
    Il portion_index è 0-based su portionStatuses. Ricalcola itemStatus e order.status."""
    if status_update.itemStatus not in ["pending", "ready", "problem"]:
        raise HTTPException(status_code=400, detail="Status porzione non valido")

    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")

    items = order.get("items", [])
    if item_index < 0 or item_index >= len(items):
        raise HTTPException(status_code=404, detail="Indice piatto non valido")

    items[item_index] = ensure_portion_statuses(items[item_index])
    ps = items[item_index]["portionStatuses"]
    if portion_index < 0 or portion_index >= len(ps):
        raise HTTPException(status_code=404, detail="Indice porzione non valido")

    ps[portion_index] = status_update.itemStatus
    items[item_index]["portionStatuses"] = ps
    items[item_index]["itemStatus"] = derive_item_status(items[item_index])

    new_order_status = calculate_order_status(items)

    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"items": items, "status": new_order_status}}
    )

    updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return Order(id=str(updated_order["_id"]), **{k: v for k, v in updated_order.items() if k != "_id"})

# ============ ROUTES - MISSED SALES ============

# Model for payment status update
class OrderPaymentUpdate(BaseModel):
    isPaid: bool

class OrderReceiptUpdate(BaseModel):
    receiptImage: str  # Base64 encoded image

@api_router.put("/orders/{order_id}/payment", response_model=Order)
async def update_order_payment(order_id: str, payment_update: OrderPaymentUpdate):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"isPaid": payment_update.isPaid}}
    )
    
    updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return Order(id=str(updated_order["_id"]), **{k: v for k, v in updated_order.items() if k != "_id"})

@api_router.put("/orders/{order_id}/receipt", response_model=Order)
async def update_order_receipt(order_id: str, receipt_update: OrderReceiptUpdate):
    """Upload receipt image for an order"""
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"receiptImage": receipt_update.receiptImage}}
    )
    
    updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return Order(id=str(updated_order["_id"]), **{k: v for k, v in updated_order.items() if k != "_id"})

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str):
    """Delete an order and restore portions to the daily menu"""
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    
    # Restore portions for each item (only non-custom items)
    menu = await db.daily_menus.find_one({"date": order["menuDate"]})
    if menu:
        for item in order.get("items", []):
            if item.get("dishId") and not item.get("isCustomItem"):
                for mi in menu["items"]:
                    if mi["dishId"] == item["dishId"]:
                        new_portions = mi["portions"] + item["quantity"]
                        await db.daily_menus.update_one(
                            {"_id": ObjectId(menu["_id"]), "items.dishId": item["dishId"]},
                            {"$set": {"items.$.portions": new_portions}}
                        )
                        logger.info(f"[PORZIONI] ORDINE CANCELLATO - Piatto: {item['dishName']}, Ripristinate: {item['quantity']}, Porzioni DOPO: {new_portions}")
                        break
    
    # Delete the order
    await db.orders.delete_one({"_id": ObjectId(order_id)})
    
    return {"message": "Ordine cancellato", "orderId": order_id}

@api_router.delete("/orders/{order_id}/receipt", response_model=Order)
async def delete_order_receipt(order_id: str):
    """Delete receipt image from an order"""
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"receiptImage": None}}
    )
    
    updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return Order(id=str(updated_order["_id"]), **{k: v for k, v in updated_order.items() if k != "_id"})

@api_router.get("/customers/{customer_id}/unpaid-orders")
async def get_customer_unpaid_orders(customer_id: str):
    """Get all unpaid orders for a specific customer"""
    unpaid_orders = await db.orders.find({
        "customerId": customer_id,
        "isPaid": {"$ne": True}  # isPaid is false or not set
    }).sort("createdAt", -1).to_list(100)
    
    return [Order(id=str(o["_id"]), **{k: v for k, v in o.items() if k != "_id"}) for o in unpaid_orders]

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
async def get_customers(search: Optional[str] = None, limit: int = 5000):
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

@api_router.get("/kitchen")
async def get_kitchen_items(menu_date: str):
    """Vista Cucina: elenca i piatti flag `sendToKitchen=True` per il giorno specificato,
    raggruppati per nome piatto (dishName case-insensitive). Ogni gruppo mostra tutti gli
    ordini con quel piatto, con quantità/cliente/ordine/servizio/ora consegna.
    Include SIA i piatti pending SIA quelli ready (per stile barrato)."""
    orders = await db.orders.find({
        "menuDate": menu_date,
        "status": {"$ne": "annullato"},
    }).to_list(2000)

    groups: dict[str, dict] = {}
    for order in orders:
        for idx, item in enumerate(order.get("items", [])):
            if not item.get("sendToKitchen"):
                continue
            key = item["dishName"].strip().lower()
            if key not in groups:
                groups[key] = {
                    "dishName": item["dishName"].strip(),
                    "totalQuantity": 0,
                    "pendingQuantity": 0,
                    "entries": [],
                }
            groups[key]["totalQuantity"] += item["quantity"]
            if item.get("itemStatus", "pending") != "ready":
                groups[key]["pendingQuantity"] += item["quantity"]
            groups[key]["entries"].append({
                "orderId": str(order["_id"]),
                "orderNumber": order["orderNumber"],
                "itemIndex": idx,
                "quantity": item["quantity"],
                "customerName": order.get("customerName") or "",
                "serviceType": order.get("serviceType", "in_sede"),
                "deliveryTime": order.get("deliveryTime") or "",
                "notes": item.get("notes") or "",
                "itemStatus": item.get("itemStatus", "pending"),
                "isCustomItem": item.get("isCustomItem", False),
            })

    # Ordina i gruppi per nome piatto; entries ordinati per orario consegna (vuote in fondo)
    result = []
    for g in sorted(groups.values(), key=lambda x: x["dishName"].lower()):
        g["entries"].sort(key=lambda e: (e["deliveryTime"] == "", e["deliveryTime"], e["orderNumber"]))
        result.append(g)
    return result


@api_router.get("/porzionatura")
async def get_porzionatura_items(menu_date: str):
    """Vista Porzionatura: elenca TUTTI i piatti degli ordini del giorno che NON hanno
    flag sendToKitchen (mutuamente esclusivi con la vista Cucina), raggruppati per nome.
    Ogni entry rappresenta un item dell'ordine; se quantity > 1, il frontend mostrerà
    N righe visive che condividono lo stesso itemStatus (una conferma = tutte pronte).
    Include SIA piatti pending SIA ready (per stile barrato)."""
    orders = await db.orders.find({
        "menuDate": menu_date,
        "status": {"$ne": "annullato"},
    }).to_list(2000)

    groups: dict[str, dict] = {}
    for order in orders:
        for idx, item in enumerate(order.get("items", [])):
            # Escludi piatti in Cucina (settori mutuamente esclusivi)
            if item.get("sendToKitchen"):
                continue
            # Assicura portionStatuses coerente (per items legacy)
            ps = list(item.get("portionStatuses") or [])
            qty = int(item.get("quantity", 1))
            if not ps:
                legacy_status = item.get("itemStatus", "pending")
                ps = [legacy_status] * qty
            elif len(ps) < qty:
                ps = ps + ["pending"] * (qty - len(ps))
            elif len(ps) > qty:
                ps = ps[:qty]

            key = item["dishName"].strip().lower()
            if key not in groups:
                groups[key] = {
                    "dishName": item["dishName"].strip(),
                    "totalQuantity": 0,
                    "pendingQuantity": 0,
                    "entries": [],
                }
            groups[key]["totalQuantity"] += qty
            groups[key]["pendingQuantity"] += sum(1 for s in ps if s != "ready")
            groups[key]["entries"].append({
                "orderId": str(order["_id"]),
                "orderNumber": order["orderNumber"],
                "itemIndex": idx,
                "quantity": qty,
                "portionStatuses": ps,
                "customerName": order.get("customerName") or "",
                "serviceType": order.get("serviceType", "in_sede"),
                "deliveryTime": order.get("deliveryTime") or "",
                "notes": item.get("notes") or "",
                "itemStatus": item.get("itemStatus", "pending"),
                "isCustomItem": item.get("isCustomItem", False),
            })

    # Ordina gruppi per nome; entries per orario consegna crescente (vuote in fondo)
    result = []
    for g in sorted(groups.values(), key=lambda x: x["dishName"].lower()):
        g["entries"].sort(key=lambda e: (e["deliveryTime"] == "", e["deliveryTime"], e["orderNumber"]))
        result.append(g)
    return result


@api_router.get("/reports/daily-summary")
async def get_daily_summary(date: str):
    """Get daily summary including total orders, revenue, and dish breakdown"""
    orders = await db.orders.find({
        "menuDate": date,
        "status": {"$ne": "annullato"}
    }).to_list(1000)
    
    total_orders = len(orders)
    total_revenue = sum(o["total"] for o in orders)
    
    # Dish breakdown - key: dishId if valid, altrimenti nome normalizzato
    # (evita di aggregare tutti i piatti liberi con dishId=None sotto la stessa chiave)
    dish_sales = {}
    for order in orders:
        for item in order["items"]:
            dish_id = item.get("dishId")
            key = dish_id if dish_id else f"custom::{item['dishName'].strip().lower()}"
            if key not in dish_sales:
                dish_sales[key] = {
                    "dishName": item["dishName"],
                    "quantity": 0,
                    "revenue": 0
                }
            dish_sales[key]["quantity"] += item["quantity"]
            dish_sales[key]["revenue"] += item["subtotal"]
    
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
            dish_id = item.get("dishId")
            key = dish_id if dish_id else f"custom::{item['dishName'].strip().lower()}"
            if key not in dish_sales:
                dish_sales[key] = {
                    "dishId": dish_id,
                    "dishName": item["dishName"],
                    "totalQuantity": 0,
                    "totalRevenue": 0
                }
            dish_sales[key]["totalQuantity"] += item["quantity"]
            dish_sales[key]["totalRevenue"] += item["subtotal"]
    
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

# ============ SCHEMA DI RIFERIMENTO ============
# Lo schema "ideale" - il Setup Database allinea il DB a questo schema
SCHEMA_REFERENCE = {
    "categories": {
        "fields": ["name", "order", "createdAt"],
        "defaults": [
            {"name": "Primi", "order": 1},
            {"name": "Secondi", "order": 2},
            {"name": "Contorni", "order": 3},
            {"name": "Piatti Freddi", "order": 4},
            {"name": "Fuori Menù", "order": 5},
            {"name": "Dolci", "order": 6},
            {"name": "Bibite", "order": 7},
            {"name": "Insalate", "order": 8},
        ]
    },
    "dishes": {
        "fields": ["name", "description", "basePrice", "categoryId", "active", "isFavorite", "createdAt"],
        "field_defaults": {
            "description": "",
            "basePrice": 0.0,
            "categoryId": None,
            "active": True,
            "isFavorite": False,
        }
    },
    "customers": {
        "fields": ["name", "phone", "email", "notes", "createdAt"],
        "field_defaults": {
            "phone": "",
            "email": "",
            "notes": "",
        }
    },
    "orders": {
        "fields": ["orderNumber", "menuDate", "channel", "serviceType", "items", "total", "status", "customerId", "customerName", "notes", "isPaid", "createdAt"],
        "field_defaults": {
            "channel": "persona",
            "serviceType": "in_sede",  # Default: CONSUMA IN SEDE
            "items": [],
            "total": 0.0,
            "status": "in_attesa",
            "customerId": None,
            "customerName": None,
            "notes": "",
            "isPaid": True,  # Default: ordine pagato
        },
        "items_fields": ["dishId", "dishName", "quantity", "unitPrice", "subtotal", "itemStatus", "isCustomItem", "notes"],
        "items_defaults": {
            "itemStatus": "pending",
            "isCustomItem": False,
            "notes": "",
        }
    },
    "daily_menus": {
        "fields": ["date", "items", "createdAt"],
        "items_fields": ["dishId", "dishName", "portions", "initialPortions", "price", "categoryId"],
    },
    "missed_sales": {
        "fields": ["date", "dishId", "dishName", "quantity", "createdAt"],
        "field_defaults": {
            "quantity": 1,
        }
    }
}

# ============ SETUP/MIGRATION ENDPOINT ============
@api_router.post("/setup")
async def setup_database():
    """
    Allinea il database allo SCHEMA_REFERENCE:
    - Crea collezioni mancanti
    - Aggiunge documenti predefiniti (categorie)
    - Aggiunge campi mancanti a tutti i documenti esistenti
    """
    results = {
        "collections_created": [],
        "categories_added": 0,
        "dishes_updated": 0,
        "orders_updated": 0,
        "orders_serviceType_added": 0,
        "orders_deliveryTime_added": 0,
        "orders_items_notes_added": 0,
        "customers_updated": 0,
        "menus_updated": 0,
        "missed_sales_updated": 0,
        "message": ""
    }
    
    # ============ 1. CREA COLLEZIONI MANCANTI ============
    existing_collections = await db.list_collection_names()
    for collection_name in SCHEMA_REFERENCE.keys():
        if collection_name not in existing_collections:
            await db.create_collection(collection_name)
            results["collections_created"].append(collection_name)
            logger.info(f"[SETUP] Creata collezione: {collection_name}")
    
    # ============ 2. CATEGORIE PREDEFINITE ============
    for cat in SCHEMA_REFERENCE["categories"]["defaults"]:
        exists = await db.categories.find_one({"name": cat["name"]})
        if not exists:
            cat_doc = {**cat, "createdAt": datetime.utcnow().isoformat()}
            await db.categories.insert_one(cat_doc)
            results["categories_added"] += 1
            logger.info(f"[SETUP] Aggiunta categoria: {cat['name']}")
    
    # ============ 2. DISHES - Campi mancanti ============
    # Struttura completa: name, description, basePrice, categoryId, active, isFavorite, createdAt
    dishes_defaults = {
        "description": "",
        "basePrice": 0.0,
        "categoryId": None,
        "active": True,
        "isFavorite": False,
    }
    
    all_dishes = await db.dishes.find({}).to_list(10000)
    for dish in all_dishes:
        updates = {}
        for field, default_value in dishes_defaults.items():
            if field not in dish or dish[field] is None:
                updates[field] = default_value
        
        if updates:
            await db.dishes.update_one({"_id": dish["_id"]}, {"$set": updates})
            results["dishes_updated"] += 1
            logger.info(f"[SETUP] Dish {dish.get('name')}: aggiunti campi {list(updates.keys())}")
    
    # ============ 3. ORDERS - Campi mancanti ============
    orders_defaults = {
        "channel": "persona",
        "serviceType": "in_sede",  # Default: CONSUMA IN SEDE
        "items": [],
        "total": 0.0,
        "status": "in_attesa",
        "customerId": None,
        "customerName": None,
        "notes": "",
        "deliveryTime": "",  # NEW: ora di consegna opzionale
        "isPaid": True,  # Default: ordine pagato
    }
    
    # Default per items dentro gli ordini
    order_items_defaults = {
        "itemStatus": "pending",
        "isCustomItem": False,
        "notes": "",
    }
    
    all_orders = await db.orders.find({}).to_list(10000)
    for order in all_orders:
        updates = {}
        for field, default_value in orders_defaults.items():
            if field not in order:
                updates[field] = default_value
                # Conta specificamente serviceType
                if field == "serviceType":
                    results["orders_serviceType_added"] += 1
                    logger.info(f"[SETUP] Order #{order.get('orderNumber')}: AGGIUNTO serviceType = 'in_sede'")
                if field == "deliveryTime":
                    results["orders_deliveryTime_added"] += 1
                    logger.info(f"[SETUP] Order #{order.get('orderNumber')}: AGGIUNTO deliveryTime = ''")
        
        # Caso speciale: customerName mancante ma customerId presente
        if (not order.get("customerName") or order.get("customerName") == "") and order.get("customerId"):
            customer_id = order["customerId"]
            try:
                if isinstance(customer_id, str) and len(customer_id) == 24:
                    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
                else:
                    customer = await db.customers.find_one({"_id": customer_id})
                
                if customer:
                    updates["customerName"] = customer.get("name", "Cliente")
            except Exception as e:
                logger.warning(f"[SETUP] Errore recupero cliente {customer_id}: {e}")
        
        # Aggiorna items dell'ordine con campi mancanti
        items = order.get("items", [])
        items_updated = False
        for item in items:
            for field, default_value in order_items_defaults.items():
                if field not in item:
                    item[field] = default_value
                    items_updated = True
                    # Conta specificamente notes sugli items
                    if field == "notes":
                        results["orders_items_notes_added"] += 1
        
        if items_updated:
            updates["items"] = items
        
        if updates:
            await db.orders.update_one({"_id": order["_id"]}, {"$set": updates})
            results["orders_updated"] += 1
            logger.info(f"[SETUP] Order {order.get('orderNumber')}: aggiunti campi {list(updates.keys())}")
    
    # ============ 4. CUSTOMERS - Campi mancanti ============
    # Struttura completa: name, phone, email, notes, createdAt
    customers_defaults = {
        "phone": "",
        "email": "",
        "notes": "",
    }
    
    all_customers = await db.customers.find({}).to_list(10000)
    for customer in all_customers:
        updates = {}
        for field, default_value in customers_defaults.items():
            if field not in customer:
                updates[field] = default_value
        
        if updates:
            await db.customers.update_one({"_id": customer["_id"]}, {"$set": updates})
            results["customers_updated"] += 1
            logger.info(f"[SETUP] Customer {customer.get('name')}: aggiunti campi {list(updates.keys())}")
    
    # ============ 5. DAILY_MENUS - Campi mancanti negli items ============
    # Struttura items: dishId, dishName, portions, initialPortions, price, categoryId
    all_menus = await db.daily_menus.find({}).to_list(10000)
    for menu in all_menus:
        menu_updated = False
        items = menu.get("items", [])
        
        for i, item in enumerate(items):
            item_updates = {}
            
            # Aggiungi initialPortions se mancante
            if "initialPortions" not in item or item["initialPortions"] is None:
                # Calcola porzioni vendute
                orders = await db.orders.find({"menuDate": menu["date"]}).to_list(1000)
                sold = 0
                for order in orders:
                    for order_item in order.get("items", []):
                        if order_item.get("dishId") == item.get("dishId"):
                            sold += order_item.get("quantity", 0)
                
                item["initialPortions"] = item.get("portions", 0) + sold
                menu_updated = True
            
            # Aggiungi categoryId se mancante
            if "categoryId" not in item or item["categoryId"] is None:
                # Cerca il piatto per ottenere categoryId
                dish_id = item.get("dishId")
                if dish_id:
                    try:
                        dish = await db.dishes.find_one({"_id": ObjectId(dish_id) if isinstance(dish_id, str) and len(dish_id) == 24 else dish_id})
                        if dish:
                            item["categoryId"] = dish.get("categoryId")
                            menu_updated = True
                    except Exception:
                        pass
            
            # Aggiungi price se mancante
            if "price" not in item:
                dish_id = item.get("dishId")
                if dish_id:
                    try:
                        dish = await db.dishes.find_one({"_id": ObjectId(dish_id) if isinstance(dish_id, str) and len(dish_id) == 24 else dish_id})
                        if dish:
                            item["price"] = dish.get("basePrice", 0)
                            menu_updated = True
                    except Exception:
                        pass
        
        if menu_updated:
            await db.daily_menus.update_one(
                {"_id": menu["_id"]},
                {"$set": {"items": items}}
            )
            results["menus_updated"] += 1
            logger.info(f"[SETUP] Menu {menu.get('date')}: aggiornati items")
    
    # ============ 6. CREA INDICI SE MANCANTI ============
    try:
        await db.orders.create_index([("menuDate", 1)])
        await db.orders.create_index([("customerId", 1)])
        await db.orders.create_index([("status", 1)])
        await db.dishes.create_index([("categoryId", 1)])
        await db.dishes.create_index([("active", 1)])
        await db.daily_menus.create_index([("date", 1)], unique=True)
        logger.info("[SETUP] Indici creati/verificati")
    except Exception as e:
        logger.warning(f"[SETUP] Errore creazione indici: {e}")
    
    # Messaggio finale con dettagli specifici
    messages = ["Setup completato! Database allineato."]
    if results["orders_serviceType_added"] > 0:
        messages.append(f"✅ SERVICETYPE aggiunto a {results['orders_serviceType_added']} ordini")
    if results["orders_deliveryTime_added"] > 0:
        messages.append(f"✅ DELIVERYTIME (ora consegna) aggiunto a {results['orders_deliveryTime_added']} ordini")
    if results["orders_items_notes_added"] > 0:
        messages.append(f"✅ NOTES aggiunto a {results['orders_items_notes_added']} piatti negli ordini")
    
    results["message"] = " | ".join(messages)
    logger.info(f"[SETUP] Completato: {results}")
    return results

@api_router.get("/setup/status")
async def setup_status():
    """Verifica lo stato del database rispetto allo SCHEMA_REFERENCE"""
    # Collezioni esistenti
    existing_collections = await db.list_collection_names()
    missing_collections = [c for c in SCHEMA_REFERENCE.keys() if c not in existing_collections]
    
    # Conta documenti
    categories = await db.categories.count_documents({})
    dishes = await db.dishes.count_documents({})
    customers = await db.customers.count_documents({})
    orders = await db.orders.count_documents({})
    menus = await db.daily_menus.count_documents({})
    missed_sales = await db.missed_sales.count_documents({}) if "missed_sales" in existing_collections else 0
    
    # Check campi mancanti
    issues = {
        "missing_collections": missing_collections,
        "missing_categories": max(0, 8 - categories),
        "missing_initialPortions": 0,
        "missing_isFavorite": 0,
        "missing_isPaid": 0,
    }
    
    # Controlla initialPortions nei menu
    menus_data = await db.daily_menus.find({}).to_list(100)
    for menu in menus_data:
        for item in menu.get("items", []):
            if "initialPortions" not in item or item["initialPortions"] is None:
                issues["missing_initialPortions"] += 1
    
    # Controlla isFavorite nei piatti
    issues["missing_isFavorite"] = await db.dishes.count_documents({
        "$or": [{"isFavorite": {"$exists": False}}, {"isFavorite": None}]
    })
    
    # Controlla isPaid negli ordini
    issues["missing_isPaid"] = await db.orders.count_documents({
        "isPaid": {"$exists": False}
    })
    
    # Determina stato
    has_issues = (
        len(missing_collections) > 0 or
        issues["missing_categories"] > 0 or
        issues["missing_initialPortions"] > 0 or
        issues["missing_isFavorite"] > 0 or
        issues["missing_isPaid"] > 0
    )
    
    return {
        "database": DB_NAME,
        "schema_version": "1.0",
        "collections": {
            "categories": categories,
            "dishes": dishes,
            "customers": customers,
            "orders": orders,
            "daily_menus": menus,
            "missed_sales": missed_sales,
        },
        "issues": issues,
        "status": "needs_setup" if has_issues else "ok"
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
