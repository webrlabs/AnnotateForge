"""
Main FastAPI application
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging
import os

from app.core.config import settings
from app.core.database import Base, engine
from app.api.routes import auth, projects, images, annotations, inference, export, import_route, health, collaboration, locks, training

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="LabelFlow - Modern Image Annotation Platform",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/storage", StaticFiles(directory=settings.UPLOAD_DIR), name="storage")

# Include routers
app.include_router(health.router)  # Health checks (no prefix)
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(projects.router, prefix=settings.API_V1_PREFIX)
app.include_router(images.router, prefix=settings.API_V1_PREFIX)
app.include_router(annotations.router, prefix=settings.API_V1_PREFIX)
app.include_router(inference.router, prefix=settings.API_V1_PREFIX)
app.include_router(export.router, prefix=settings.API_V1_PREFIX)
app.include_router(import_route.router, prefix=settings.API_V1_PREFIX)
app.include_router(collaboration.router, prefix=settings.API_V1_PREFIX)
app.include_router(locks.router, prefix=settings.API_V1_PREFIX)
app.include_router(training.router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "Welcome to LabelFlow API",
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/health"
    }


@app.websocket("/ws/inference/{session_id}")
async def websocket_inference(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time inference

    Args:
        websocket: WebSocket connection
        session_id: Session ID for this connection
    """
    await websocket.accept()
    logger.info(f"WebSocket connected: {session_id}")

    try:
        from app.services.sam2_service import SAM2Service
        from app.services.image_processor import ImageProcessor
        from app.core.database import SessionLocal
        from app.models.image import Image
        import time

        sam2_service = SAM2Service(settings.SAM2_MODEL)
        image_processor = ImageProcessor()

        while True:
            # Receive data from client
            data = await websocket.receive_json()
            logger.info(f"Received WS data: {data.get('type')}")

            if data.get("type") == "sam2_predict":
                try:
                    # Get image from database
                    db = SessionLocal()
                    image = db.query(Image).filter(Image.id == data["image_id"]).first()

                    if not image:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Image not found"
                        })
                        continue

                    # Load image (convert web path to filesystem path)
                    original_filepath = image.original_path.replace("/storage/", settings.UPLOAD_DIR + "/")
                    cv_image = image_processor.load_image(original_filepath)

                    # Send progress
                    await websocket.send_json({
                        "type": "progress",
                        "value": 0.3
                    })

                    # Run SAM2 inference
                    start_time = time.time()
                    prompts = data["prompts"]

                    if "points" in prompts and "labels" in prompts:
                        annotations = sam2_service.predict_with_points(
                            cv_image,
                            prompts["points"],
                            prompts["labels"]
                        )
                    elif "boxes" in prompts:
                        bbox = prompts["boxes"][0]
                        annotations = sam2_service.predict_with_box(cv_image, bbox)
                    else:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Invalid prompts"
                        })
                        continue

                    inference_time = time.time() - start_time

                    # Send progress
                    await websocket.send_json({
                        "type": "progress",
                        "value": 0.9
                    })

                    # Send results
                    await websocket.send_json({
                        "type": "sam2_result",
                        "status": "complete",
                        "annotations": annotations,
                        "inference_time": inference_time
                    })

                    db.close()

                except Exception as e:
                    logger.error(f"SAM2 inference error: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "message": str(e)
                    })

            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown message type: {data.get('type')}"
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
