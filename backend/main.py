import tempfile
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path

import jwt
from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from paddleocr import PaddleOCR
from bson import ObjectId

from db import ocr_results, users
from feedback import grade_image

app = FastAPI(title="Student Feedback System")
JWT_SECRET = os.getenv("JWT_SECRET", "local-development-secret-change-me")
JWT_ALGORITHM = "HS256"
TOKEN_TTL_SECONDS = 60 * 60 * 24
bearer = HTTPBearer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ocr_engine = PaddleOCR(
    lang="en",
    enable_mkldnn=False,
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
)


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=160)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str


class TeacherUploadRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    text: str = Field(default="", max_length=20_000)
    feedback: str = Field(default="", max_length=5_000)
    is_correct: bool | None = None


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 210_000)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt_hex, digest_hex = stored.split("$", 1)
    expected = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 210_000)
    return hmac.compare_digest(expected.hex(), digest_hex)


def create_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user["_id"]), "role": user["role"], "name": user["name"], "iat": now, "exp": now.timestamp() + TOKEN_TTL_SECONDS}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await users.find_one({"_id": ObjectId(payload["sub"])})
    except (jwt.PyJWTError, KeyError, ValueError):
        user = None
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


async def signup(data: SignupRequest, role: str):
    email = data.email.strip().lower()
    if await users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = {"name": data.name.strip(), "email": email, "password_hash": hash_password(data.password), "role": role, "created_at": datetime.now(timezone.utc)}
    result = await users.insert_one(user)
    user["_id"] = result.inserted_id
    return {"token": create_token(user), "user": {"name": user["name"], "email": email, "role": role}}


async def login(data: LoginRequest, role: str):
    user = await users.find_one({"email": data.email.strip().lower(), "role": role})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email, password, or account type")
    return {"token": create_token(user), "user": {"name": user["name"], "email": user["email"], "role": role}}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/signup/{role}")
async def auth_signup(role: str, data: SignupRequest):
    if role not in {"student", "teacher"}:
        raise HTTPException(status_code=404, detail="Unknown account type")
    return await signup(data, role)


@app.post("/api/auth/login/{role}")
async def auth_login(role: str, data: LoginRequest):
    if role not in {"student", "teacher"}:
        raise HTTPException(status_code=404, detail="Unknown account type")
    return await login(data, role)


@app.get("/api/me")
async def me(user: dict = Depends(current_user)):
    return {"name": user["name"], "email": user["email"], "role": user["role"]}


@app.get("/api/student/uploads")
async def student_uploads(user: dict = Depends(current_user)):
    if user["role"] != "student":
        raise HTTPException(status_code=403, detail="Student access required")
    uploads = []
    cursor = ocr_results.find({"user_id": user["_id"]}).sort("created_at", -1)
    async for item in cursor:
        grading = item.get("grading", {})
        uploads.append({
            "id": str(item["_id"]),
            "filename": item.get("filename", "Untitled upload"),
            "is_correct": grading.get("is_correct"),
            "question": grading.get("question", "Question unavailable"),
            "answer": grading.get("answer", "Answer unavailable"),
            "feedback": grading.get("feedback", "Feedback unavailable"),
            "created_at": item.get("created_at").isoformat() if item.get("created_at") else None,
        })
    return {"uploads": uploads}


@app.get("/api/teacher/dashboard")
async def teacher_dashboard(user: dict = Depends(current_user)):
    if user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    students = await users.count_documents({"role": "student"})
    uploads = await ocr_results.count_documents({})
    correct = await ocr_results.count_documents({"grading.is_correct": True})
    student_list = []
    student_cursor = users.find({"role": "student"}).sort("name", 1)
    async for student in student_cursor:
        student_uploads = await ocr_results.count_documents({"user_id": student["_id"]})
        student_list.append({"id": str(student["_id"]), "name": student["name"], "email": student["email"], "uploads": student_uploads})
    return {"stats": {"students": students, "uploads": uploads, "images": uploads, "feedback": uploads, "average_score": round((correct / uploads) * 100) if uploads else 0}, "students": student_list}


