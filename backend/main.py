import tempfile
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR

from db import ocr_results
from feedback import grade_image

app = FastAPI(title="OCR Backend")

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


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/upload")
async def upload(file: UploadFile):
    contents = await file.read()
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
