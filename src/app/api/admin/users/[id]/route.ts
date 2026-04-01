import { NextResponse } from 'next/server';

import { adminUsers, AdminUserRecord } from '@/components/admin/admin-data';

type UpdateableFields = Partial<
  Pick<AdminUserRecord, 'plan' | 'segment' | 'notes' | 'resumeLinks' | 'linkedinUrl'>
>;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as UpdateableFields;

  const user = adminUsers.find((u) => u.id === id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const updated: AdminUserRecord = { ...user, ...body };
  return NextResponse.json({ user: updated });
}
