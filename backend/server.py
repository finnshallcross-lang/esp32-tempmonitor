from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
from pathlib import Path
from pydantic import BaseModel


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection (kept for platform compatibility; unused in this app).
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


class SensorReading(BaseModel):
    temperature: float
    humidity: float
    brightness: float


@api_router.get("/")
async def root():
    return {"message": "ESP32 Sensor Dash backend up"}


@api_router.get("/mock-sensor", response_model=SensorReading)
async def mock_sensor():
    """Demo endpoint that mimics an ESP32 sensor payload.

    Useful for testing the UI when the phone is not on the same LAN as the
    ESP32. Values fluctuate a bit each call so the dashboard looks alive.
    NOTE: no timestamp field – the app derives 'Last updated' locally.
    """
    return SensorReading(
        temperature=round(random.uniform(20.0, 28.0), 1),
        humidity=round(random.uniform(35.0, 65.0), 1),
        brightness=round(random.uniform(20.0, 90.0), 0),
    )


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
