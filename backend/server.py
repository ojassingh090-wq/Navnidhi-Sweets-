import os
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from pathlib import Path
import json

import uuid
import asyncio
import requests

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator, EmailStr
from typing_extensions import Annotated
from bson import ObjectId
import bcrypt
import jwt

# Load environment variables first
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB setup
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# --- Object Storage (Emergent) ---
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "navnidhi-sweets"
storage_key = None

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "svg": "image/svg+xml",
}

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def _put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    if resp.status_code == 403:
        # storage_key expired, re-init once
        global storage_key
        storage_key = None
        key = init_storage()
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120
        )
    resp.raise_for_status()
    return resp.json()

def _get_object(path: str) -> tuple:
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# Main App
app = FastAPI(title="Navnidhi Sweets API", version="1.0.0")

# Router
api_router = APIRouter(prefix="/api")

# JWT Configuration
JWT_SECRET = os.environ.get("JWT_SECRET", "d4af37bf1c39055ee83b0f5e0a0a0a09e5c865fvh7hzeyfvh7hzeyfvh7hzey12")
JWT_ALGORITHM = "HS256"

# Password Hashing Helpers
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

# JWT Token Helpers
def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24), # Expire in 24 hours for seamless usage
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# --- Pydantic & MongoDB Adherence Models ---
PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]

class BaseDocument(BaseModel):
    id: PyObjectId = Field(default_factory=lambda: str(ObjectId()), alias="_id")

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True
    }

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True)
        if "_id" in data and isinstance(data["_id"], str):
            try:
                data["_id"] = ObjectId(data["_id"])
            except Exception:
                pass
        return data

    @classmethod
    def from_mongo(cls, data: dict):
        if not data:
            return None
        return cls(**data)

# Document Models
class UserDoc(BaseDocument):
    email: str
    password_hash: str
    name: str
    role: str = "admin"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductDoc(BaseDocument):
    category: str
    item: str
    is_sweet: bool
    price_250g: Optional[float] = None
    price_500g: Optional[float] = None
    price_1kg: Optional[float] = None
    description: str = "Premium organic sweet"
    price: float
    unit: str = "Kg"
    image_url: str = ""
    is_featured: bool = False
    in_stock: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InquiryDoc(BaseDocument):
    name: str
    email: str = ""
    phone: str
    subject: str = ""
    message: str
    status: str = "pending" # pending, resolved
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReviewDoc(BaseDocument):
    name: str
    rating: int = 5 # 1-5
    comment: str
    approved: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SiteSettingsUpdate(BaseModel):
    logo_url: Optional[str] = None
    hero_url: Optional[str] = None

# API Request/Response Models
class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ProductCreateUpdate(BaseModel):
    category: str
    item: str
    is_sweet: bool
    price_250g: Optional[float] = None
    price_500g: Optional[float] = None
    price_1kg: Optional[float] = None
    description: str = "Premium organic sweet"
    price: float
    unit: str = "Kg"
    image_url: str = ""
    is_featured: bool = False
    in_stock: bool = True

class InquiryCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = ""
    phone: str
    subject: Optional[str] = ""
    message: str

class ReviewCreate(BaseModel):
    name: str
    rating: int = Field(5, ge=1, le=5)
    comment: str

# Dependency to get current user
async def get_current_user(request: Request) -> UserDoc:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User ID missing from token")
            
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        
        return UserDoc.from_mongo(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

# --- AUTH ENDPOINTS ---
@api_router.post("/auth/login")
async def login(credentials: LoginRequest, response: Response):
    email = credentials.email.lower().strip()
    
    # Brute Force Protection check
    identifier = f"login_attempt:{email}"
    lockout = await db.login_attempts.find_one({"identifier": identifier})
    if lockout:
        attempts = lockout.get("attempts", 0)
        last_attempt = lockout.get("last_attempt")
        if attempts >= 5:
            # Check if 15 minutes have passed
            if datetime.now(timezone.utc) - last_attempt.replace(tzinfo=timezone.utc) < timedelta(minutes=15):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS, 
                    detail="Too many failed login attempts. Locked out for 15 minutes."
                )
            else:
                # Expired, reset attempts
                await db.login_attempts.delete_one({"identifier": identifier})

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        # Increment failed login attempts
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {
                "$inc": {"attempts": 1},
                "$set": {"last_attempt": datetime.now(timezone.utc)}
            },
            upsert=True
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    
    # Successful login, delete lockout record
    await db.login_attempts.delete_one({"identifier": identifier})
    
    user_obj = UserDoc.from_mongo(user)
    access_token = create_access_token(user_obj.id, user_obj.email)
    refresh_token = create_refresh_token(user_obj.id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return UserResponse(id=user_obj.id, email=user_obj.email, name=user_obj.name, role=user_obj.role)

@api_router.post("/auth/logout")
async def logout(response: Response, current_user: UserDoc = Depends(get_current_user)):
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {"message": "Logged out successfully"}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: UserDoc = Depends(get_current_user)):
    return UserResponse(id=current_user.id, email=current_user.email, name=current_user.name, role=current_user.role)

