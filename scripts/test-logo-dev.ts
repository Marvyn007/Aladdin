import 'dotenv/config';

async function main() {
  const secretKey = process.env.LOGO_DEV_SECRET_KEY;
  const pubKey = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN || process.env.LOGO_API_KEY;

  console.log('Secret key present:', !!secretKey, secretKey ? `(${secretKey.slice(0, 8)}...)` : '');
  console.log('Pub key present:   ', !!pubKey, pubKey ? `(${pubKey.slice(0, 8)}...)` : '');

  if (!secretKey) { console.error('LOGO_DEV_SECRET_KEY not set'); process.exit(1); }

  const res = await fetch(`https://api.logo.dev/search?q=Stripe`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  console.log('\nSearch API status:', res.status);
  if (!res.ok) { console.error('Search API failed:', await res.text()); process.exit(1); }

  const data = await res.json() as Array<{ name: string; domain: string; logo_url?: string }>;
  console.log('Results:', data.slice(0, 3).map((d) => `${d.name} → ${d.domain}`));

  if (pubKey && data[0]?.domain) {
    const imgUrl = `https://img.logo.dev/${data[0].domain}?token=${pubKey}&size=128`;
    const imgRes = await fetch(imgUrl, { method: 'HEAD' });
    console.log(`\nCDN image status:`, imgRes.status, imgRes.headers.get('content-type'));
  }

  console.log('\n✓ logo.dev is configured correctly');
}

main().catch((e) => { console.error(e); process.exit(1); });
