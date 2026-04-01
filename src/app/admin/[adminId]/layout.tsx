'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { DM_Sans } from 'next/font/google';
import {
    BarChart3,
    BriefcaseBusiness,
    CircleHelp,
    FolderOpen,
    Search,
    Settings,
    Sparkles,
    Users2,
} from 'lucide-react';

import './admin-theme.css';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const adminSans = DM_Sans({
    subsets: ['latin'],
    variable: '--font-admin-sans',
});

const primaryNav = [
    { href: '/admin', label: 'Dashboard', icon: BarChart3 },
    { href: '/admin/users', label: 'Users', icon: Users2 },
    { href: '/admin/jobs', label: 'Jobs', icon: BriefcaseBusiness },
];

const secondaryNav = [
    { href: '/admin/interviews', label: 'Interview Reviews', icon: FolderOpen },
];

const utilityNav = [
    { label: 'Settings', icon: Settings },
    { label: 'Help', icon: CircleHelp },
    { label: 'Search', icon: Search },
];

function getBasePath(pathname: string): string {
    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] === 'admin' && segments[1]) {
        return `/admin/${segments[1]}`;
    }
    return '/admin';
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const basePath = getBasePath(pathname);

    useEffect(() => {
        document.documentElement.classList.add('admin-scrollable');
        document.body.classList.add('admin-scrollable');

        return () => {
            document.documentElement.classList.remove('admin-scrollable');
            document.body.classList.remove('admin-scrollable');
        };
    }, []);

    const isActive = (href: string) => {
        if (href === '/admin') {
            return pathname === basePath;
        }

        return pathname.startsWith(href.replace('/admin', basePath));
    };

    const allNav = [...primaryNav, ...secondaryNav];
    const activeNav = allNav.find((item) => isActive(item.href));
    const pageLabel = activeNav?.label ?? 'Dashboard';

    return (
        <div className={cn('admin-theme', adminSans.variable)} style={{ fontFamily: 'var(--font-admin-sans)' }}>
            <div className="admin-shell">
                <aside className="admin-sidebar admin-enter">
                    <div className="flex items-center gap-3">
                        <div className="admin-brand-mark">
                            <Sparkles className="size-4" />
                        </div>
                        <div>
                            <p className="text-[1.4rem] font-semibold tracking-[-0.04em] text-foreground">Aladdin</p>
                            <p className="text-sm text-muted-foreground">Admin ops</p>
                        </div>
                    </div>

                    <Button className="admin-quick-create">
                        <Sparkles className="size-4" />
                        Quick Create
                    </Button>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <p className="admin-sidebar-label">Workspace</p>
                            <nav className="space-y-1.5">
                                {primaryNav.map((item) => {
                                    const href = item.href === '/admin' ? basePath : item.href.replace('/admin', basePath);
                                    const Icon = item.icon;
                                    const active = isActive(item.href);

                                    return (
                                        <Link
                                            key={item.href}
                                            href={href}
                                            className={cn('admin-nav-link', active && 'is-active')}
                                        >
                                            <Icon className="size-4" />
                                            <span>{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="space-y-2">
                            <p className="admin-sidebar-label">Reviews</p>
                            <nav className="space-y-1.5">
                                {secondaryNav.map((item) => {
                                    const href = item.href.replace('/admin', basePath);
                                    const Icon = item.icon;
                                    const active = isActive(item.href);

                                    return (
                                        <Link
                                            key={item.href}
                                            href={href}
                                            className={cn('admin-nav-link', active && 'is-active')}
                                        >
                                            <Icon className="size-4" />
                                            <span>{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="space-y-2">
                            <p className="admin-sidebar-label">Utilities</p>
                            <div className="space-y-1.5">
                                {utilityNav.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <div key={item.label} className="admin-nav-link is-utility">
                                            <Icon className="size-4" />
                                            <span>{item.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="admin-sidebar-footer">
                        <div className="admin-avatar-chip">AO</div>
                        <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-foreground">Admin Workspace</p>
                            <p className="text-sm text-muted-foreground">Aladdin Operations</p>
                        </div>
                    </div>
                </aside>

                <main className="admin-main">
                    <header className="admin-topbar">
                        <span className="admin-topbar-sep" />
                        <span className="text-sm font-medium text-foreground">{pageLabel}</span>
                        <span className="ml-auto text-xs text-muted-foreground">Aladdin Admin · v1.0</span>
                    </header>
                    <div className="admin-main-inner @container/main admin-enter">{children}</div>
                </main>
            </div>
        </div>
    );
}
