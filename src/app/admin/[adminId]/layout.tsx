'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Inter } from 'next/font/google';
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  FolderOpen,
  House,
  PanelLeftClose,
  PanelLeftOpen,
  Users2,
} from 'lucide-react';

import './admin-theme.css';
import { cn } from '@/lib/utils';

const adminSans = Inter({
  subsets: ['latin'],
  variable: '--font-admin-sans',
});

const sidebarNav = [
  { href: '/', label: 'Home', icon: House },
  { href: '/admin', label: 'Dashboard', icon: BarChart3 },
  { href: '/admin/companies', label: 'Companies', icon: Building2 },
  { href: '/admin/jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { href: '/admin/users', label: 'Users', icon: Users2 },
  { href: '/admin/interviews', label: 'Interview Reviews', icon: FolderOpen },
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
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    document.documentElement.classList.add('admin-scrollable');
    document.body.classList.add('admin-scrollable');

    return () => {
      document.documentElement.classList.remove('admin-scrollable');
      document.body.classList.remove('admin-scrollable');
    };
  }, []);

  useEffect(() => {
    const savedState = window.localStorage.getItem('admin-sidebar-open');
    if (savedState === 'false') {
      const frame = window.requestAnimationFrame(() => setSidebarOpen(false));
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('admin-sidebar-open', String(sidebarOpen));
  }, [sidebarOpen]);

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }

    if (href === '/admin') {
      return pathname === basePath;
    }

    return pathname.startsWith(href.replace('/admin', basePath));
  };

  return (
    <div className={cn('admin-theme', adminSans.variable)} style={{ fontFamily: 'var(--font-admin-sans)' }}>
      <div className={cn('admin-shell', sidebarOpen ? 'is-sidebar-open' : 'is-sidebar-collapsed')}>
        <button
          type="button"
          className="admin-sidebar-toggle"
          onClick={() => setSidebarOpen(true)}
          aria-label="Show admin sidebar"
          title="Show admin sidebar"
        >
          <PanelLeftOpen className="size-4" />
        </button>

        {sidebarOpen ? (
          <button
            type="button"
            className="admin-sidebar-backdrop"
            aria-label="Hide admin sidebar overlay"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <aside className="admin-sidebar admin-enter" aria-hidden={!sidebarOpen}>
          <div className="admin-sidebar-inner">
            <div className="admin-sidebar-header">
              <div className="admin-brand">
                <div className="admin-brand-logo-wrap">
                  <Image
                    src="/aladdin-logo.png"
                    alt="Aladdin"
                    width={40}
                    height={40}
                    className="admin-brand-logo"
                    priority
                  />
                </div>
                <div className="space-y-1">
                  <p className="admin-brand-title">Aladdin</p>
                  <p className="admin-brand-subtitle">Admin command center</p>
                </div>
              </div>

              <button
                type="button"
                className="admin-sidebar-icon-button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Hide admin sidebar"
              >
                <PanelLeftClose className="size-4" />
              </button>
            </div>

            <nav className="space-y-1.5">
              {sidebarNav.map((item) => {
                const href =
                  item.href === '/admin'
                    ? basePath
                    : item.href.startsWith('/admin')
                      ? item.href.replace('/admin', basePath)
                      : item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={href}
                    className={cn('admin-nav-link', isActive(item.href) && 'is-active')}
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="admin-sidebar-footer">
              <div className="admin-avatar-chip">AO</div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">Operations workspace</p>
                <p className="text-sm text-muted-foreground">Live admin surface</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="admin-main">
          <div className="admin-main-inner @container/main">{children}</div>
        </main>
      </div>
    </div>
  );
}
