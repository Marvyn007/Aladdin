"use client";

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { getInitials } from "@/components/admin/admin-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
      <div className="space-y-2">
        <p className="admin-kicker">{eyebrow}</p>
        <h1 className="text-[1.75rem] font-semibold tracking-[-0.035em] text-foreground sm:text-[2rem]">
          {title}
        </h1>
        <p className="max-w-3xl text-[0.98rem] leading-8 text-muted-foreground">
          {description}
        </p>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </section>
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
    <Card className="admin-stat-card">
      <CardHeader className="gap-3 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardDescription className="text-[0.84rem] font-medium tracking-[-0.01em] text-muted-foreground">
              {label}
            </CardDescription>
            <CardTitle className="text-[2.1rem] font-semibold tracking-[-0.04em] text-foreground">
              {value}
            </CardTitle>
          </div>
          {trend ? (
            <Badge
              variant="outline"
              className="rounded-md border-border/80 bg-background/80 px-2.5 py-1 text-[0.72rem] font-semibold text-foreground"
            >
              {trend}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-[0.98rem] leading-7 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export function AdminPanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("admin-panel", className)}>
      <CardHeader className="gap-3 border-b border-border/70 pb-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
            <CardTitle className="text-[1.12rem] font-semibold tracking-[-0.02em] text-foreground">
              {title}
            </CardTitle>
            <CardDescription className="max-w-2xl text-[0.98rem] leading-7 text-muted-foreground">
              {description}
            </CardDescription>
          </div>
          {action ? <div className="w-full xl:w-auto xl:max-w-[48%] xl:shrink-0">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
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
    <div className="flex items-center gap-3">
      <Avatar className="size-10 border border-border/80 bg-secondary/80 text-foreground">
        <AvatarFallback>{getInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{name}</span>
          {badge}
        </div>
        <p className="text-sm text-muted-foreground">{secondary}</p>
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
