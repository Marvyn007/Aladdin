import { prisma } from '@/lib/prisma';
import { enrichPerson } from './prospeo-client';

export class ContactNotFoundError extends Error {
  constructor() { super('Contact not found'); this.name = 'ContactNotFoundError'; }
}

export interface RevealResult {
  email: string | null;
  emailStatus: string | null;
  fromCache: boolean;
}

export async function revealContactEmail(contactId: string, userId: string): Promise<RevealResult> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new ContactNotFoundError();

  // Already revealed — return from cache
  if (contact.email) {
    await prisma.contactReveal.upsert({
      where: { userId_contactId: { userId, contactId } },
      create: { userId, contactId },
      update: {},
    });
    return { email: contact.email, emailStatus: contact.emailStatus, fromCache: true };
  }

  // Extract Prospeo person_id from the stored provider ID (format: "prospeo:{person_id}")
  const personId = contact.apolloId.replace(/^prospeo:/, '');

  const enriched = await enrichPerson(
    personId,
    contact.firstName,
    contact.lastName,
    contact.companyDomain ?? '',
  );

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: {
      email: enriched.email,
      emailStatus: enriched.emailStatus,
      emailRevealedAt: enriched.email ? new Date() : null,
    },
  });

  await prisma.contactReveal.upsert({
    where: { userId_contactId: { userId, contactId } },
    create: { userId, contactId },
    update: {},
  });

  return { email: updated.email, emailStatus: updated.emailStatus, fromCache: false };
}
