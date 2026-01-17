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
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

# Initialize Supabase client
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

app = FastAPI(title="Waaah-Comics Backend", version="0.1.0")

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


# Project models
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None


class ProjectPanelItem(BaseModel):
    id: str
    project_id: str
    image_url: str
    panel_order: int
    created_at: Optional[datetime] = None


class ProjectItem(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    panels: List[ProjectPanelItem] = []


class AddPanelRequest(BaseModel):
    image_url: str
    panel_order: Optional[int] = None


def _validate_image(file: UploadFile) -> None:
    allowed_types = {"image/png", "image/jpeg", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported content type: {file.content_type}")


def _validate_video(file: UploadFile) -> None:
    allowed_types = {"video/mp4", "video/webm", "video/quicktime"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported video type: {file.content_type}. Allowed: mp4, webm, mov")


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


@app.post("/comics/upload-video", response_model=UploadResponse)
async def upload_comic_video(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(default=None),
    comic_id: Optional[str] = Form(default=None),
    panel_id: Optional[str] = Form(default=None),
):
    """Upload an AI-generated video to Supabase Storage (comics_bucket).

    Accepts multipart/form-data with fields:
      - file: the video (mp4/webm/mov)
      - user_id (optional)
      - comic_id (optional)
      - panel_id (optional)
    """

    if not file:
        raise HTTPException(status_code=400, detail="Missing file upload")

    _validate_video(file)

    # Read video bytes
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file upload")

    # Build path
    path = _build_storage_path(
        user_id=user_id,
        filename=file.filename or "video.mp4",
    )

    bucket = "comics_bucket"

    # Upload to Supabase Storage
    try:
        supabase.storage.from_(bucket).upload(
            path=path,
            file=data,
            file_options={
                "contentType": (file.content_type or "video/mp4"),
                "upsert": "true",
                "cacheControl": "3600",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")

    # Get public URL
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


@app.get("/assets/user-videos", response_model=AssetListResponse)
def list_user_videos(
    user_id: Optional[str] = None,
    signed: bool = False,
    limit: int = 100,
    offset: int = 0,
):
    """List videos from Supabase Storage under users/{user_id}/.

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

    video_exts = (".mp4", ".webm", ".mov")

    for obj in raw_list:
        name = obj.get("name") if isinstance(obj, dict) else None
        if not name or not name.lower().endswith(video_exts):
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


# ==================== PROJECTS API ====================

def _get_or_create_user(user_id: str) -> str:
    """Get user's database UUID from clerk_id, creating user if needed."""
    # Try to find existing user
    result = supabase.table("users").select("id").eq("clerk_id", user_id).execute()
    if result.data and len(result.data) > 0:
        return result.data[0]["id"]

    # Create new user
    new_user = supabase.table("users").insert({"clerk_id": user_id}).execute()
    if new_user.data and len(new_user.data) > 0:
        return new_user.data[0]["id"]

    raise HTTPException(status_code=500, detail="Failed to create user")


@app.get("/projects", response_model=List[ProjectItem])
def list_projects(user_id: str):
    """List all projects for a user."""
    try:
        db_user_id = _get_or_create_user(user_id)

        result = supabase.table("projects").select("*").eq("user_id", db_user_id).order("created_at", desc=True).execute()

        projects = []
        for proj in result.data or []:
            # Get panels for each project
            panels_result = supabase.table("project_panels").select("*").eq("project_id", proj["id"]).order("panel_order").execute()

            panels = [
                ProjectPanelItem(
                    id=p["id"],
                    project_id=p["project_id"],
                    image_url=p["image_url"],
                    panel_order=p["panel_order"],
                    created_at=p.get("created_at"),
                )
                for p in (panels_result.data or [])
            ]

            projects.append(ProjectItem(
                id=proj["id"],
                user_id=proj["user_id"],
                name=proj["name"],
                description=proj.get("description"),
                cover_image_url=proj.get("cover_image_url"),
                created_at=proj.get("created_at"),
                updated_at=proj.get("updated_at"),
                panels=panels,
            ))

        return projects
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list projects: {e}")


@app.post("/projects", response_model=ProjectItem)
def create_project(data: ProjectCreate, user_id: str):
    """Create a new project."""
    try:
        db_user_id = _get_or_create_user(user_id)

        result = supabase.table("projects").insert({
            "user_id": db_user_id,
            "name": data.name,
            "description": data.description,
            "cover_image_url": data.cover_image_url,
        }).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=500, detail="Failed to create project")

        proj = result.data[0]
        return ProjectItem(
            id=proj["id"],
            user_id=proj["user_id"],
            name=proj["name"],
            description=proj.get("description"),
            cover_image_url=proj.get("cover_image_url"),
            created_at=proj.get("created_at"),
            updated_at=proj.get("updated_at"),
            panels=[],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create project: {e}")


@app.get("/projects/{project_id}", response_model=ProjectItem)
def get_project(project_id: str, user_id: str):
    """Get a specific project with its panels."""
    try:
        db_user_id = _get_or_create_user(user_id)

        result = supabase.table("projects").select("*").eq("id", project_id).eq("user_id", db_user_id).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Project not found")

        proj = result.data[0]

        # Get panels
        panels_result = supabase.table("project_panels").select("*").eq("project_id", project_id).order("panel_order").execute()

        panels = [
            ProjectPanelItem(
                id=p["id"],
                project_id=p["project_id"],
                image_url=p["image_url"],
                panel_order=p["panel_order"],
                created_at=p.get("created_at"),
            )
            for p in (panels_result.data or [])
        ]

        return ProjectItem(
            id=proj["id"],
            user_id=proj["user_id"],
            name=proj["name"],
            description=proj.get("description"),
            cover_image_url=proj.get("cover_image_url"),
            created_at=proj.get("created_at"),
            updated_at=proj.get("updated_at"),
            panels=panels,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get project: {e}")


@app.put("/projects/{project_id}", response_model=ProjectItem)
def update_project(project_id: str, data: ProjectUpdate, user_id: str):
    """Update a project."""
    try:
        db_user_id = _get_or_create_user(user_id)

        # Verify ownership
        existing = supabase.table("projects").select("id").eq("id", project_id).eq("user_id", db_user_id).execute()
        if not existing.data or len(existing.data) == 0:
            raise HTTPException(status_code=404, detail="Project not found")

        update_data = {}
        if data.name is not None:
            update_data["name"] = data.name
        if data.description is not None:
            update_data["description"] = data.description
        if data.cover_image_url is not None:
            update_data["cover_image_url"] = data.cover_image_url
        update_data["updated_at"] = datetime.utcnow().isoformat()

        result = supabase.table("projects").update(update_data).eq("id", project_id).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=500, detail="Failed to update project")

        proj = result.data[0]

        # Get panels
        panels_result = supabase.table("project_panels").select("*").eq("project_id", project_id).order("panel_order").execute()

        panels = [
            ProjectPanelItem(
                id=p["id"],
                project_id=p["project_id"],
                image_url=p["image_url"],
                panel_order=p["panel_order"],
                created_at=p.get("created_at"),
            )
            for p in (panels_result.data or [])
        ]

        return ProjectItem(
            id=proj["id"],
            user_id=proj["user_id"],
            name=proj["name"],
            description=proj.get("description"),
            cover_image_url=proj.get("cover_image_url"),
            created_at=proj.get("created_at"),
            updated_at=proj.get("updated_at"),
            panels=panels,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update project: {e}")


@app.delete("/projects/{project_id}")
def delete_project(project_id: str, user_id: str):
    """Delete a project and all its panels."""
    try:
        db_user_id = _get_or_create_user(user_id)

        # Verify ownership
        existing = supabase.table("projects").select("id").eq("id", project_id).eq("user_id", db_user_id).execute()
        if not existing.data or len(existing.data) == 0:
            raise HTTPException(status_code=404, detail="Project not found")

        # Delete project (cascades to panels)
        supabase.table("projects").delete().eq("id", project_id).execute()

        return {"status": "deleted", "project_id": project_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {e}")


@app.post("/projects/{project_id}/panels", response_model=ProjectPanelItem)
def add_panel_to_project(project_id: str, data: AddPanelRequest, user_id: str):
    """Add a panel to a project."""
    try:
        db_user_id = _get_or_create_user(user_id)

        # Verify project ownership
        existing = supabase.table("projects").select("id").eq("id", project_id).eq("user_id", db_user_id).execute()
        if not existing.data or len(existing.data) == 0:
            raise HTTPException(status_code=404, detail="Project not found")

        # Get max order if not specified
        panel_order = data.panel_order
        if panel_order is None:
            max_order_result = supabase.table("project_panels").select("panel_order").eq("project_id", project_id).order("panel_order", desc=True).limit(1).execute()
            if max_order_result.data and len(max_order_result.data) > 0:
                panel_order = max_order_result.data[0]["panel_order"] + 1
            else:
                panel_order = 0

        result = supabase.table("project_panels").insert({
            "project_id": project_id,
            "image_url": data.image_url,
            "panel_order": panel_order,
        }).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=500, detail="Failed to add panel")

        p = result.data[0]

        # Update project cover image if it's the first panel
        panels_count = supabase.table("project_panels").select("id", count="exact").eq("project_id", project_id).execute()
        if panels_count.count == 1:
            supabase.table("projects").update({"cover_image_url": data.image_url}).eq("id", project_id).execute()

        return ProjectPanelItem(
            id=p["id"],
            project_id=p["project_id"],
            image_url=p["image_url"],
            panel_order=p["panel_order"],
            created_at=p.get("created_at"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add panel: {e}")


@app.delete("/projects/{project_id}/panels/{panel_id}")
def delete_panel_from_project(project_id: str, panel_id: str, user_id: str):
    """Delete a panel from a project."""
    try:
        db_user_id = _get_or_create_user(user_id)

        # Verify project ownership
        existing = supabase.table("projects").select("id").eq("id", project_id).eq("user_id", db_user_id).execute()
        if not existing.data or len(existing.data) == 0:
            raise HTTPException(status_code=404, detail="Project not found")

        # Delete panel
        supabase.table("project_panels").delete().eq("id", panel_id).eq("project_id", project_id).execute()

        return {"status": "deleted", "panel_id": panel_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete panel: {e}")


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
