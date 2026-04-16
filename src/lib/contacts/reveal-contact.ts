import { prisma } from '@/lib/prisma';
import { enrichPerson } from './apollo-client';

export class ContactNotFoundError extends Error {
  constructor() { super('Contact not found'); this.name = 'ContactNotFoundError'; }
}

export interface RevealResult {
  email: string;
  emailStatus: string | null;
  fromCache: boolean;
}

export async function revealContactEmail(contactId: string, userId: string): Promise<RevealResult> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new ContactNotFoundError();

  if (contact.email) {
    await prisma.contactReveal.upsert({
      where: { userId_contactId: { userId, contactId } },
      create: { userId, contactId },
      update: {},
    });
    return { email: contact.email, emailStatus: contact.emailStatus, fromCache: true };
  }

  const person = await enrichPerson(contact.apolloId);
  if (!person.email) throw new Error('Apollo returned no email for this contact');

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: { email: person.email, emailStatus: person.email_status, emailRevealedAt: new Date() },
  });

  await prisma.contactReveal.upsert({
    where: { userId_contactId: { userId, contactId } },
    create: { userId, contactId },
    update: {},
  });

  return { email: updated.email!, emailStatus: updated.emailStatus, fromCache: false };
}
