"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppHeader, BottomNav, EmptyDog } from "@/components/ui";
import { listMeetings } from "@/lib/store";
import { searchMeetings } from "@/lib/search";
import { slashDate } from "@/lib/format";
import type { Meeting } from "@/lib/types";

export default function SearchPage() {
  const [all, setAll] = useState<Meeting[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    listMeetings().then(setAll);
  }, []);
  const hits = useMemo(() => searchMeetings(all, q).slice(0, 200), [all, q]);

  const mark = (text: string) => {
    if (!q) return text;
    const parts = text.split(q);
    return parts.flatMap((p, i) => (i ? [<mark key={i} className="rounded bg-amber-100 px-0.5">{q}</mark>, p] : [p]));
  };

  return (
    <div className="pb-28">
      <AppHeader title="検索" />
      <main className="mx-auto max-w-3xl px-4 sm:px-6">
        <label className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 focus-within:border-brand">
          <Search size={22} className="text-ink-soft" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="議事録と文字起こしを横断して検索"
            className="w-full bg-transparent text-[16px] outline-none"
          />
        </label>
        <p className="mt-2 text-[12px] text-ink-soft">例：転倒、手すり、入浴、服薬、利用者名</p>
        {q && hits.length === 0 && <EmptyDog text="見つかりませんでした" />}
        <ul className="mt-4 space-y-2.5">
          {hits.map((h, i) => (
            <li key={i}>
              <Link href={`/meetings/${h.meeting.id}`} className="block rounded-2xl border border-line bg-white p-4 hover:border-brand/40">
                <div className="flex flex-wrap items-center gap-x-3 text-[12px] text-ink-soft">
                  <span>{slashDate(h.meeting.heldOn)}</span>
                  <span>{h.meeting.clientName ? `${h.meeting.clientName} 様` : ""}</span>
                  <span className="rounded bg-paper px-1.5 font-bold">{h.where}</span>
                </div>
                <p className="mt-1 text-[15px] leading-relaxed">{mark(h.snippet)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <BottomNav />
    </div>
  );
}
