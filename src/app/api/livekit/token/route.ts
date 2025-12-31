import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function POST(req: NextRequest) {
  const { roomCode, username } = await req.json();

  if (!roomCode || !username) {
    return NextResponse.json(
      { error: "Missing roomCode or username" },
      { status: 400 }
    );
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    // Return a flag indicating LiveKit is not configured
    return NextResponse.json({ configured: false });
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: username,
    name: username,
  });

  token.addGrant({
    roomJoin: true,
    room: roomCode,
    canPublish: true,
    canSubscribe: true,
  });

  const jwt = await token.toJwt();

  return NextResponse.json({
    configured: true,
    token: jwt,
    url: process.env.LIVEKIT_URL,
  });
}
