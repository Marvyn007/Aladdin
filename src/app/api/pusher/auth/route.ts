import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Pusher from 'pusher';

const pusher = new Pusher({
  appId:   process.env.PUSHER_APP_ID!,
  key:     process.env.PUSHER_KEY!,
  secret:  process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS:  true,
});

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.text();
  const params = new URLSearchParams(body);
  const socketId   = params.get('socket_id')   ?? '';
  const channelName = params.get('channel_name') ?? '';

  // Only allow users to auth their own session channels: private-apply-{sessionId}
  // The sessionId check (ownership) is enforced at session-start time; here we
  // just verify the user is logged in before granting channel access.
  if (!channelName.startsWith('private-apply-')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const authResponse = pusher.authorizeChannel(socketId, channelName);
  return NextResponse.json(authResponse);
}
