from fastapi import FastAPI, Depends, HTTPException, status, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import timedelta, datetime
import time
import logging
from pathlib import Path
import os

from .database import get_db, create_tables, User, Item, Cart, CartItem
from .schemas import (
    UserCreate, UserLogin, User as UserSchema, Token,
    ItemCreate, Item as ItemSchema,
    CartItemCreate, CartItemUpdate, Cart as CartSchema
)
from .auth import (
    authenticate_user, create_access_token, get_current_user,
    get_password_hash, ACCESS_TOKEN_EXPIRE_MINUTES
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

# Get environment
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
IS_PRODUCTION = ENVIRONMENT == 'production'

app = FastAPI(
    title="E-Commerce API",
    version="1.0.0",
    docs_url="/docs" if not IS_PRODUCTION else None,
    redoc_url=None
)

# Security middleware
if IS_PRODUCTION:
    app.add_middleware(HTTPSRedirectMiddleware)
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["yourdomain.com", "www.yourdomain.com"]
    )

# CORS middleware - Development settings
origins = [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Add CORS headers to all responses
@app.middleware("http")
async def add_cors_header(request: Request, call_next):
    response = await call_next(request)
    origin = request.headers.get('origin')
    if origin in origins:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response

# Gzip compression for responses
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response

# Import database URL from database.py
from .database import DATABASE_URL

# Create tables on startup
@app.on_event("startup")
async def startup_event():
    logger.info("Starting up application...")
    try:
        # Log database URL (masking password if present)
        masked_url = DATABASE_URL
        if '@' in DATABASE_URL:
            # Mask password in the URL
            protocol_part = DATABASE_URL.split('://')[0] + '://'
            rest = DATABASE_URL.split('://')[1]
            if '@' in rest:
                user_pass, server = rest.split('@', 1)
                if ':' in user_pass:
                    user = user_pass.split(':')[0]
                    masked_url = f"{protocol_part}{user}:********@{server}"
        
        logger.info(f"Using database: {masked_url}")
        
        # Test database connection
        logger.info("Testing database connection...")
        db = next(get_db())
        db.execute("SELECT 1")
        logger.info("Database connection test successful")
        
        # Create tables
        logger.info("Creating database tables...")
        create_tables()
        logger.info("Database tables created successfully")
        
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}", exc_info=True)
        raise

# Authentication endpoints
@app.post("/auth/signup", response_model=UserSchema)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    db_user = db.query(User).filter(
        (User.email == user.email) | (User.username == user.username)
    ).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Email or username already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        username=user.username,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Create cart for user
    cart = Cart(user_id=db_user.id)
    db.add(cart)
    db.commit()
    
    return db_user

@app.post("/auth/login", response_model=Token)
def login(user: UserLogin, db: Session = Depends(get_db)):
    authenticated_user = authenticate_user(db, user.email, user.password)
    if not authenticated_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": authenticated_user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "jwt"}

@app.post("/auth/logout")
def logout():
    # In a real application, you might want to blacklist the token
    return {"message": "Successfully logged out"}

# Item endpoints
@app.get("/items", response_model=List[ItemSchema])
def get_items(
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"Fetching items with filters - category: {category}, min_price: {min_price}, max_price: {max_price}, search: {search}")
        
        query = db.query(Item)
        
        # Apply filters
        if category:
            query = query.filter(Item.category == category)
        if min_price is not None:
            query = query.filter(Item.price >= min_price)
        if max_price is not None:
            query = query.filter(Item.price <= max_price)
        if search:
            query = query.filter(Item.name.contains(search))
        
        items = query.offset(skip).limit(limit).all()
        logger.info(f"Found {len(items)} items")
        
        # Convert SQLAlchemy models to dictionaries
        return [
            {
                "id": item.id,
                "name": item.name,
                "description": item.description,
                "price": float(item.price) if item.price is not None else 0.0,
                "category": item.category,
                "image_url": item.image_url,
                "stock_quantity": item.stock_quantity if hasattr(item, 'stock_quantity') else 0,
                "created_at": item.created_at.isoformat() if item.created_at else None
            }
            for item in items
        ]
    except Exception as e:
        logger.error(f"Error in get_items: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/items/{item_id}", response_model=ItemSchema)
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Convert SQLAlchemy model to dictionary for consistent response
    return {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "price": float(item.price) if item.price is not None else 0.0,
        "category": item.category,
        "image_url": item.image_url,
        "stock_quantity": item.stock_quantity if hasattr(item, 'stock_quantity') else 0,
        "created_at": item.created_at.isoformat() if item.created_at else None
    }

