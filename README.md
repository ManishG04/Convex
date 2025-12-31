# Convex

**"Gamifying Focus with Affective Computing."**
A V-Tuber style studyverse where your face controls the game, processed 100% locally for total privacy.

## Table of Contents

- [About the Project](#about-the-project)
- [The Problem](#the-problem)
- [Privacy Architecture](#privacy--security-the-edge-ai-advantage)
- [Key Features](#current-features-mvp)
- [Features for Round 2](#roadmap-round-2-updates)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)

## About the Project

**Convex** is a next-generation study environment that solves the isolation of remote learning without compromising privacy. By leveraging **Edge AI**, we turn a standard study session into a multiplayer RPG experience.

Instead of broadcasting video (invasive and bandwidth-heavy), Convex tracks facial landmarks locally to animate a **3D Avatar** in real-time. If you focus, your avatar focuses. If you get distracted, your avatar falls asleep, and your game stats drop.

## The Problem

Traditional study apps (Yeolpumta, Forest) and tools (Zoom, Discord) suffer from three critical flaws:

1. **Passive Tracking:** Users can start a timer and scroll on their phone. Apps reward "Time Spent" rather than "True Focus."
2. **Digital Loneliness:** Studying alone kills motivation, but always-on video calls cause fatigue and feel invasive.
3. **Burnout Cycles:** Users set unrealistic goals (e.g., "10 hours today"), fail, and quit entirely.

## Userflow Diagram

![User Diagram](assets/convex_flowchart.png)

## Current Features

### 1. The Avatar

The core of our platform is a bio-mirror that provides real-time feedback.

- **Real-Time Mimicry:** The avatar mirrors your head movements and expressions with low latency.
- **Distraction Guard:** If the Edge AI detects you looking at a phone or away from the screen for **>15 seconds**, the avatar "falls asleep," and your session timer automatically pauses.

### 2. Competitive Rooms

Gamifying the group study experience.

- **The Mechanic:** Join a group with 4+ friends. The group's collective Focus Time deals damage to a "Boss Monster."

## Features for Round 2

We are moving from _Tracking Focus_ to _Optimizing Habits_.

### 3. Local Focus Verification

- **Confusion Detection:** The app detects "Furrowed Brow" micro-expressions to tag sessions as "High Cognitive Load," giving you data on which subjects are actually hardest for you.

- **The Penalty:** If one user gets distracted (detected by AI), the group's **DPS (Damage Per Second)** drops. This creates positive peer pressure to stay focused.

- **Ghost Mode (Async Multiplayer):** Study alongside the "Ghost" of a friend's previous session (recorded metadata, not video).

- **Streaks:** The app will give user the option of setting their own limits, as the user can decide how many hours a day would be eligible for maintaining the streak.

## Privacy & Security

We utilize a **Zero-Trust Video Architecture**. We understand that students are privacy-conscious, which is why Convex is built to ensure your camera feed never leaves your device.

- **100% On-Device Processing:** All facial analysis (Blink Rate, Gaze Tracking, Emotion Detection) runs locally in your browser using **MediaPipe via WebAssembly**.
- **No Video Uploads:** Your camera feed is processed in RAM and discarded instantly.

## Tech Stack

| Component     | Technology                | Description                          |
| ------------- | ------------------------- | ------------------------------------ |
| **Frontend**  | Next.js 14 (App Router)   | UI/UX and State Management           |
| **Rendering** | Three.js                  | 3D Avatar Rendering and Animation    |
| **AI Engine** | TensorFlow.js / MediaPipe | Face Mesh and Gaze tracking (Edge)   |
| **Backend**   | Python FastAPI            | API and Logic                        |
| **Real-Time** | python-socketio           | JSON Coordinate Sync for Multiplayer |
| **Database**  | SQLite + Prisma           | User stats and session metadata      |

---

## Getting Started

### Prerequisites

- **Node.js** (v18+) and **pnpm**
- **Python** (3.10+)
- **uv**: `curl -LsSf https://astral.sh/uv/install.sh | sh`

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/ManishG04/Convex
cd Convex
```

2. **Install frontend dependencies**

```bash
pnpm install
```

3. **Set up the database**

```bash
pnpm exec prisma migrate dev
```

4. **Install backend dependencies**

```bash
cd backend
uv sync
```

### Configuration

Create `.env` files:

**Root `.env`** (for Next.js frontend):

```bash
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"

# Optional: LiveKit for video
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_URL=
```

**`backend/.env`** (for FastAPI):

```bash
FRONTEND_URL=http://localhost:3000
SOCKET_PORT=3001
```

### Running the Application

**1. Start the Python backend**:

```bash
cd backend
uv run python -m uvicorn app.main:socket_app --reload --port 3001
```

**2. Start the Next.js frontend** (in root directory):

```bash
pnpm dev
```

**3. Open** http://localhost:3000

### API Documentation

Once the backend is running:

- Swagger UI: **`http://127.0.0.1:3001/docs`**
- Redoc: **`http://127.0.0.1:3001/redoc`**

### Managing Backend Packages

```bash
cd backend
uv add package_name
uv remove package_name
```
