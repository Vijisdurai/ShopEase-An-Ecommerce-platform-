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

from backend.database import get_db, create_tables, User, Item, Cart, CartItem
from backend.schemas import (
    UserCreate, UserLogin, User as UserSchema, Token,
    ItemCreate, Item as ItemSchema,
    CartItemCreate, CartItemUpdate, Cart as CartSchema
)
from backend.auth import (
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

# CORS middleware - Configure allowed origins in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if not IS_PRODUCTION else ["https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=600,  # Cache preflight request for 10 minutes
)

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

# Create tables on startup
@app.on_event("startup")
def startup_event():
    create_tables()

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
    return items

@app.get("/items/{item_id}", response_model=ItemSchema)
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@app.post("/items", response_model=ItemSchema)
def create_item(item: ItemCreate, db: Session = Depends(get_db)):
    db_item = Item(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

# Cart endpoints
@app.get("/cart", response_model=CartSchema)
def get_cart(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
    if not cart:
        # Create cart if it doesn't exist
        cart = Cart(user_id=current_user.id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart

@app.post("/cart/items")
def add_to_cart(
    cart_item: CartItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get or create cart
    cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
    if not cart:
        cart = Cart(user_id=current_user.id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    
    # Check if item exists
    item = db.query(Item).filter(Item.id == cart_item.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Check if item already in cart
    existing_cart_item = db.query(CartItem).filter(
        CartItem.cart_id == cart.id,
        CartItem.item_id == cart_item.item_id
    ).first()
    
    if existing_cart_item:
        # Update quantity
        existing_cart_item.quantity += cart_item.quantity
        db.commit()
        return {"message": "Item quantity updated in cart"}
    else:
        # Add new item to cart
        db_cart_item = CartItem(
            cart_id=cart.id,
            item_id=cart_item.item_id,
            quantity=cart_item.quantity
        )
        db.add(db_cart_item)
        db.commit()
        return {"message": "Item added to cart"}

@app.put("/cart/items/{item_id}")
def update_cart_item(
    item_id: int,
    cart_item_update: CartItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    cart_item = db.query(CartItem).filter(
        CartItem.cart_id == cart.id,
        CartItem.item_id == item_id
    ).first()
    
    if not cart_item:
        raise HTTPException(status_code=404, detail="Item not found in cart")
    
    if cart_item_update.quantity <= 0:
        db.delete(cart_item)
    else:
        cart_item.quantity = cart_item_update.quantity
    
    db.commit()
    return {"message": "Cart item updated"}

@app.delete("/cart/items/{item_id}")
def remove_from_cart(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    cart_item = db.query(CartItem).filter(
        CartItem.cart_id == cart.id,
        CartItem.item_id == item_id
    ).first()
    
    if not cart_item:
        raise HTTPException(status_code=404, detail="Item not found in cart")
    
    db.delete(cart_item)
    db.commit()
    return {"message": "Item removed from cart"}

# Categories endpoint
@app.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(Item.category).distinct().all()
    return [category[0] for category in categories]

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
