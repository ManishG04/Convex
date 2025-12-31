# Convex - AI Coding Instructions

## Project Overview

Convex is a hackathon prototype for a real-time collaborative focus platform. Synchronized Pomodoro timers, video rooms for "body doubling", and a simple leaderboard.

**This is a messy prototype—prioritize working features over clean architecture.**

## Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: NestJS with Socket.io (`@nestjs/websockets`)
- **Video**: LiveKit self-hosted (free SFU for 10+ participants, deploy to Railway)
- **Database**: PostgreSQL + Prisma
- **Cache**: Redis (for timer state & leaderboard)

## Project Structure

Keep it simple—no monorepo overhead:

```
/src
  /app            # Next.js pages & API routes
  /components     # React components
  /lib            # Utilities, socket client, hooks
  /server         # NestJS backend (can be separate repo or /server folder)
prisma/
  schema.prisma
```

## The One Rule That Matters

### Timer Sync

Always send **absolute end timestamp**, never remaining time:

```typescript
// Server broadcasts
{ event: 'timer:start', endTime: Date.now() + 25*60*1000, phase: 'focus' }
// Client calculates remaining locally
```

## Quick Patterns

### Socket Events

Use simple names: `timer:start`, `timer:stop`, `user:distracted`, `room:join`

### Anti-Distraction Overlay

```typescript
document.addEventListener("visibilitychange", () => {
  if (document.hidden) socket.emit("user:distracted");
  else socket.emit("user:focused");
});
```

### LiveKit Metadata

Attach user status to participant metadata for instant UI updates across all clients.

## Shortcuts (Hackathon Mode)

- ✅ Use Next.js API routes for simple endpoints instead of full NestJS REST
- ✅ In-memory state is fine for demo if Redis isn't set up
- ✅ Skip auth for prototype—use simple username/room codes
- ✅ Hardcode Pomodoro duration (25/5) initially
- ✅ SQLite works if Postgres is too heavy for local dev

## Environment Variables

```
DATABASE_URL
REDIS_URL (optional for prototype)
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
LIVEKIT_URL
```

## Dev Commands

```bash
npm install
npm run dev           # Start Next.js
npx prisma migrate dev
npx prisma studio     # View DB
```

## Don't Overthink

- No need for perfect error handling
- Console.log debugging is fine
- Inline styles acceptable for quick iteration
- Copy-paste is faster than abstractions for a prototype
