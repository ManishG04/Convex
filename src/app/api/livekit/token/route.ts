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

  // IMPORTANT: Disable video/audio publishing - only avatars are shown
  // Raw video feeds are NOT transmitted for privacy
  token.addGrant({
    roomJoin: true,
    room: roomCode,
    canPublish: false, // No video/audio publishing
    canSubscribe: false, // No need to receive video/audio
    canPublishData: true, // Allow data messages for avatar blend shapes sync
  });

  const jwt = await token.toJwt();

  return NextResponse.json({
    configured: true,
    token: jwt,
    url: process.env.LIVEKIT_URL,
  });
}
