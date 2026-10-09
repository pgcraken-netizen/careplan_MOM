"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, UserRound } from "lucide-react";
import { AppHeader, BottomNav, Chip, EmptyDog, SectionTitle, StatusBadge } from "@/components/ui";
import { getSettings, listMeetings } from "@/lib/store";
import { slashDate } from "@/lib/format";
import type { Meeting } from "@/lib/types";

export default function ClientsPage() {
  const [all, setAll] = useState<Meeting[]>([]);
  const [master, setMaster] = useState<string[]>([]);
  const [sel, setSel] = useState("");

  useEffect(() => {
    listMeetings().then(setAll);
    getSettings().then((s) => setMaster(s.clients));
  }, []);

  const clients = useMemo(() => {
    const names = [...new Set([...master, ...all.map((m) => m.clientName).filter(Boolean)])];
    return names
      .map((name) => {
        const ms = all.filter((m) => m.clientName === name).sort((a, b) => b.heldOn.localeCompare(a.heldOn));
        const latest = ms[0];
        const open = latest ? latest.issues.filter((r) => r.label === "宿題" || r.label === "モニタリング点") : [];
        return { name, ms, latest, open };
      })
      .sort((a, b) => (b.latest?.heldOn ?? "").localeCompare(a.latest?.heldOn ?? ""));
  }, [all, master]);

  const current = clients.find((c) => c.name === sel);

  return (
    <div className="pb-28">
      <AppHeader title="利用者" />
      <main className="mx-auto max-w-3xl px-4 sm:px-6">
        {!current ? (
          <>
            <SectionTitle count={clients.length}>利用者一覧</SectionTitle>
            {clients.length === 0 && <EmptyDog text="まだ利用者がいません。会議を登録すると自動で追加されます。" />}
            <div className="space-y-2.5">
              {clients.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setSel(c.name)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-4 text-left hover:border-brand/40"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                    <UserRound size={21} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold">{c.name} 様</span>
                    <span className="block text-[13px] text-ink-soft">
                      会議 {c.ms.length}件{c.latest && `　最終 ${slashDate(c.latest.heldOn)}`}
                    </span>
                  </span>
                  {c.open.length > 0 && <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-[12px] font-bold text-green-700">宿題等 {c.open.length}</span>}
                  <ChevronRight size={20} className="text-ink-faint" />
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button onClick={() => setSel("")} className="mt-5 text-sm font-bold text-brand">
              ← 利用者一覧
            </button>
            <h2 className="mt-2 font-round text-2xl font-extrabold text-navy">{current.name} 様</h2>

            <SectionTitle count={current.open.length}>前回からの宿題・モニタリング点</SectionTitle>
            {current.open.length === 0 ? (
              <p className="text-sm text-ink-soft">ありません</p>
            ) : (
              <ul className="space-y-2 rounded-2xl border border-line bg-white p-4">
                {current.open.map((r) => (
                  <li key={r.id} className="flex items-start gap-2 text-[15px]">
                    <Chip label={r.label} />
                    <span>{r.body}</span>
                  </li>
                ))}
              </ul>
            )}

            <SectionTitle count={current.ms.length}>会議のタイムライン</SectionTitle>
            <ol className="relative ml-3 space-y-4 border-l-2 border-line pl-5">
              {current.ms.map((m) => (
                <li key={m.id} className="relative">
                  <span className="absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-white bg-brand ring-2 ring-brand/30" />
                  <Link href={`/meetings/${m.id}`} className="block rounded-2xl border border-line bg-white p-4 hover:border-brand/40">
                    <div className="flex items-start gap-2">
                      <span className="flex-1 text-[13px] text-ink-soft">
                        {slashDate(m.heldOn)}
                        {m.round && `　第${m.round}回`}
                      </span>
                      <StatusBadge status={m.status} />
                    </div>
                    <p className="mt-1 font-bold">{m.title || "（会議名未設定）"}</p>
                    {m.decisions.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-[13px] text-ink-soft">
                        {m.decisions.slice(0, 3).map((r) => (
                          <li key={r.id}>・{r.body}</li>
                        ))}
                      </ul>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
