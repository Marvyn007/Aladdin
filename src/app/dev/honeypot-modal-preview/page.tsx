import { notFound } from 'next/navigation';
import { HoneypotModalPreviewClient } from './HoneypotModalPreviewClient';

export default function HoneypotModalPreviewPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }
  return <HoneypotModalPreviewClient />;
}
