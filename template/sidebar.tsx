"use client";

// Template sidebar utama aplikasi.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BrandImage, useBranding } from "@/lib/branding";
import { ChevronDown, Wrench, X } from "lucide-react";
import { cn, useSession, type User } from "@/lib/session";
import {
  Database,
  Settings,
  Activity,
  Gauge,
  Radio,
  Users,
  ShieldCheck,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
type NavChild = { href: string; label: string; icon: LucideIcon };
type NavItem = NavChild & {
  match?: string;
  children?: NavChild[];
  admin?: boolean;
};
const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/?tab=monitoring", label: "Monitoring Mesin", icon: Activity },
  {
    href: "/?tab=mesin",
    label: "Gateway & Register",
    icon: Radio,
    admin: true,
  },
  {
    href: "/?tab=pengguna",
    label: "MasterData",
    icon: Database,
    admin: true,
    children: [
      { href: "/?tab=pengguna", label: "UserManagement", icon: Users },
      { href: "/?tab=role", label: "Role Management", icon: ShieldCheck },
      {
        href: "/?tab=permission",
        label: "Permission Management",
        icon: KeyRound,
      },
      { href: "/settings", label: "Setting", icon: Settings },
    ],
  },
];
function visibleChildren(item: NavItem, user: User | null) {
  return item.children || [];
}
function isItemVisible(item: NavItem, user: User | null) {
  return !item.admin || user?.role === "admin";
}

export function AppSidebar({
  open,
  collapsed = false,
  onClose,
  activeHref,
}: {
  activeHref: string;
  open: boolean;
  collapsed?: boolean;
  onClose: () => void;
}) {
  const pathname = activeHref;
  const asideRef = useRef<HTMLElement>(null);
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!open || desktop) return;
    const previous = document.activeElement as HTMLElement | null;
    asideRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes =
        asideRef.current?.querySelectorAll<HTMLElement>("a, button");
      if (!nodes?.length) return;
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [open, desktop]);
  const { user } = useSession();
  const { branding } = useBranding();
  const { appName, appSubtitle } = branding;
  const logoUrl = branding.iconUrl || branding.logoUrl;

  const items = useMemo(
    () => NAV_ITEMS.filter((i) => isItemVisible(i, user)),
    [user],
  );

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={onClose}
        />
      ) : null}
      <aside
        ref={asideRef}
        inert={!desktop && !open}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh w-64 shrink-0 flex-col bg-[#0a0f1c] text-slate-300 transition-transform lg:sticky lg:top-0 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed && "lg:hidden",
        )}
      >
        {/* Brand */}
        <div className="flex items-start justify-between gap-2 px-5 pb-4 pt-5">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-white ring-1 ring-white/10">
              <BrandImage src={logoUrl} name={appName} />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-bold text-white">
                {appName}
              </span>
              <span className="block text-[11px] text-slate-400">
                {appSubtitle}
              </span>
            </span>
          </Link>
          <button
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 lg:hidden"
            onClick={onClose}
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-5 border-t border-white/10" />

        {/* Section label */}
        <p className="px-5 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Menu Utama
        </p>

        <nav
          aria-label="Navigasi utama"
          className="no-scrollbar flex-1 space-y-1 overflow-y-auto px-3 pb-4"
        >
          {items.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              pathname={pathname}
              childItems={visibleChildren(item, user)}
              onNavigate={onClose}
            />
          ))}
        </nav>
      </aside>
    </>
  );
}

function SidebarLink({
  item,
  pathname,
  childItems,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  childItems: NavChild[];
  onNavigate: () => void;
}) {
  const active =
    childItems.some((child) => child.href === pathname) ||
    (item.match ? pathname.startsWith(item.match) : pathname === item.href);
  const [expanded, setExpanded] = useState(active);
  useEffect(() => {
    if (active) setExpanded(true);
  }, [active, pathname]);
  const Icon = item.icon;
  const hasChildren = childItems.length > 0;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center rounded-lg text-sm font-medium text-white transition",
          active ? "bg-blue-600 shadow-sm" : "hover:bg-white/5",
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="flex flex-1 items-center gap-3 px-3 py-2.5 text-left"
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span>{item.label}</span>
          </button>
        ) : (
          <>
            <Link
              aria-current={active ? "page" : undefined}
              href={item.href}
              onClick={onNavigate}
              className="flex flex-1 items-center gap-3 px-3 py-2.5"
            >
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  active
                    ? "text-white"
                    : "text-slate-300 group-hover:text-white",
                )}
              />
              <span className="text-white">{item.label}</span>
            </Link>
          </>
        )}
        {hasChildren ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "px-2.5 py-2.5",
              active ? "text-white/80" : "text-slate-500 hover:text-slate-300",
            )}
            aria-expanded={expanded}
            aria-label={expanded ? "Tutup submenu" : "Buka submenu"}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </button>
        ) : (
          <span className="px-2.5" />
        )}
      </div>

      {hasChildren && expanded ? (
        <div className="ml-[26px] mt-1 space-y-0.5 border-l border-white/10 pl-3">
          {childItems.map((child) => {
            const ChildIcon = child.icon;
            const childActive =
              pathname === child.href ||
              pathname +
                (typeof window !== "undefined"
                  ? window.location.search
                  : "") ===
                child.href;
            return (
              <Link
                aria-current={childActive ? "page" : undefined}
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] text-white transition",
                  childActive ? "bg-white/10 font-medium" : "hover:bg-white/5",
                )}
              >
                <ChildIcon className="h-3.5 w-3.5 shrink-0 text-white" />
                <span className="text-white">{child.label}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
