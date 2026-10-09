"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Plus,
  Search,
  Tag,
  UserRound,
} from "lucide-react";
import { AppHeader, BottomNav, EmptyDog, SectionTitle, StatusBadge } from "@/components/ui";
import { listMeetings, purgeExpiredAudio } from "@/lib/store";
import { slashDate } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/sections";
import type { Meeting, StepState } from "@/lib/types";
import { meetingText } from "@/lib/search";

export default function HomePage() {
  const [all, setAll] = useState<Meeting[] | null>(null);
  const [q, setQ] = useState("");
  const [client, setClient] = useState("");
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    purgeExpiredAudio().catch(() => {});
    listMeetings().then(setAll);
  }, []);

  const clients = useMemo(
    () => [...new Set((all ?? []).map((m) => m.clientName).filter(Boolean))].sort(),
    [all],
  );
  const months = useMemo(
    () => [...new Set((all ?? []).map((m) => m.heldOn.slice(0, 7)).filter(Boolean))].sort().reverse(),
    [all],
  );

  const filtered = useMemo(() => {
    const words = q.trim().split(/\s+/).filter(Boolean);
    return (all ?? []).filter(
      (m) =>
        (!client || m.clientName === client) &&
        (!month || m.heldOn.startsWith(month)) &&
        (!status || m.status === status) &&
        words.every((w) => meetingText(m).includes(w)),
    );
  }, [all, q, client, month, status]);

  const open = filtered.filter((m) => m.status !== "confirmed");
  const done = filtered.filter((m) => m.status === "confirmed");

  return (
    <div className="pb-28">
      <AppHeader title="会議一覧" />
      <main className="mx-auto max-w-3xl px-4 sm:px-6">
        <label className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] focus-within:border-brand">
          <Search size={22} className="text-ink-soft" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="利用者名・キーワードで検索"
            className="w-full bg-transparent text-[16px] outline-none placeholder:text-ink-faint"
          />
        </label>

        <div className="mt-3 grid grid-cols-[1fr_1fr_1.25fr] gap-2">
          <FilterSelect icon={<UserRound size={19} />} label="利用者" value={client} onChange={setClient}>
            {clients.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect icon={<CalendarDays size={19} />} label="日付" value={month} onChange={setMonth}>
            {months.map((m) => (
              <option key={m} value={m}>
                {m.replace("-", "年")}月
              </option>
            ))}
          </FilterSelect>
          <FilterSelect icon={<Tag size={19} />} label="ステータス" value={status} onChange={setStatus}>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </FilterSelect>
        </div>

        <Link href="/new" className="btn-primary mt-4 w-full rounded-2xl py-3.5 text-[17px]">
          <Plus size={22} strokeWidth={2.6} />
          新しい会議を登録
        </Link>

        {all === null ? (
          <div className="flex justify-center py-16 text-ink-soft">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <>
            <SectionTitle count={open.length}>未確定の会議</SectionTitle>
            {open.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line bg-white/60 px-4 py-6 text-center text-sm text-ink-soft">
                未確定の会議はありません
              </p>
            ) : (
              <div className="space-y-3">
                {open.map((m) => (
                  <OpenCard key={m.id} m={m} />
                ))}
              </div>
            )}

            <SectionTitle count={done.length}>最近の会議</SectionTitle>
            {done.length === 0 ? (
              <EmptyDog text="確定した議事録はまだありません" />
            ) : (
              <div className="space-y-2.5">
                {done.map((m) => (
                  <DoneRow key={m.id} m={m} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function FilterSelect({
  icon,
  label,
  value,
  onChange,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`relative flex h-12 items-center gap-1 rounded-xl border bg-white pl-2.5 pr-1.5 ${
        value ? "border-brand text-brand" : "border-line text-ink"
      }`}
    >
      <span className="shrink-0 text-ink-soft [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
        {value ? (label === "日付" ? value.replace("-", "/") : label === "ステータス" ? STATUS_LABEL[value] : value) : label}
      </span>
      <ChevronDown size={15} className="shrink-0 text-ink-soft" />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="">すべて</option>
        {children}
      </select>
    </label>
  );
}

function IconBubble() {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
      <CalendarDays size={21} />
    </span>
  );
}

function Step({ label, state, last }: { label: string; state: StepState; last?: boolean }) {
  const sub =
    state === "done" ? "完了" : state === "running" ? "処理中" : state === "error" ? "エラー" : state === "skipped" ? "—" : "待機中";
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      {state === "done" ? (
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-white">
          <Check size={14} strokeWidth={3} />
        </span>
      ) : state === "running" ? (
        <Loader2 size={24} className="shrink-0 animate-spin text-ai-ink" />
      ) : (
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
            last ? "bg-ai" : "bg-gray-100"
          }`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${last ? "bg-ai-ink/60" : "bg-gray-300"}`} />
        </span>
      )}
      <span className="min-w-0 leading-tight">
        <span className="block whitespace-nowrap text-[12.5px] font-bold">{label}</span>
        <span className="block text-[11px] text-ink-soft">{sub}</span>
      </span>
    </div>
  );
}

function OpenCard({ m }: { m: Meeting }) {
  const human: StepState = m.status === "processing" ? "pending" : "running";
  const humanSub = m.status === "reviewing" ? "確認中" : "進行中";
  return (
    <Link
      href={`/meetings/${m.id}`}
      className="block rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-brand/40"
    >
      <div className="flex items-start gap-3">
        <IconBubble />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 text-[17px] font-bold leading-snug">{m.title || "（会議名未設定）"}</h3>
            <StatusBadge status={m.status} />
          </div>
          <Meta m={m} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-0.5 rounded-xl bg-paper px-2.5 py-2.5">
        <Step label="文字起こし" state={m.progress.transcribe} />
        <ChevronRight size={14} className="shrink-0 text-ink-faint" />
        <Step label="項目整理" state={m.progress.classify} />
        <ChevronRight size={14} className="shrink-0 text-ink-faint" />
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ai">
            <span className="h-2.5 w-2.5 rounded-full bg-ai-ink/60" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block whitespace-nowrap text-[12.5px] font-bold">人の確認</span>
            <span className="block text-[11px] text-ink-soft">{human === "pending" ? "待機中" : humanSub}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function Meta({ m }: { m: Meeting }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-soft">
      <span className="inline-flex items-center gap-1">
        <CalendarDays size={15} />
        {slashDate(m.heldOn)}
      </span>
      <span className="inline-flex items-center gap-1">
        <UserRound size={15} />
        {m.clientName ? `${m.clientName} 様` : "利用者未設定"}
      </span>
      {m.round && (
        <span className="inline-flex items-center gap-1">
          <FileText size={15} />第{m.round}回
        </span>
      )}
      {m.sample && <span className="rounded bg-amber-50 px-1.5 text-[11px] font-bold text-amber-700">見本</span>}
    </div>
  );
}

function DoneRow({ m }: { m: Meeting }) {
  return (
    <Link
      href={`/meetings/${m.id}`}
      className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5 transition hover:border-brand/40"
    >
      <IconBubble />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[16px] font-bold">{m.title || "（会議名未設定）"}</h3>
        <Meta m={m} />
      </div>
      <StatusBadge status={m.status} />
      <ChevronRight size={20} className="shrink-0 text-ink-faint" />
    </Link>
  );
}
