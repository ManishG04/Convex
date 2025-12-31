# Convex Backend

Python FastAPI backend with Socket.io for real-time communication.

## Setup

```bash
cd backend
uv sync
```

## Run

```bash
cd backend
uv run python -m uvicorn app.main:socket_app --reload --port 3001
```

## Environment Variables

Create a `.env` file in the backend directory:

```
FRONTEND_URL=http://localhost:3000
```
