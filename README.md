# E-Commerce Web Application

A full-stack e-commerce web application built with FastAPI backend and vanilla JavaScript frontend.

## Features

### Backend (FastAPI)
- **JWT Authentication**: Secure signup, login, and logout functionality
- **User Management**: User registration with email and username validation
- **Product Management**: CRUD operations for items with filtering capabilities
- **Cart Management**: User-specific cart with persistent storage in database
- **Database**: SQLite with SQLAlchemy ORM (easily configurable to PostgreSQL)

### Frontend (HTML/CSS/JavaScript)
- **Responsive Design**: Built with TailwindCSS for modern, mobile-first UI
- **Authentication Pages**: Modal-based login and signup forms
- **Product Listing**: Grid layout with search and filter functionality
- **Shopping Cart**: Real-time cart management with quantity controls
- **JWT Integration**: Secure API communication with token-based authentication

## Project Structure

```
e-commerace/
├── backend/
│   ├── __init__.py
│   ├── main.py          # FastAPI application and routes
│   ├── database.py      # SQLAlchemy models and database setup
│   ├── schemas.py       # Pydantic models for API validation
│   ├── auth.py          # JWT authentication logic
│   └── seed_data.py     # Sample data creation script
├── frontend/
│   ├── index.html       # Main application page
│   └── js/
│       ├── auth.js      # Authentication management
│       ├── cart.js      # Cart functionality
│       └── app.js       # Main application logic
├── requirements.txt     # Python dependencies
└── README.md           # This file
```

## API Endpoints

### Authentication
- `POST /auth/signup` - Create new user account
- `POST /auth/login` - User login (returns JWT token)
- `POST /auth/logout` - User logout

### Items
- `GET /items` - Get all items with optional filters
  - Query parameters: `category`, `min_price`, `max_price`, `search`, `skip`, `limit`
- `GET /items/{item_id}` - Get specific item
- `POST /items` - Create new item

### Cart (Requires Authentication)
- `GET /cart` - Get user's cart
- `POST /cart/items` - Add item to cart
- `PUT /cart/items/{item_id}` - Update item quantity in cart
- `DELETE /cart/items/{item_id}` - Remove item from cart

### Categories
- `GET /categories` - Get all available categories

## Database Schema

### Users Table
- `id` (Primary Key)
- `email` (Unique)
- `username` (Unique)
- `hashed_password`
- `created_at`

### Items Table
- `id` (Primary Key)
- `name`
- `description`
- `price`
- `category`
- `image_url`
- `stock_quantity`
- `created_at`

### Carts Table
- `id` (Primary Key)
- `user_id` (Foreign Key, Unique)
- `created_at`
- `updated_at`

### Cart Items Table
- `id` (Primary Key)
- `cart_id` (Foreign Key)
- `item_id` (Foreign Key)
- `quantity`
- `added_at`

## Setup Instructions

### Prerequisites
- Python 3.8 or higher
- pip (Python package installer)

### Installation

1. **Clone or download the project**
   ```bash
   cd e-commerace
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Create sample data (optional)**
   ```bash
   python -m backend.seed_data
   ```

4. **Run the FastAPI server**
   ```bash
   python -m backend.main
   ```
   
   Or using uvicorn directly:
   ```bash
   uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
   ```

5. **Access the application**
   - Open your browser and go to: `http://localhost:8000/static/index.html`
   - API documentation available at: `http://localhost:8000/docs`

## Usage

### For Users
1. **Sign Up**: Create a new account with email, username, and password
2. **Login**: Access your account to start shopping
3. **Browse Products**: Use filters to find products by category, price range, or search terms
4. **Add to Cart**: Click "Add to Cart" on any product (requires login)
5. **Manage Cart**: View, update quantities, or remove items from your cart
6. **Persistent Cart**: Your cart items are saved and restored when you log back in

### For Developers
- The backend serves the frontend static files automatically
- JWT tokens are stored in localStorage and included in API requests
- Cart data is tied to user accounts with no localStorage dependency
- Database is created automatically on first run
- CORS is enabled for development

## Key Features

### Authentication
- Secure password hashing with bcrypt
- JWT tokens with configurable expiration
- Protected routes requiring authentication
- Automatic cart creation for new users

### Cart Management
- Database-persistent cart (no localStorage dependency)
- One cart per user (enforced by unique constraint)
- Real-time quantity updates
- Seamless cart restoration on login

### Product Filtering
- Search by product name
- Filter by category
- Price range filtering (min/max)
- Pagination support

### Frontend Architecture
- Modular JavaScript with separate files for auth, cart, and app logic
- Event-driven architecture with proper separation of concerns
- Responsive design with TailwindCSS
- Modal-based UI for authentication and cart

## Configuration

### Environment Variables
- `DATABASE_URL`: Database connection string (defaults to SQLite)
- `SECRET_KEY`: JWT signing key (change in production)

### Database
The application uses SQLite by default. To use PostgreSQL:
1. Install psycopg2: `pip install psycopg2-binary`
2. Set `DATABASE_URL` environment variable:
   ```
   DATABASE_URL=postgresql://username:password@localhost/dbname
   ```

## Security Notes

- Change the `SECRET_KEY` in `backend/auth.py` for production use
- The application includes CORS middleware for development
- JWT tokens expire after 30 minutes (configurable)
- Passwords are hashed using bcrypt

## Troubleshooting

### Common Issues
1. **Port already in use**: Change the port in the uvicorn command
2. **Database errors**: Ensure write permissions in the project directory
3. **CORS errors**: Make sure the backend is running on the expected port
4. **Authentication issues**: Check that JWT tokens are being sent in headers

### Development Tips
- Use the `/docs` endpoint to test API endpoints directly
- Check browser console for JavaScript errors
- Monitor the FastAPI logs for backend issues
- Use the seed data script to populate the database with sample products
