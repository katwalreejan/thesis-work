# Student Feedback System — Implementation Documentation

## Overview

The React application provides teacher and student dashboards for class
assignments, typed or uploaded submissions, AI feedback, and teacher review.
FastAPI authenticates users with JWTs, stores application records in MongoDB,
keeps uploaded work in `backend/uploads`, and grades text or OCR/image input
through OpenRouter.

Student signup creates an account but does not issue a token; a separate
login is required before a protected dashboard is shown. Students select a
teacher-owned class during signup. Teacher API queries and file retrievals
are scoped to the authenticated teacher and the students assigned to that
teacher's class/assignment.

## Repository layout

```
ocr/
├── backend/
│   ├── main.py           FastAPI app, routes, orchestration
│   ├── db.py              MongoDB (Motor) connection
│   ├── feedback.py        OpenRouter vision-LLM grading
│   ├── requirements.txt
│   ├── .env               MONGODB_URI, OPENROUTER_API_KEY (gitignored)
│   └── venv/               Python virtualenv (gitignored)
├── frontend/
│   ├── src/
│   │   ├── App.jsx        Upload UI + result display
│   │   └── main.jsx        React entrypoint
│   └── vite.config.js      Dev server, proxies /api → :8000
├── .gitignore
└── README.md               Quick-start run commands
```

## Backend

### Stack

- **FastAPI** — HTTP API, CORS origins configured by `CORS_ORIGINS` (defaults
  to `http://localhost:5173`).
- **PaddleOCR** (`paddleocr`, `paddlepaddle`) — local, offline text extraction.
- **Motor** — async MongoDB driver.
- **httpx** — async HTTP client used to call OpenRouter.
- **python-dotenv** — loads `backend/.env` into the process environment.

### Environment variables (`backend/.env`)

| Variable             | Purpose                                                        |
|-----------------------|------------------------------------------------------------------|
| `MONGODB_URI`         | `mongodb://localhost:27017/new` — the database name is `new`.  |
| `OPENROUTER_API_KEY`  | Auth for the OpenRouter chat completions API.                  |
| `CORS_ORIGINS`        | Comma-separated frontend origins allowed by CORS. Defaults to `http://localhost:5173`; set this to your deployed frontend URL on Render. |

### `db.py` — MongoDB connection

```python
client = AsyncIOMotorClient(MONGODB_URI)
db = client.get_default_database()
users = db["users"]
classes = db["classes"]
subjects = db["subjects"]
assignments = db["assignments"]
submissions = db["submissions"]
ocr_results = db["ocr_results"]         # legacy standalone uploads
```

The main collections are `users`, `classes`, `subjects`, `assignments`,
`submissions`, and the legacy `ocr_results` collection. Assignment
submissions store typed text, OCR text, scores, AI/teacher feedback, and
references to original files. Assignment files continue to be stored as
MongoDB binary fields; student work is stored in `backend/uploads`.

### `feedback.py` — vision LLM grading

Calls OpenRouter's chat completions endpoint with the uploaded image
(base64 data URL) and a system prompt instructing the model to:

1. Read the image and identify the question and the answer written.
2. Judge whether the answer is correct.
3. Respond with **only** a JSON object: `{question, answer, is_correct, feedback}`.
4. If it can't find a question/answer, return `null`s, `is_correct: false`,
   and explain what's missing in `feedback`.

Model used: `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`.

> **Why this model:** the original ask was Qwen2.5-VL, but OpenRouter has no
> free tier for it (paid, ~$0.25/M input tokens — trivial cost, but requires
> credits). Free vision-capable alternatives were tried; Google's Gemma
> free-tier models were intermittently rate-limited upstream during testing.
> This Nvidia Nemotron free model handled image input reliably and returns
> `content` (the answer) separately from `reasoning` (its chain-of-thought),
> which parses cleanly. Swap `MODEL` in `feedback.py` if you want to switch
> providers later (e.g. once you add OpenRouter credits for Qwen2.5-VL).

The model's raw response is stripped of any ```` ```json ```` fences and
`json.loads`'d. If parsing fails, a fallback dict is returned with
`is_correct: false` and the raw text in `feedback` so the request doesn't
hard-fail.

### `main.py` — API routes and workflow

#### Authentication and class ownership

- `POST /api/auth/signup/{student|teacher}` creates the account and returns a
  success message without a JWT.
- `POST /api/auth/login/{student|teacher}` issues the JWT after credentials
  and role are verified. `/api/me` is used to restore an existing session.
