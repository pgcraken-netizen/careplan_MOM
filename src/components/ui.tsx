"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { CalendarDays, Search, Settings, UserRound } from "lucide-react";
import { STATUS_LABEL, toneFor } from "@/lib/sections";
import type { MeetingStatus } from "@/lib/types";

export function Logo({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <Image
      src="/brand/logo-horizontal.png"
      alt="アソシエ"
      width={626}
      height={240}
      priority
      className={className}
    />
  );
}

/** 左にページ名、右上にロゴ */
export function AppHeader({
  title,
  back,
  right,
}: {
  title: string;
  back?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:h-[72px] sm:px-6">
        {back}
        <h1 className="min-w-0 flex-1 truncate font-round text-[22px] font-extrabold tracking-wide text-navy sm:text-[26px]">
          {title}
        </h1>
        {right}
        <Link href="/" aria-label="ホームへ" className="shrink-0 pl-2">
          <Logo className="h-9 w-auto sm:h-11" />
        </Link>
      </div>
    </header>
  );
}

const NAV = [
  { href: "/", label: "会議一覧", icon: CalendarDays },
  { href: "/clients", label: "利用者", icon: UserRound },
  { href: "/search", label: "検索", icon: Search },
  { href: "/settings", label: "設定", icon: Settings },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 pb-2 pt-2.5 text-[11px] font-bold ${
                  active ? "text-brand" : "text-ink-faint"
                }`}
              >
                <Icon size={24} strokeWidth={active ? 2.4 : 2} />
                {label}
                <span className={`mt-0.5 h-[3px] w-8 rounded-full ${active ? "bg-brand" : "bg-transparent"}`} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const STATUS_STYLE: Record<MeetingStatus, string> = {
  processing: "bg-gray-100 text-ink-soft",
  draft: "bg-ai text-ai-ink",
  reviewing: "bg-[#FDE7DF] text-[#C2462B]",
  confirmed: "bg-brand-soft text-brand",
};

export function StatusBadge({ status }: { status: MeetingStatus }) {
  return (
    <span className={`shrink-0 rounded-full px-3.5 py-1 text-[13px] font-bold ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Chip({ label, className = "" }: { label: string; className?: string }) {
  const t = toneFor(label);
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-[12px] font-bold leading-5 ${className}`}
      style={{ background: t.bg, color: t.fg }}
    >
      {label || "未分類"}
    </span>
  );
}

export function AiMark({ small = false }: { small?: boolean }) {
  return (
    <span
      title="AIが作成・未確認"
      className={`inline-flex shrink-0 items-center rounded bg-ai font-bold text-ai-ink ${
        small ? "px-1 text-[10px] leading-4" : "px-1.5 text-[11px] leading-5"
      }`}
    >
      AI
    </span>
  );
}

export function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="mb-3 mt-7 flex items-center gap-2.5">
      <span className="h-6 w-[5px] rounded-full bg-brand" />
      <h2 className="flex-1 font-round text-[19px] font-extrabold text-navy">{children}</h2>
      {count !== undefined && <span className="text-sm text-ink-soft">{count}件</span>}
    </div>
  );
}

export function EmptyDog({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-ink-soft">
      <Image src="/brand/dog.png" alt="" width={72} height={79} className="opacity-80" />
      {text}
    </div>
  );
}
