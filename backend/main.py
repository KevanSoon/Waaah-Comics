import os
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from supabase import create_client, Client


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str

    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:3000"

    # Ignore extra env vars (e.g., Clerk/Google) to avoid validation errors
    model_config = SettingsConfigDict(
        env_file=".env.local",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

# Initialize Supabase client
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

app = FastAPI(title="PanelPop Backend", version="0.1.0")

# CORS
allowed_origins: List[str] = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class UploadResponse(BaseModel):
    bucket: str
    path: str
    public_url: Optional[str]


def _validate_image(file: UploadFile) -> None:
    allowed_types = {"image/png", "image/jpeg", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported content type: {file.content_type}")


def _build_storage_path(
    *,
    user_id: Optional[str],
    filename: str,
) -> str:
    # Ensure safe extension
    _, ext = os.path.splitext(filename)
    ext = (ext or ".png").lower()

    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    unique = uuid.uuid4().hex

    # Two-level hierarchy: users/{user_folder}/<timestamp>_<uuid>.<ext>
    # If the provided user_id doesn't start with 'user_', prefix it for consistency
    user_folder = (user_id or "anonymous")
    if not user_folder.startswith("user_"):
        user_folder = f"user_{user_folder}"

    return f"users/{user_folder}/{ts}_{unique}{ext}"


@app.post("/comics/upload-panel", response_model=UploadResponse)
async def upload_comic_panel(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(default=None),
    comic_id: Optional[str] = Form(default=None),
    panel_id: Optional[str] = Form(default=None),
):
    """Upload a comic panel image to Supabase Storage (comics_bucket).

    Accepts multipart/form-data with fields:
      - file: the image (png/jpeg/webp)
      - user_id (optional)
      - comic_id (optional)
      - panel_id (optional)
    """

    if not file:
        raise HTTPException(status_code=400, detail="Missing file upload")

    _validate_image(file)

    # Read image bytes
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file upload")

    # Build path
    path = _build_storage_path(
        user_id=user_id,
        filename=file.filename or "panel.png",
    )

    bucket = "comics_bucket"

    # Upload to Supabase Storage
    try:
        supabase.storage.from_(bucket).upload(
            path=path,
            file=data,
            file_options={
                # Ensure all header-like values are strings
                "contentType": (file.content_type or "image/png"),
                "upsert": "true",  # avoid bool to satisfy header requirements
                "cacheControl": "3600",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")

    # Get public URL (works if bucket/object policy allows public read)
    public_url = None
    try:
        public_url = supabase.storage.from_(bucket).get_public_url(path)
    except Exception:
        public_url = None

    return UploadResponse(bucket=bucket, path=path, public_url=public_url)


class AssetItem(BaseModel):
    path: str
    name: str
    url: str
    size: Optional[int] = None
    last_modified: Optional[datetime] = None


class AssetListResponse(BaseModel):
    user_id: str
    bucket: str
    items: List[AssetItem]


def _user_folder(user_id: Optional[str]) -> str:
    uid = user_id or "anonymous"
    return uid if uid.startswith("user_") else f"user_{uid}"


@app.get("/assets/user-images", response_model=AssetListResponse)
def list_user_images(
    user_id: Optional[str] = None,
    signed: bool = False,
    limit: int = 100,
    offset: int = 0,
):
    """List images from Supabase Storage under users/{user_id}/.

    Query params:
      - user_id: If not provided, defaults to 'anonymous'.
      - signed: If true, returns signed URLs (useful for private buckets).
      - limit, offset: Pagination controls for listing.
    """

    bucket = "comics_bucket"
    folder = _user_folder(user_id)
    prefix = f"users/{folder}"

    # Try using options for newer SDKs; fall back to basic list if unsupported
    try:
        entries = supabase.storage.from_(bucket).list(
            path=prefix,
            options={
                "limit": limit,
                "offset": offset,
                # "sortBy": {"column": "name", "order": "desc"},
            },
        )
    except TypeError:
        # Older client versions don't accept options; list everything and slice
        try:
            all_entries = supabase.storage.from_(bucket).list(path=prefix)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to list assets: {e}")
        else:
            if isinstance(all_entries, dict) and all_entries.get("data") is not None:
                data = all_entries.get("data") or []
            else:
                data = all_entries or []
            entries = data[offset: offset + limit]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list assets: {e}")

    items: List[AssetItem] = []
    if isinstance(entries, dict) and entries.get("data") is not None:
        raw_list = entries.get("data") or []
    else:
        raw_list = entries or []

    image_exts = (".png", ".jpg", ".jpeg", ".webp")

    for obj in raw_list:
        name = obj.get("name") if isinstance(obj, dict) else None
        if not name or not name.lower().endswith(image_exts):
            continue

        path = f"{prefix}/{name}"

        url: Optional[str] = None
        try:
            if signed:
                signed_res = supabase.storage.from_(bucket).create_signed_url(path, 3600)
                if isinstance(signed_res, dict):
                    url = signed_res.get("signedURL") or signed_res.get("signed_url") or signed_res.get("data")
            else:
                url = supabase.storage.from_(bucket).get_public_url(path)
        except Exception:
            url = None

        meta = obj.get("metadata") if isinstance(obj, dict) else None
        size = None
        if isinstance(meta, dict):
            size = meta.get("size") or meta.get("contentLength")
        lm = obj.get("last_modified") or obj.get("updated_at") or obj.get("created_at") if isinstance(obj, dict) else None
        lm_dt = None
        if isinstance(lm, str):
            try:
                lm_dt = datetime.fromisoformat(lm.replace("Z", "+00:00"))
            except Exception:
                lm_dt = None

        if url:
            items.append(AssetItem(path=path, name=name, url=url, size=size, last_modified=lm_dt))

    return AssetListResponse(user_id=folder, bucket=bucket, items=items)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    from pathlib import Path

    cwd = Path().resolve()
    # If running from the backend folder, use "main:app"; otherwise use package path
    if cwd.name == "backend":
        app_module = "main:app"
        reload_dirs = [str(cwd)]
    else:
        app_module = "backend.main:app"
        reload_dirs = [str(cwd / "backend")]

    uvicorn.run(
        app_module,
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True,
        reload_dirs=reload_dirs,
    )
