import base64
import json
import os

import httpx

OPENROUTER_API_KEY = os.environ["OPENROUTER_API_KEY"]
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"

SYSTEM_PROMPT = """You are grading a photo of a handwritten or printed question and its answer.
Read the image, identify the question and the answer given.
Judge whether the answer is correct.
Respond with ONLY a JSON object, no markdown fences, with this exact shape:
{"question": "...", "answer": "...", "is_correct": true/false, "feedback": "..."}
If you cannot find both a question and an answer in the image, set "question" and/or "answer" to null,
set "is_correct" to false, and explain what is missing in "feedback"."""


async def grade_image(image_bytes: bytes, content_type: str) -> dict:
    b64 = base64.b64encode(image_bytes).decode()
    data_url = f"data:{content_type};base64,{b64}"

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
    }

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            OPENROUTER_URL,
            headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    choices = data.get("choices")
    if not choices or not isinstance(choices[0], dict):
        error = data.get("error", {})
        if isinstance(error, dict):
            detail = error.get("message", "The grading service returned no choices.")
        else:
            detail = "The grading service returned no choices."
        return {
            "question": None,
            "answer": None,
            "is_correct": False,
            "feedback": f"Grading service error: {detail}",
        }

    content = choices[0].get("message", {}).get("content")
    if not isinstance(content, str):
        return {
            "question": None,
            "answer": None,
            "is_correct": False,
            "feedback": "The grading service returned no readable answer.",
        }

    raw = content.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "question": None,
            "answer": None,
            "is_correct": False,
            "feedback": f"Could not parse model response: {raw}",
        }
