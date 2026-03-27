import Link from 'next/link';

export default function NotFound() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f9fafb',
        }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    fontSize: '72px',
                    fontWeight: 700,
                    color: '#e5e7eb',
                    lineHeight: 1,
                    marginBottom: '16px',
                }}>
                    404
                </div>
                <h1 style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    color: '#111827',
                    marginBottom: '8px',
                }}>
                    Page not found
                </h1>
                <p style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    marginBottom: '24px',
                }}>
                    The page you&apos;re looking for doesn&apos;t exist.
                </p>
                <Link
                    href="/"
                    style={{
                        display: 'inline-block',
                        padding: '10px 20px',
                        background: '#111827',
                        color: '#ffffff',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontSize: '14px',
                        fontWeight: 500,
                    }}
                >
                    Go home
                </Link>
            </div>
        </div>
    );
}
