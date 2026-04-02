"use client";

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AdminPageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="admin-page-intro admin-enter">
      <div className="space-y-1">
        <p className="admin-kicker">{eyebrow}</p>
        <h1 className="text-[1.68rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[2rem]">
          {title}
        </h1>
        <p className="max-w-[44rem] text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {actions ? <div className="admin-page-intro-actions">{actions}</div> : null}
    </section>
  );
}

export function DashboardCard({
  title,
  value,
  description,
  badge,
}: {
  title: string;
  value: string;
  description: string;
  badge?: string;
}) {
  return (
    <div className="dashboard-card admin-enter">
      <div className="dashboard-card-header">
        <p className="dashboard-card-title">{title}</p>
        {badge ? (
          <Badge
            variant="outline"
            className="dashboard-card-badge"
          >
            {badge}
          </Badge>
        ) : null}
      </div>
      <p className="dashboard-card-value">{value}</p>
      <p className="dashboard-card-description">{description}</p>
    </div>
  );
}

export function AdminStatCard({
  label,
  value,
  detail,
  trend,
}: {
  label: string;
  value: string;
  detail: string;
  trend?: string;
}) {
  return (
    <DashboardCard
      title={label}
      value={value}
      description={detail}
      badge={trend}
    />
  );
}

export function AdminPanel({
  title,
  description,
  action,
  children,
  className,
  flush = false,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <Card className={cn("admin-panel admin-enter", flush && "admin-panel--flush", className)}>
      <CardHeader className="gap-1.5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="text-[1rem] font-semibold tracking-[-0.02em] text-foreground">
              {title}
            </CardTitle>
            <CardDescription className="max-w-[42rem] text-sm leading-6 text-muted-foreground">
              {description}
            </CardDescription>
          </div>
          {action ? <div className="w-full xl:w-auto xl:max-w-[48%] xl:shrink-0">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function AdminIdentity({
  name,
  secondary,
  badge,
}: {
  name: string;
  secondary: string;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Avatar className="size-9 border border-border/80 bg-white text-foreground shadow-none">
        <AvatarFallback>{getInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-foreground">{name}</span>
          {badge}
        </div>
        <p className="truncate text-sm text-muted-foreground">{secondary}</p>
      </div>
    </div>
  );
}

export function AdminMiniList({
  items,
}: {
  items: Array<{ title: string; detail: string; tone: string }>;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.title} className="admin-list-row">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <p className="text-sm leading-6 text-muted-foreground">{item.detail}</p>
          </div>
          <div className="hidden items-center gap-1 text-[0.78rem] font-semibold text-primary sm:flex">
            {item.tone}
            <ArrowUpRight className="size-3.5" />
          </div>
        </div>
      ))}
    </div>
  );
}
