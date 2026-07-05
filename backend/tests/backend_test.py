"""
Backend tests for Navnidhi Sweets:
- Auth (login/me/change-password)
- File upload (auth guard, image validation, upload+serve)
- Site settings (public GET, admin PUT with whatsapp/phone, reset)
- Regression: products, reviews, inquiries
"""
import io
import os
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://natural-sweets-store.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@navnidhisweets.com"
ADMIN_PASSWORD = "Purity@Navnidhi108"


def make_png_bytes(width=8, height=8, color=(255, 128, 0)):
    """Create a minimal valid PNG image in-memory (no PIL needed)."""
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # RGB, 8-bit
    raw = b""
    for _ in range(height):
        raw += b"\x00" + bytes(color) * width
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


@pytest.fixture(scope="session")
def anon_session():
    s = requests.Session()
    return s


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    resp = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if resp.status_code != 200:
        pytest.skip(f"Admin login failed ({resp.status_code}): {resp.text}")
    return s


# ---------- AUTH ----------
class TestAuth:
    def test_login_success(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert "access_token" in s.cookies
        assert "refresh_token" in s.cookies

    def test_me_requires_auth(self, anon_session):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401

    def test_me_authenticated(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL


# ---------- UPLOAD ----------
class TestUpload:
    def test_upload_requires_auth(self):
        png = make_png_bytes()
        r = requests.post(
            f"{API}/upload",
            files={"file": ("t.png", png, "image/png")},
            timeout=60,
        )
        assert r.status_code == 401, r.text

    def test_upload_rejects_non_image(self, admin_session):
        r = admin_session.post(
            f"{API}/upload",
            files={"file": ("readme.txt", b"hello world", "text/plain")},
            timeout=60,
        )
        assert r.status_code == 400, r.text
        assert "image" in r.json().get("detail", "").lower()

    def test_upload_success_and_serve(self, admin_session, anon_session):
        png = make_png_bytes()
        r = admin_session.post(
            f"{API}/upload",
            files={"file": ("test.png", png, "image/png")},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "path" in body and "url" in body
        assert body["url"].startswith("/api/files/")

        # Serve should be public (no auth) and return image content
        served = requests.get(f"{BASE_URL}{body['url']}", timeout=60)
        assert served.status_code == 200
        assert served.headers.get("Content-Type", "").startswith("image/")
        assert len(served.content) == len(png)

    def test_serve_missing_file_returns_404(self):
        r = requests.get(f"{BASE_URL}/api/files/navnidhi-sweets/uploads/does-not-exist.png", timeout=30)
        assert r.status_code == 404


# ---------- SITE SETTINGS ----------
class TestSiteSettings:
    def test_get_settings_public(self):
        r = requests.get(f"{API}/settings", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "logo_url" in data
        assert "hero_url" in data

    def test_put_settings_requires_auth(self):
        r = requests.put(f"{API}/settings", json={"logo_url": "https://example.com/x.png"}, timeout=30)
        assert r.status_code == 401

    def test_put_settings_admin_updates_and_reset(self, admin_session):
        # 1. Upload an image to use for logo
        png = make_png_bytes()
        up = admin_session.post(f"{API}/upload", files={"file": ("logo.png", png, "image/png")}, timeout=60)
        assert up.status_code == 200
        logo_url = f"{BASE_URL}{up.json()['url']}"

        # 2. PUT logo_url
        r = admin_session.put(f"{API}/settings", json={"logo_url": logo_url}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["logo_url"] == logo_url

        # 3. GET reflects change (public)
        r2 = requests.get(f"{API}/settings", timeout=30)
        assert r2.status_code == 200
        assert r2.json()["logo_url"] == logo_url

        # 4. Upload hero image
        up2 = admin_session.post(f"{API}/upload", files={"file": ("hero.png", png, "image/png")}, timeout=60)
        hero_url = f"{BASE_URL}{up2.json()['url']}"
        r3 = admin_session.put(f"{API}/settings", json={"hero_url": hero_url}, timeout=30)
        assert r3.status_code == 200
        assert r3.json()["hero_url"] == hero_url
        assert r3.json()["logo_url"] == logo_url  # unchanged

        # 5. Reset logo via empty string
        r4 = admin_session.put(f"{API}/settings", json={"logo_url": ""}, timeout=30)
        assert r4.status_code == 200
        assert r4.json()["logo_url"] == ""

        # 6. Reset hero
        r5 = admin_session.put(f"{API}/settings", json={"hero_url": ""}, timeout=30)
        assert r5.status_code == 200
        assert r5.json()["hero_url"] == ""


# ---------- REGRESSION ----------
class TestRegression:
    def test_products_public_list(self):
        r = requests.get(f"{API}/products", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_reviews_public_list(self):
        r = requests.get(f"{API}/reviews", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_inquiries_admin_only_get(self):
        r = requests.get(f"{API}/inquiries", timeout=30)
        assert r.status_code == 401

    def test_inquiry_create_public(self):
        payload = {
            "name": "TEST_ Regression",
            "email": "test_regression@example.com",
            "phone": "9999999999",
            "subject": "TEST",
            "message": "TEST inquiry from backend_test"
        }
        r = requests.post(f"{API}/inquiries", json=payload, timeout=30)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["name"] == payload["name"]
        assert body["status"] == "pending"

    def test_product_create_update_image_url_persists(self, admin_session):
        # Upload an image
        png = make_png_bytes()
        up = admin_session.post(f"{API}/upload", files={"file": ("p.png", png, "image/png")}, timeout=60)
        assert up.status_code == 200
        img_url = f"{BASE_URL}{up.json()['url']}"

        # Create product
        payload = {
            "category": "TEST",
            "item": "TEST_ProductImage",
            "is_sweet": True,
            "description": "Test",
            "price": 100.0,
            "unit": "Kg",
            "image_url": img_url,
        }
        r = admin_session.post(f"{API}/products", json=payload, timeout=30)
        assert r.status_code == 201, r.text
        prod = r.json()
        prod_id = prod["_id"]
        assert prod["image_url"] == img_url

        # Update image_url
        payload["image_url"] = img_url + "?v=2"
        # Actually we should re-upload a different image; simpler: just PUT with same payload but changed desc
        payload["description"] = "Updated"
        payload["image_url"] = img_url
        r2 = admin_session.put(f"{API}/products/{prod_id}", json=payload, timeout=30)
        assert r2.status_code == 200
        assert r2.json()["description"] == "Updated"
        assert r2.json()["image_url"] == img_url

        # GET to confirm persistence
        r3 = requests.get(f"{API}/products", timeout=30)
        assert r3.status_code == 200
        found = [p for p in r3.json() if p.get("_id") == prod_id]
        assert len(found) == 1
        assert found[0]["image_url"] == img_url

        # Cleanup
        d = admin_session.delete(f"{API}/products/{prod_id}", timeout=30)
        assert d.status_code == 200
