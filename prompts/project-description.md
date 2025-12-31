# Convex - Hackathon Prototype

> A minimal co-working app with synced timers and video. Ship fast, demo well.

## What We're Building

**Problem:** Remote work/study is lonely → people procrastinate without accountability.

**Solution:** Video rooms with a shared Pomodoro timer. See others working = stay focused ("body doubling").

## MVP Features (Round 1)

1. **Synced Timer** - Host starts 25/5 Pomodoro, everyone sees the same countdown
2. **Video Grid** - LiveKit-powered video so you can see others working
3. **Distraction Alert** - Switch tabs → your video gets a "Distracted" overlay
4. **Basic Leaderboard** - Track completed focus sessions

### Cut for MVP

- ~~Friend lists / nudges~~
- ~~Public/private room settings~~
- ~~Squad summary cards~~
- ~~User auth~~ (just use room codes + usernames)

## Tech Stack (Keep It Simple)

```
Next.js (App Router) + TypeScript + Tailwind
Socket.io for timer sync
LiveKit self-hosted for video (free, deploy to Railway)
SQLite or Postgres + Prisma
Redis optional (in-memory state is fine for demo)
```

> **Why LiveKit self-hosted?** Need 10+ participants = need an SFU (Selective Forwarding Unit). Mesh WebRTC dies at 4-5 people. LiveKit is free to self-host, has great React SDK, and Railway free tier can run it.

## The One Thing That Must Work

**Timer sync:** Server sends absolute `endTime` timestamp, clients calculate remaining time locally. No drift.

```typescript
// Server
io.to(roomId).emit("timer:start", { endTime: Date.now() + 25 * 60 * 1000 });

// Client
const remaining = endTime - Date.now();
```

## Demo Flow

1. User enters name → joins/creates room
2. Video grid shows all participants
3. Host clicks "Start Focus" → 25min timer starts for everyone
4. If someone switches tabs → "Distracted" badge appears on their video
5. Timer ends → show "Session Complete" with basic stats

## Shortcuts

- No auth, just room codes
- Hardcoded 25/5 timer
- Console.log debugging
- Deploy frontend to Vercel, backend to Railway
