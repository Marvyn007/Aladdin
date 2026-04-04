import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { Webhook } from 'svix'

import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface ClerkUserEventData {
  id: string
  first_name: string | null
  last_name: string | null
  image_url: string | null
  email_addresses: Array<{ email_address: string; id: string }>
  primary_email_address_id: string | null
}

function extractEmail(data: ClerkUserEventData): string | null {
  if (!data.primary_email_address_id || !data.email_addresses?.length) return null
  const primary = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  )
  return primary?.email_address ?? data.email_addresses[0]?.email_address ?? null
}

export async function POST(request: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhook:clerk] CLERK_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const headerPayload = await headers()
  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const body = await request.text()

  let event: { type: string; data: ClerkUserEventData }
  try {
    const wh = new Webhook(secret)
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as { type: string; data: ClerkUserEventData }
  } catch (err) {
    console.error('[webhook:clerk] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type !== 'user.created' && event.type !== 'user.updated') {
    return NextResponse.json({ received: true })
  }

  const { id, first_name, last_name, image_url } = event.data
  const email = extractEmail(event.data)
  const firstName = first_name?.trim() || null
  const lastName = last_name?.trim() || null
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || null

  try {
    await prisma.user.updateMany({
      where: { id },
      data: {
        ...(firstName !== null ? { firstName } : {}),
        ...(lastName !== null ? { lastName } : {}),
        ...(email !== null ? { email } : {}),
        ...(fullName !== null ? { name: fullName } : {}),
        ...(image_url ? { imageUrl: image_url } : {}),
      },
    })

    console.log(`[webhook:clerk] Synced ${event.type} for user ${id}: ${fullName ?? 'no name'} / ${email ?? 'no email'}`)
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[webhook:clerk] DB update failed:', error)
    return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
  }
}