# --- PRODUCTS ENDPOINTS ---
@api_router.get("/products", response_model=List[ProductDoc])
async def get_products(category: Optional[str] = None, featured: Optional[bool] = None, search: Optional[str] = None):
    query = {}
    if category:
        query["category"] = category
    if featured is not None:
        query["is_featured"] = featured
    if search:
        query["item"] = {"$regex": search, "$options": "i"}
        
    cursor = db.products.find(query)
    results = await cursor.to_list(length=1000)
    return [ProductDoc.from_mongo(r) for r in results]

@api_router.post("/products", response_model=ProductDoc, status_code=status.HTTP_201_CREATED)
async def create_product(product_in: ProductCreateUpdate, current_user: UserDoc = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can manage products")
    
    prod = ProductDoc(**product_in.model_dump())
    await db.products.insert_one(prod.to_mongo())
    return prod

@api_router.put("/products/{id}", response_model=ProductDoc)
async def update_product(id: str, product_in: ProductCreateUpdate, current_user: UserDoc = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can manage products")
    
    existing = await db.products.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    
    prod = ProductDoc.from_mongo(existing)
    # Update fields
    for field, value in product_in.model_dump().items():
        setattr(prod, field, value)
        
    await db.products.replace_one({"_id": ObjectId(id)}, prod.to_mongo())
    return prod

@api_router.delete("/products/{id}")
async def delete_product(id: str, current_user: UserDoc = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can manage products")
    
    result = await db.products.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return {"message": "Product deleted successfully"}

# --- INQUIRIES ENDPOINTS ---
@api_router.post("/inquiries", response_model=InquiryDoc, status_code=status.HTTP_201_CREATED)
async def create_inquiry(inquiry_in: InquiryCreate):
    inquiry = InquiryDoc(**inquiry_in.model_dump())
    await db.inquiries.insert_one(inquiry.to_mongo())
    return inquiry

@api_router.get("/inquiries", response_model=List[InquiryDoc])
async def get_inquiries(current_user: UserDoc = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can view inquiries")
    
    cursor = db.inquiries.find().sort("created_at", -1)
    results = await cursor.to_list(length=1000)
    return [InquiryDoc.from_mongo(r) for r in results]

@api_router.put("/inquiries/{id}/resolve", response_model=InquiryDoc)
async def resolve_inquiry(id: str, current_user: UserDoc = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can manage inquiries")
    
    existing = await db.inquiries.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inquiry not found")
        
    inquiry = InquiryDoc.from_mongo(existing)
    inquiry.status = "resolved"
    await db.inquiries.replace_one({"_id": ObjectId(id)}, inquiry.to_mongo())
    return inquiry

@api_router.delete("/inquiries/{id}")
async def delete_inquiry(id: str, current_user: UserDoc = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can manage inquiries")
    
    result = await db.inquiries.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inquiry not found")
    return {"message": "Inquiry deleted successfully"}

# --- REVIEWS ENDPOINTS ---
@api_router.get("/reviews", response_model=List[ReviewDoc])
async def get_approved_reviews():
    cursor = db.reviews.find({"approved": True}).sort("created_at", -1)
    results = await cursor.to_list(length=100)
    return [ReviewDoc.from_mongo(r) for r in results]

@api_router.post("/reviews", response_model=ReviewDoc, status_code=status.HTTP_201_CREATED)
async def create_review(review_in: ReviewCreate):
    review = ReviewDoc(**review_in.model_dump())
    # Users submitted reviews default to approved=True for immediate visual feedback, with full Admin management
    review.approved = True
    await db.reviews.insert_one(review.to_mongo())
    return review

@api_router.get("/admin/reviews", response_model=List[ReviewDoc])
async def get_all_reviews_admin(current_user: UserDoc = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can access all reviews")
    
    cursor = db.reviews.find().sort("created_at", -1)
    results = await cursor.to_list(length=1000)
    return [ReviewDoc.from_mongo(r) for r in results]

@api_router.put("/admin/reviews/{id}/toggle-approve", response_model=ReviewDoc)
async def toggle_approve_review(id: str, current_user: UserDoc = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can approve reviews")
    
    existing = await db.reviews.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
        
    review = ReviewDoc.from_mongo(existing)
    review.approved = not review.approved
    await db.reviews.replace_one({"_id": ObjectId(id)}, review.to_mongo())
    return review

@api_router.delete("/admin/reviews/{id}")
async def delete_review(id: str, current_user: UserDoc = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can delete reviews")
    
    result = await db.reviews.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    return {"message": "Review deleted successfully"}


# --- FILE UPLOAD & STORAGE ENDPOINTS ---
@api_router.post("/upload")
async def upload_image(file: UploadFile = File(...), current_user: UserDoc = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can upload images")

    ext = (file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin")
    if ext not in MIME_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only image files (jpg, png, gif, webp, svg) are allowed")

    content_type = MIME_TYPES[ext]
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image too large. Max 10MB allowed.")

    path = f"{APP_NAME}/uploads/{uuid.uuid4()}.{ext}"
    try:
        result = await asyncio.to_thread(_put_object, path, data, content_type)
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Image upload failed. Please try again.")

    stored_path = result["path"]
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "storage_path": stored_path,
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"path": stored_path, "url": f"/api/files/{stored_path}"}

@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    try:
        data, content_type = await asyncio.to_thread(_get_object, path)
    except Exception as e:
        logger.error(f"File fetch failed: {e}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return Response(
        content=data,
        media_type=record.get("content_type", content_type),
        headers={"Cache-Control": "public, max-age=31536000"}
    )

# --- SITE SETTINGS ENDPOINTS (logo & hero banner) ---
@api_router.get("/settings")
async def get_settings():
    doc = await db.site_settings.find_one({"key": "site"})
    if not doc:
        return {"logo_url": "", "hero_url": ""}
    return {"logo_url": doc.get("logo_url", ""), "hero_url": doc.get("hero_url", "")}

@api_router.put("/settings")
async def update_settings(payload: SiteSettingsUpdate, current_user: UserDoc = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can update settings")
    update_fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    await db.site_settings.update_one(
        {"key": "site"},
        {"$set": {**update_fields, "key": "site"}},
        upsert=True
    )
    doc = await db.site_settings.find_one({"key": "site"})
    return {"logo_url": doc.get("logo_url", ""), "hero_url": doc.get("hero_url", "")}


# Seed database on startup
@app.on_event("startup")
async def startup_event():
    # 0. Initialize object storage
    try:
        await asyncio.to_thread(init_storage)
        logger.info("Object storage initialized successfully.")
    except Exception as e:
        logger.error(f"Object storage init failed: {e}")

    # 1. Create indexes
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    
    # 2. Seed Admin user if empty
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@navnidhisweets.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Purity@Navnidhi108")
    
    admin_exist = await db.users.find_one({"email": admin_email})
    if not admin_exist:
        hashed_pwd = hash_password(admin_password)
        admin_doc = UserDoc(
            email=admin_email,
            password_hash=hashed_pwd,
            name="Navnidhi Admin",
            role="admin"
        )
        await db.users.insert_one(admin_doc.to_mongo())
        logger.info(f"Admin user seeded with email: {admin_email}")
    else:
        # Update password if changed in env
        if not verify_password(admin_password, admin_exist["password_hash"]):
            await db.users.update_one(
                {"email": admin_email},
                {"$set": {"password_hash": hash_password(admin_password)}}
            )
            logger.info("Admin password updated successfully.")

    # 3. Seed Products if empty
    product_count = await db.products.count_documents({})
    if product_count == 0:
        parsed_file = Path("/app/parsed_products.json")
        if parsed_file.exists():
            with open(parsed_file, "r") as f:
                products_list = json.load(f)
            
            # Map of categories/items to high-quality premium image links
            image_map = {
                # Sweets categories
                "Kaju & Dryfruit Sweets": "https://images.unsplash.com/photo-1707548074900-a61fe836ecba?q=80&w=600&auto=format&fit=crop",
                "Khoya Items": "https://images.unsplash.com/photo-1587314168485-3236d6710814?q=80&w=600&auto=format&fit=crop",
                "Ghee & Besan Items": "https://images.unsplash.com/photo-1626132647523-66f5bf380027?q=80&w=600&auto=format&fit=crop",
                "Sugar Free Sweets": "https://images.unsplash.com/photo-1772986236859-b16543cea543?q=80&w=600&auto=format&fit=crop",
                # Other food categories
                "CHAAT": "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=600&auto=format&fit=crop",
                "DESI DELIGHTS": "https://images.unsplash.com/photo-1626132647523-66f5bf380027?q=80&w=600&auto=format&fit=crop",
                "Snacks": "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?q=80&w=600&auto=format&fit=crop"
            }
            
            # Specific items to flag as featured & assign exact beautiful photos
            featured_items = {
                "Kaju Katli": ("https://images.unsplash.com/photo-1707548074900-a61fe836ecba?q=80&w=600&auto=format&fit=crop", "World-famous thin fudge made of premium cashews and organic sugar syrup, coated with delicate edible silver foil."),
                "Kesar Motichoor Ladoo": ("https://images.unsplash.com/photo-1626132647523-66f5bf380027?q=80&w=600&auto=format&fit=crop", "Delectable gold-glistening pearls of pure desi ghee besan, laced with premium organic saffron."),
                "Gulab Jamun": ("https://images.pexels.com/photos/15014918/pexels-photo-15014918.jpeg", "Sponge-soft golden fried milk solid dumplings steeped in aromatic cardamom infused organic sugar syrup."),
                "Raj Kachori": ("https://images.unsplash.com/photo-1601050690597-df056fb4ce78?q=80&w=600&auto=format&fit=crop", "Royal crispy hollow shell packed with organic sprouts, boiled potatoes, dynamic sweet yogurt, and zesty chutneys."),
                "Chole Bhature (2Pc)": ("https://images.unsplash.com/photo-1626132647523-66f5bf380027?q=80&w=600&auto=format&fit=crop", "Fluffy white-flour puffed bread served with rich organic chickpeas cooked in authentic Punjabi secret spice blend."),
                "Dodha Burfi": ("https://images.unsplash.com/photo-1587314168485-3236d6710814?q=80&w=600&auto=format&fit=crop", "Traditional slow-cooked grainy fudge made of wholesome germinated wheat, organic milk, and crunchy dry fruits.")
            }
            
            inserted_count = 0
            for prod_dict in products_list:
                item_name = prod_dict["item"]
                cat_name = prod_dict["category"]
                
                # Check if we have specific featured override
                is_featured = False
                desc = prod_dict.get("description", "Premium organic sweet crafted with utmost purity and premium quality.")
                image_url = image_map.get(cat_name, "https://images.unsplash.com/photo-1772986236859-b16543cea543?q=80&w=600&auto=format&fit=crop")
                
                if item_name in featured_items:
                    is_featured = True
                    image_url, desc = featured_items[item_name]
                
                # Double check specific values to keep simple
                prod_doc = ProductDoc(
                    category=cat_name,
                    item=item_name,
                    is_sweet=prod_dict["is_sweet"],
                    price_250g=prod_dict.get("price_250g"),
                    price_500g=prod_dict.get("price_500g"),
                    price_1kg=prod_dict.get("price_1kg"),
                    description=desc,
                    price=prod_dict["price"],
                    unit=prod_dict.get("unit", "Kg"),
                    image_url=image_url,
                    is_featured=is_featured,
                    in_stock=True
                )
                await db.products.insert_one(prod_doc.to_mongo())
                inserted_count += 1
            logger.info(f"Seeded {inserted_count} products from parsed_products.json successfully.")
            
    # 4. Seed some initial reviews if empty
    review_count = await db.reviews.count_documents({})
    if review_count == 0:
        reviews = [
            ReviewDoc(name="Rohit Verma", rating=5, comment="Best sweets in Dwarka! Quality, taste and packaging is always top notch.", approved=True),
            ReviewDoc(name="Priya Malhotra", rating=5, comment="Navnidhi is our go-to place for every festival. Always fresh & perfect!", approved=True),
            ReviewDoc(name="Amit Sethi", rating=5, comment="Snacks and bhaji are amazing. Hygiene and taste both are top notch!", approved=True),
            ReviewDoc(name="Neha Arora", rating=5, comment="The gifting boxes are so elegant. Perfect for weddings and corporate gifts.", approved=True)
        ]
        for r in reviews:
            await db.reviews.insert_one(r.to_mongo())
        logger.info("Seeded initial testimonials/reviews.")

# Include the router in the main app
app.include_router(api_router)

# CORS Middleware - origins configurable via CORS_ORIGINS env var
cors_origins_env = os.environ.get("CORS_ORIGINS", "*")
cors_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
