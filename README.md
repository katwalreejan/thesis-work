# ocr

React + FastAPI app that OCRs an uploaded question/answer image and grades
it with a vision LLM. See [DOCUMENTATION.md](DOCUMENTATION.md) for full
architecture, data flow, and API details.

## Backend

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

Runs on http://localhost:8000

## Frontend

```bash
cd frontend
npm run dev
```

Runs on http://localhost:5173, proxies `/api` to the backend.