@app.get("/api/teacher/students/{student_id}")
async def teacher_student_detail(student_id: str, user: dict = Depends(current_user)):
    if user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    try:
        student_object_id = ObjectId(student_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid student id") from exc
    student = await users.find_one({"_id": student_object_id, "role": "student"})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    uploads = []
    cursor = ocr_results.find({"user_id": student_object_id}).sort("created_at", -1)
    async for item in cursor:
        grading = item.get("grading", {})
        uploads.append({
            "id": str(item["_id"]),
            "filename": item.get("filename", "Untitled upload"),
            "text": item.get("text", ""),
            "is_correct": grading.get("is_correct"),
            "score": 100 if grading.get("is_correct") else 0,
            "feedback": grading.get("feedback", "No feedback yet"),
            "created_at": item.get("created_at").isoformat() if item.get("created_at") else None,
        })
    return {"student": {"id": str(student["_id"]), "name": student["name"], "email": student["email"]}, "uploads": uploads}


async def teacher_student(student_id: str):
    try:
        student_object_id = ObjectId(student_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid student id") from exc
    student = await users.find_one({"_id": student_object_id, "role": "student"})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student_object_id


def upload_response(upload_id, item):
    grading = item.get("grading", {})
    return {
        "id": str(upload_id),
        "filename": item.get("filename", "Untitled upload"),
        "text": item.get("text", ""),
        "score": 100 if grading.get("is_correct") else 0,
        "feedback": grading.get("feedback", "No feedback yet"),
        "created_at": item.get("created_at").isoformat() if item.get("created_at") else None,
    }


@app.post("/api/teacher/students/{student_id}/uploads")
async def teacher_add_upload(student_id: str, data: TeacherUploadRequest, user: dict = Depends(current_user)):
    if user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    student_object_id = await teacher_student(student_id)
    item = {
        "user_id": student_object_id,
        "filename": data.filename.strip(),
        "text": data.text,
        "grading": {"is_correct": data.is_correct, "feedback": data.feedback},
        "created_at": datetime.now(timezone.utc),
    }
    result = await ocr_results.insert_one(item)
    return upload_response(result.inserted_id, item)


@app.patch("/api/teacher/uploads/{upload_id}")
async def teacher_edit_upload(upload_id: str, data: TeacherUploadRequest, user: dict = Depends(current_user)):
    if user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    try:
        upload_object_id = ObjectId(upload_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid upload id") from exc
    item = await ocr_results.find_one({"_id": upload_object_id})
    if not item:
        raise HTTPException(status_code=404, detail="Upload not found")
    await teacher_student(str(item["user_id"]))
    await ocr_results.update_one({"_id": upload_object_id}, {"$set": {
        "filename": data.filename.strip(),
        "text": data.text,
        "grading": {"is_correct": data.is_correct, "feedback": data.feedback},
    }})
    item.update({"filename": data.filename.strip(), "text": data.text, "grading": {"is_correct": data.is_correct, "feedback": data.feedback}})
    return upload_response(upload_object_id, item)


@app.delete("/api/teacher/uploads/{upload_id}")
async def teacher_delete_upload(upload_id: str, user: dict = Depends(current_user)):
    if user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    try:
        upload_object_id = ObjectId(upload_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid upload id") from exc
    item = await ocr_results.find_one({"_id": upload_object_id})
    if not item:
        raise HTTPException(status_code=404, detail="Upload not found")
    await teacher_student(str(item["user_id"]))
    await ocr_results.delete_one({"_id": upload_object_id})
    return {"id": upload_id}


@app.post("/api/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(current_user)):
    if user["role"] != "student":
        raise HTTPException(status_code=403, detail="Only student accounts can upload work")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Please upload an image file")
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Images must be 10MB or smaller")
    suffix = Path(file.filename).suffix

    with tempfile.TemporaryDirectory() as temp_dir:
        image_path = Path(temp_dir) / f"upload{suffix}"
        image_path.write_bytes(contents)
        results = ocr_engine.predict(str(image_path))
        rec_texts = []
        for res in results:
            rec_texts.extend(res.json.get("res", {}).get("rec_texts", []))

    text = "\n".join(rec_texts)
    grading = await grade_image(contents, file.content_type or "image/png")

    doc = {
        "user_id": user["_id"],
        "filename": file.filename,
        "text": text,
        "grading": grading,
        "created_at": datetime.now(timezone.utc),
    }
    result = await ocr_results.insert_one(doc)

    return {
        "id": str(result.inserted_id),
        "filename": file.filename,
        "text": text,
        "grading": grading,
    }
