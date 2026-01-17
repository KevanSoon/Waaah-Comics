# Waaah-Comics Backend

This FastAPI backend provides a single endpoint to upload comic panel images to Supabase Storage (`comics_bucket`).

## Setup

1. Create a `.env` in `backend/` based on `.env.example`:

```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=http://localhost:3000
```

2. Install dependencies (preferably inside a virtual environment):

```bash
pip install -r backend/requirements.txt
```

## Run

Choose one of the following options:

1) From the `backend/` folder

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

2) From the repo root (now that `backend` is a package)

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

3) From the repo root using `--app-dir`

```bash
uvicorn --app-dir backend main:app --host 0.0.0.0 --port 8000 --reload
```

## Endpoint

- `POST /comics/upload-panel`
  - Form-data fields:
    - `file` (required): image file (png/jpeg/webp)
    - `user_id` (optional)
    - `comic_id` (optional)
    - `panel_id` (optional)
  - Response:
    ```json
    {
      "bucket": "comics_bucket",
      "path": "users/{user}/comics/{comic}/panels/{panel}_{timestamp}_{uuid}.png",
      "public_url": "https://..." // if bucket/object policy allows public read
    }
    ```

## Notes

- Ensure a Supabase Storage bucket named `comics_bucket` exists.
- Set appropriate bucket policies to allow reading public URLs or use signed URLs if needed.
 - If you see `ModuleNotFoundError: No module named 'backend'`, run from the repo root with option (2) above or use option (1) inside `backend/`.