@app.post("/items", response_model=ItemSchema)
def create_item(item: ItemCreate, db: Session = Depends(get_db)):
    db_item = Item(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

# Cart endpoints
@app.get("/cart")
async def get_cart(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        # Get cart with items
        cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
        if not cart:
            # Create cart if it doesn't exist
            cart = Cart(user_id=current_user.id)
            db.add(cart)
            db.commit()
            db.refresh(cart)
            return {
                "id": cart.id,
                "user_id": cart.user_id,
                "items": [],
                "total_items": 0,
                "total_price": 0.0,
                "created_at": cart.created_at.isoformat() if cart.created_at else None,
                "updated_at": cart.updated_at.isoformat() if cart.updated_at else None
            }
        
        # Get cart items with product details
        cart_items = db.query(CartItem, Item).join(Item, CartItem.item_id == Item.id)\
            .filter(CartItem.cart_id == cart.id).all()
        
        # Calculate totals
        total_items = sum(ci.quantity for ci, _ in cart_items)
        total_price = sum(float(item.price) * ci.quantity for ci, item in cart_items)
        
        # Format response
        items = [{
            "id": ci.id,
            "item_id": ci.item_id,
            "name": item.name,
            "price": float(item.price) if item.price else 0.0,
            "quantity": ci.quantity,
            "image_url": item.image_url,
            "subtotal": float(item.price) * ci.quantity if item.price else 0.0
        } for ci, item in cart_items]
        
        return {
            "id": cart.id,
            "user_id": cart.user_id,
            "items": items,
            "total_items": total_items,
            "total_price": round(total_price, 2),
            "created_at": cart.created_at.isoformat() if cart.created_at else None,
            "updated_at": cart.updated_at.isoformat() if cart.updated_at else None
        }
        
    except Exception as e:
        logger.error(f"Error getting cart: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve cart")

@app.post("/cart/items")
async def add_to_cart(
    cart_item: CartItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Validate quantity
        if cart_item.quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than 0")
        
        # Get or create cart
        cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
        if not cart:
            cart = Cart(user_id=current_user.id)
            db.add(cart)
            db.commit()
            db.refresh(cart)
        
        # Check if item exists and is in stock
        item = db.query(Item).filter(Item.id == cart_item.item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
            
        if hasattr(item, 'stock_quantity') and item.stock_quantity <= 0:
            raise HTTPException(status_code=400, detail="Item is out of stock")
        
        # Check if item already in cart
        existing_cart_item = db.query(CartItem).filter(
            CartItem.cart_id == cart.id,
            CartItem.item_id == cart_item.item_id
        ).first()

        if existing_cart_item:
            # Check stock if updating quantity
            new_quantity = existing_cart_item.quantity + cart_item.quantity
            if hasattr(item, 'stock_quantity') and new_quantity > item.stock_quantity:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Only {item.stock_quantity} items available in stock"
                )
            existing_cart_item.quantity = new_quantity
        else:
            # Check stock for new item
            if hasattr(item, 'stock_quantity') and cart_item.quantity > item.stock_quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Only {item.stock_quantity} items available in stock"
                )
            # Add new item to cart
            existing_cart_item = CartItem(
                cart_id=cart.id,
                item_id=cart_item.item_id,
                quantity=cart_item.quantity
            )
            db.add(existing_cart_item)
        
        db.commit()
        
        # Get updated cart with all items
        updated_cart = db.query(Cart).filter(Cart.id == cart.id).first()
        db.refresh(updated_cart)
        
        # Get cart items with product details
        cart_items = db.query(CartItem, Item).join(Item, CartItem.item_id == Item.id)\
            .filter(CartItem.cart_id == cart.id).all()
        
        # Calculate totals
        total_items = sum(ci.quantity for ci, _ in cart_items)
        total_price = sum(float(item.price) * ci.quantity for ci, item in cart_items)
        
        # Format response
        items = [{
            "id": ci.id,
            "item_id": ci.item_id,
            "name": item.name,
            "price": float(item.price) if item.price else 0.0,
            "quantity": ci.quantity,
            "image_url": item.image_url,
            "subtotal": float(item.price) * ci.quantity if item.price else 0.0
        } for ci, item in cart_items]
        
        return {
            "success": True,
            "message": "Item added to cart",
            "cart": {
                "id": updated_cart.id,
                "user_id": updated_cart.user_id,
                "items": items,
                "total_items": total_items,
                "total_price": round(total_price, 2),
                "updated_at": updated_cart.updated_at.isoformat() if updated_cart.updated_at else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error adding to cart: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to add item to cart")

@app.put("/cart/items/{item_id}")
async def update_cart_item(
    item_id: int,
    cart_item_update: CartItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Validate quantity
        if cart_item_update.quantity < 0:
            raise HTTPException(status_code=400, detail="Quantity cannot be negative")
            
        # Get cart
        cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
        if not cart:
            raise HTTPException(status_code=404, detail="Cart not found")
        
        # Get cart item
        cart_item = db.query(CartItem).filter(
            CartItem.cart_id == cart.id,
            CartItem.item_id == item_id
        ).first()
        
        if not cart_item:
            raise HTTPException(status_code=404, detail="Item not found in cart")
        
        # Get item details for stock check
        item = db.query(Item).filter(Item.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
            
        # Check stock if updating quantity
        if hasattr(item, 'stock_quantity') and cart_item_update.quantity > item.stock_quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Only {item.stock_quantity} items available in stock"
            )
        
        if cart_item_update.quantity == 0:
            # Remove item if quantity is 0
            db.delete(cart_item)
        else:
            # Update quantity
            cart_item.quantity = cart_item_update.quantity
        
        db.commit()
        
        # Return updated cart
        return await get_cart(current_user, db)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating cart item: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update cart item")

@app.delete("/cart/items/clear", response_model=dict)
async def clear_cart(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Clear all items from the cart
    """
    try:
        # Get the user's cart
        cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
        if not cart:
            # Create a new cart if it doesn't exist
            cart = Cart(user_id=current_user.id)
            db.add(cart)
            db.commit()
            db.refresh(cart)
            return {"message": "Cart is already empty"}

        # Delete all cart items
        db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()
        db.commit()

        return {"message": "Cart cleared successfully"}

    except Exception as e:
        db.rollback()
        logger.error(f"Error clearing cart: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to clear cart")

@app.delete("/cart/items/{item_id}", response_model=dict)
async def remove_from_cart(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove an item from the cart
    """
    try:
        logger.info(f"Attempting to remove item {item_id} from cart for user {current_user.id}")
        
        # Get the user's cart
        cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
        if not cart:
            logger.warning(f"Cart not found for user {current_user.id}")
            raise HTTPException(status_code=404, detail="Cart not found")

        logger.info(f"Found cart {cart.id} for user {current_user.id}")

        # Find the cart item
        cart_item = db.query(CartItem).filter(
            CartItem.cart_id == cart.id,
            CartItem.item_id == item_id
        ).first()

        if not cart_item:
            logger.warning(f"Item {item_id} not found in cart {cart.id}")
            raise HTTPException(status_code=404, detail="Item not found in cart")

        logger.info(f"Found cart item {cart_item.id} to remove")

        # Remove the item
        db.delete(cart_item)
        
        # Update cart's updated_at timestamp
        cart.updated_at = datetime.utcnow()
        db.add(cart)
        
        # Commit the transaction
        db.commit()
        
        logger.info(f"Successfully removed item {item_id} from cart {cart.id}")
        return {"message": "Item removed from cart"}

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error removing item from cart: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to remove item from cart: {str(e)}")

# Categories endpoint
@app.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(Item.category).distinct().all()
    return [category[0] for category in categories if category[0]]  # Filter out None values

# Root route to serve welcome page
@app.get("/")
def read_root():
    from fastapi.responses import FileResponse
    return FileResponse("frontend/welcome.html")

# Mount static files at the end to avoid conflicts with API routes
app.mount("/static", StaticFiles(directory="frontend"), name="static")

if __name__ == "__main__":
    import uvicorn
    
    # Production configuration
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        workers=4 if IS_PRODUCTION else 1,
        proxy_headers=True,
        forwarded_allow_ips='*',
        timeout_keep_alive=30,
        limit_concurrency=100,
        limit_max_requests=1000,
        log_level="info" if IS_PRODUCTION else "debug",
        access_log=True if IS_PRODUCTION else False,
        ssl_keyfile=os.getenv("SSL_KEYFILE"),
        ssl_certfile=os.getenv("SSL_CERTFILE"),
    )