- Teacher classes carry a `teacher_id`; student signup records the selected
  class ID and its teacher. Teachers can create Grade 1–10 classes with
  sections A, B, or C; a unique random enrollment key is generated for each
  class. Keys are encrypted for teacher-only display and stored with a
  separate keyed hash for signup verification. Student signup requires the
  key to match the selected class. Existing unambiguous student/assignment records
  are linked to their class on startup without deleting or replacing data.
- Teacher assignment, student, submission, feedback, and file endpoints
  verify ownership server-side. `/api/files/{filename}` requires a valid
  JWT and checks that the referenced submission belongs to the requesting
  student or teacher.

#### Assignment submissions

`POST /api/student/assignments/{assignment_id}/submit` accepts multipart
`answer_text`, an optional legacy `file`, and repeated `files` fields. A
student may type, upload up to ten images/PDFs, or do both. Images are run
through PaddleOCR; scanned PDF pages are rendered for OCR when no embedded
text is present. A single image-only submission uses the vision grading
flow; typed, PDF, and combined/multiple-file answers use text grading.
Uploaded originals remain available to the student and the owning teacher.

`POST` and `PATCH /api/teacher/assignments` accept multipart form data,
including `assignment_file`. Assignment files are validated and stored in
the existing MongoDB binary field, then served to the assignment's teacher
or eligible students through `/api/assignments/{assignment_id}/file`.

#### Legacy `POST /api/upload`

The original standalone image-grading endpoint remains available for
compatibility. It saves the uploaded image in the existing upload directory
and returns a protected `/api/files/{filename}` link.

#### `GET /api/health`

Returns `{"status": "ok"}`. Used by the frontend on load to show backend
connectivity.

#### `POST /api/upload`

Accepts a `multipart/form-data` file upload (field name `file`).

Flow:
1. Read the uploaded bytes.
2. Write them to a temp file (suffix matched to the original filename) so
   PaddleOCR can read from a path.
3. Run `ocr_engine.predict(tmp.name)` → collect `rec_texts` from each
   result's `res.json["res"]["rec_texts"]`, join with newlines.
4. Call `grade_image(contents, content_type)` — sends the *original* image
   bytes (not OCR text) to the vision LLM, so grading isn't limited by OCR
   accuracy.
5. Insert `{filename, text, grading, created_at}` into `ocr_results`.
6. Return `{id, filename, text, grading}`.

The PaddleOCR engine (`ocr_engine`) is instantiated once at module import
time — model weights are cached locally under `~/.paddlex/official_models/`
after the first run, but that first run downloads them, so the very first
request after a fresh clone will be slow.

## Frontend

### Stack

- **React + Vite**, minimal template (logos/boilerplate content stripped).
- No routing, no state management library — a single `App.jsx` component.

### Frontend API URL configuration

The frontend reads `VITE_API_URL` from `frontend/.env` or the frontend
hosting environment. Leave it empty for local development; Vite's dev-server
proxy forwards `/api` requests to `http://localhost:8000`. For deployment,
set `VITE_API_URL` to the backend origin (for example,
`https://feedbackapp-jf5d.onrender.com`) in the frontend service's build
environment. The value is used when Vite builds the frontend.

`frontend/.env` is ignored by Git. Use `frontend/.env.example` as the template.

### `vite.config.js`

Proxies any `/api/*` request from the dev server (`:5173`) to
`http://localhost:8000` for local development when `VITE_API_URL` is empty.

### `App.jsx` behavior

- On mount, an existing JWT is validated through `GET /api/me`.
- Without a valid JWT, only the login/signup view is rendered.
- Successful signup returns the user to login with a success message.
- Successful login stores the JWT and renders the role-appropriate dashboard.

## Running locally

**Backend** (from `backend/`):
```bash
source venv/bin/activate
uvicorn main:app --reload
```
Runs on `http://localhost:8000`. Requires MongoDB reachable at the URI in
`.env` (verified locally at `localhost:27017`).

**Frontend** (from `frontend/`):
```bash
npm run dev
```
Runs on `http://localhost:5173` (or next free port if occupied).

## Operational notes

- **OpenRouter availability** — upstream failures are surfaced as request
  errors; there is no retry queue.
- **OCR initialization** — PaddleOCR is loaded lazily on the first image or
  scanned-PDF request. Its first model download can take time.
- **Upload limits** — assignment submissions accept up to ten image/PDF
  files, each no larger than 10 MB; PDFs are limited to 30 pages.
- **Class ownership migration** — pre-existing records are linked only when
  a student has exactly one matching class; ambiguous records are left
  unlinked rather than exposed across teachers.
