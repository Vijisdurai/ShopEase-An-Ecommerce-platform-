from sqlalchemy.orm import Session
from backend.database import SessionLocal, Item, create_tables

def create_sample_items():
    """Create sample items for the e-commerce store."""
    db = SessionLocal()
    
    # Check if items already exist
    if db.query(Item).first():
        print("Sample data already exists!")
        db.close()
        return
    
    sample_items = [
        {
            "name": "Wireless Bluetooth Headphones",
            "description": "High-quality wireless headphones with noise cancellation and 30-hour battery life.",
            "price": 199.99,
            "category": "Electronics",
            "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=200&fit=crop",
            "stock_quantity": 50
        },
        {
            "name": "Smartphone Case",
            "description": "Durable protective case for smartphones with shock absorption.",
            "price": 24.99,
            "category": "Electronics",
            "image_url": "https://images.unsplash.com/photo-1556656793-08538906a9f8?w=300&h=200&fit=crop",
            "stock_quantity": 100
        },
        {
            "name": "Cotton T-Shirt",
            "description": "Comfortable 100% cotton t-shirt available in multiple colors.",
            "price": 19.99,
            "category": "Clothing",
            "image_url": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=200&fit=crop",
            "stock_quantity": 75
        },
        {
            "name": "Denim Jeans",
            "description": "Classic fit denim jeans made from premium quality fabric.",
            "price": 79.99,
            "category": "Clothing",
            "image_url": "https://images.unsplash.com/photo-1542272604-787c3835535d?w=300&h=200&fit=crop",
            "stock_quantity": 40
        },
        {
            "name": "Running Shoes",
            "description": "Lightweight running shoes with excellent cushioning and support.",
            "price": 129.99,
            "category": "Sports",
            "image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=200&fit=crop",
            "stock_quantity": 60
        },
        {
            "name": "Yoga Mat",
            "description": "Non-slip yoga mat perfect for all types of workouts and meditation.",
            "price": 39.99,
            "category": "Sports",
            "image_url": "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=300&h=200&fit=crop",
            "stock_quantity": 30
        },
        {
            "name": "Coffee Maker",
            "description": "Programmable coffee maker with 12-cup capacity and auto-shutoff feature.",
            "price": 89.99,
            "category": "Home",
            "image_url": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop",
            "stock_quantity": 25
        },
        {
            "name": "Desk Lamp",
            "description": "Adjustable LED desk lamp with multiple brightness settings and USB charging port.",
            "price": 49.99,
            "category": "Home",
            "image_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=200&fit=crop",
            "stock_quantity": 45
        },
        {
            "name": "Backpack",
            "description": "Durable travel backpack with multiple compartments and laptop sleeve.",
            "price": 69.99,
            "category": "Accessories",
            "image_url": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300&h=200&fit=crop",
            "stock_quantity": 35
        },
        {
            "name": "Sunglasses",
            "description": "Stylish sunglasses with UV protection and polarized lenses.",
            "price": 59.99,
            "category": "Accessories",
            "image_url": "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=300&h=200&fit=crop",
            "stock_quantity": 80
        }
    ]
    
    for item_data in sample_items:
        item = Item(**item_data)
        db.add(item)
    
    db.commit()
    print(f"Created {len(sample_items)} sample items!")
    db.close()

if __name__ == "__main__":
    create_tables()
    create_sample_items()
