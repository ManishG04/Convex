from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio

from .config import settings
from .socket_handlers import sio

# Create FastAPI app
app = FastAPI(
    title="Convex API",
    description="Real-time collaborative focus platform backend",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "convex-backend"}


@app.get("/")
async def root():
    return {
        "name": "Convex Backend",
        "version": "1.0.0",
        "docs": "/docs",
    }


# Mount Socket.IO app
socket_app = socketio.ASGIApp(sio, app)


# For running with uvicorn directly
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:socket_app",
        host="0.0.0.0",
        port=settings.SOCKET_PORT,
        reload=True,
    )
