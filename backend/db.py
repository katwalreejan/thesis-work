import os

from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URI = os.environ["MONGODB_URI"]

client = AsyncIOMotorClient(MONGODB_URI)
db = client.get_default_database()
ocr_results = db["ocr_results"]
