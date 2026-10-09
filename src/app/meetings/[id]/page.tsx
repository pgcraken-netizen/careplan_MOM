"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  FileOutput,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Trash2,
  Unlock,
} from "lucide-react";
import { AppHeader, AiMark, StatusBadge } from "@/components/ui";
import { AutoTextarea, Field, IconBtn, Modal, RowsEditor } from "@/components/editor";
import { checkMeeting } from "@/lib/check";
import { clock, slashDate } from "@/lib/format";
import { ATTENDEE_CATEGORIES, SECTION_BY_KEY } from "@/lib/sections";
import { classifyMeeting, runPipeline } from "@/lib/pipeline";
import {
  deleteMeeting,
  getAudio,
  getMeeting,
  getSettings,
  listMeetings,
  newAttendee,
  nextRound,
  saveMeeting,
} from "@/lib/store";
import type { Attendee, BasicField, Meeting, Row, SectionKey } from "@/lib/types";

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [m, setM] = useState<Meeting | null | undefined>(undefined);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [places, setPlaces] = useState<string[]>([]);
  const [clients, setClients] = useState<string[]>([]);
  const [showCheck, setShowCheck] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [busy, setBusy] = useState("");
  const [saved, setSaved] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Meeting | null>(null);

  useEffect(() => {
    let url: string | null = null;
    getMeeting(id).then(async (x) => {
      setM(x ?? null);
      if (x?.hasAudio) {
        const blob = await getAudio(x.id);
        if (blob) {
          url = URL.createObjectURL(blob);
          setAudioUrl(url);
        }
      }
    });
    Promise.all([getSettings(), listMeetings()]).then(([s, all]) => {
      setPlaces(s.places);
      setClients([...new Set([...s.clients, ...all.map((x) => x.clientName).filter(Boolean)])].sort());
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  const flush = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (latest.current) await saveMeeting(latest.current);
    setSaved(true);
  }, []);

  useEffect(() => {
    const h = () => {
      if (latest.current && saveTimer.current) saveMeeting(latest.current);
    };
    window.addEventListener("pagehide", h);
    return () => {
      window.removeEventListener("pagehide", h);
      h();
    };
  }, []);

  const change = useCallback((patch: Partial<Meeting> | ((m: Meeting) => Partial<Meeting>)) => {
    setM((cur) => {
      if (!cur) return cur;
      const p = typeof patch === "function" ? patch(cur) : patch;
      const next: Meeting = { ...cur, ...p };
      if (next.status === "draft") next.status = "reviewing";
      latest.current = next;
      setSaved(false);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveMeeting(next).then(() => setSaved(true));
        saveTimer.current = null;
      }, 500);
      return next;
    });
  }, []);

  const problems = useMemo(() => (m ? checkMeeting(m) : []), [m]);
  const locked = m?.status === "confirmed";

  if (m === undefined)
    return (
      <div className="grid min-h-dvh place-items-center text-ink-soft">
        <Loader2 className="animate-spin" />
      </div>
    );
  if (m === null)
    return (
      <div className="p-10 text-center">
        <p>この会議は見つかりませんでした。</p>
        <Link href="/" className="mt-4 inline-block font-bold text-brand underline">
          会議一覧へ
        </Link>
      </div>
    );

  const play = (sec: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, sec - 2);
    a.play();
  };

  const confirmField = (f: BasicField) => change((c) => ({ aiFields: c.aiFields.filter((x) => x !== f) }));
  const setField = <K extends keyof Meeting>(f: K, v: Meeting[K], ai?: BasicField) =>
    change((c) => ({ [f]: v, aiFields: ai ? c.aiFields.filter((x) => x !== ai) : c.aiFields }) as Partial<Meeting>);
  const isAi = (f: BasicField) => !locked && m.aiFields.includes(f);

  const setRows = (k: SectionKey) => (rows: Row[]) => change({ [k]: rows } as Partial<Meeting>);
  const setAtt = (i: number, patch: Partial<Attendee>) =>
    change((c) => ({ attendees: c.attendees.map((a, j) => (j === i ? { ...a, ...patch, reviewed: true } : a)) }));

  async function doConfirm() {
    if (!m) return;
    const next: Meeting = {
      ...m,
      status: "confirmed",
      confirmedAt: new Date().toISOString(),
      aiFields: [],
      attendees: m.attendees.map((a) => ({ ...a, reviewed: true })),
      history: [...m.history, { at: new Date().toISOString(), action: "確定" }],
    };
    latest.current = next;
    setM(next);
    await flush();
    setShowCheck(false);
  }

  async function unlock() {
    if (!m) return;
    const next: Meeting = {
      ...m,
      status: "reviewing",
      history: [...m.history, { at: new Date().toISOString(), action: "確定を解除して修正" }],
    };
    latest.current = next;
    setM(next);
    await flush();
  }

  async function rerun() {
    if (!m) return;
    setBusy("AIで再整理しています（1〜2分）");
    try {
      await flush();
      if (m.transcript.length) await classifyMeeting(m.id, (msg) => setBusy(msg));
      else {
        const blob = await getAudio(m.id);
        if (!blob) throw new Error("音声が見つかりません");
        await runPipeline(m.id, blob, (msg) => setBusy(msg));
      }
      setM(await getMeeting(m.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "失敗しました");
      setM(await getMeeting(m.id));
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!m || !confirm("この会議と音声を削除します。元に戻せません。よろしいですか？")) return;
    await deleteMeeting(m.id);
    router.push("/");
  }

  const ro = locked;
  const unreviewed = problems.filter((p) => p.kind === "unreviewed").length;
  const missing = problems.filter((p) => p.kind === "missing").length;

  return (
    <div className="pb-36">
      <AppHeader
        title="議事録の編集"
        back={
          <Link href="/" aria-label="戻る" onClick={() => flush()} className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-white">
            <ArrowLeft />
          </Link>
        }
      />

      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />}

      <main className="mx-auto max-w-5xl space-y-4 px-4 pt-4 sm:px-6">
        {/* 状態 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-white px-4 py-3">
          <StatusBadge status={m.status} />
          <span className="text-sm text-ink-soft">
            {slashDate(m.heldOn)}　{m.clientName ? `${m.clientName} 様` : "利用者未設定"}
            {m.round ? `　第${m.round}回` : ""}
          </span>
          {m.sample && <span className="rounded bg-amber-50 px-1.5 text-[11px] font-bold text-amber-700">見本データ</span>}
          <span className="flex-1" />
          <span className="text-[12px] text-ink-faint">{saved ? "保存済み" : "保存中…"}</span>
          {!ro && (
            <button onClick={rerun} disabled={!!busy || (!m.transcript.length && !m.hasAudio)} className="btn-ghost px-3 py-1.5 text-[13px]">
              <RefreshCw size={15} />
              AIで再整理
            </button>
          )}
          <IconBtn label="削除" onClick={remove}>
            <Trash2 size={17} />
          </IconBtn>
        </div>

        {busy && (
          <div className="flex items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-sm font-bold text-brand">
            <Loader2 size={18} className="animate-spin" />
            {busy}
          </div>
        )}
        {m.progress.message && !busy && (
          <div className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>
              AI処理でエラーがありました：{m.progress.message}
              <br />
              「AIで再整理」でやり直せます。
            </span>
          </div>
        )}
        {ro && (
          <div className="flex items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-brand">
            <Lock size={18} />
            <span className="flex-1 font-bold">確定済みのため編集できません。</span>
            <button onClick={unlock} className="inline-flex items-center gap-1 font-bold underline">
              <Unlock size={15} />
              修正する（履歴に残ります）
            </button>
          </div>
        )}
        {!ro && unreviewed > 0 && (
          <div className="flex items-center gap-2 rounded-2xl bg-ai px-4 py-3 text-sm text-ai-ink">
            <AiMark />
            <span>
              紫の行・枠はAIが作成して未確認の箇所です（{unreviewed}か所）。根拠の発言を確かめて「確認した」を押してください。
            </span>
          </div>
        )}

        {/* 基本情報 */}
        <section id="basic" className="rounded-2xl border border-line bg-white p-4 sm:p-5">
          <h2 className="mb-4 flex items-center gap-2 font-round text-lg font-extrabold text-navy">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-navy text-[13px] text-white">1</span>
            基本情報・参加者
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="会議名称" required ai={isAi("title")} onConfirm={() => confirmField("title")} className="sm:col-span-2">
              <AutoTextarea value={m.title} readOnly={ro} onChange={(v) => setField("title", v, "title")} placeholder="例：要介護4認定後のケアプラン確認・在宅支援調整のための担当者会議" />
            </Field>
            <Field label="会議目的" ai={isAi("purpose")} onConfirm={() => confirmField("purpose")} className="sm:col-span-2">
              <AutoTextarea value={m.purpose} readOnly={ro} onChange={(v) => setField("purpose", v, "purpose")} />
            </Field>
            <Field
              label="開催日"
              required
              ai={isAi("heldOn")}
              onConfirm={() => confirmField("heldOn")}
              candidates={ro ? undefined : m.candidates.heldOn?.filter((c) => c !== m.heldOn)}
              onPick={(v) => setField("heldOn", v, "heldOn")}
            >
              <input type="date" className="field" readOnly={ro} value={m.heldOn} onChange={(e) => setField("heldOn", e.target.value, "heldOn")} />
            </Field>
            <Field label="開催時間" required ai={isAi("startTime")} onConfirm={() => change((c) => ({ aiFields: c.aiFields.filter((x) => x !== "startTime" && x !== "endTime") }))}>
              <div className="flex items-center gap-2">
                <input type="time" className="field" readOnly={ro} value={m.startTime} onChange={(e) => setField("startTime", e.target.value, "startTime")} />
                <span className="text-ink-soft">〜</span>
                <input type="time" className="field" readOnly={ro} value={m.endTime} onChange={(e) => setField("endTime", e.target.value, "endTime")} />
              </div>
            </Field>
            <Field
              label="開催場所"
              required
              ai={isAi("place")}
              onConfirm={() => confirmField("place")}
              candidates={ro ? undefined : (m.candidates.place ?? places).filter((c) => c !== m.place)}
              onPick={(v) => setField("place", v, "place")}
            >
              <input className="field" readOnly={ro} value={m.place} onChange={(e) => setField("place", e.target.value, "place")} />
            </Field>
            <Field label="開催回数" required ai={isAi("round")} onConfirm={() => confirmField("round")}>
              <div className="flex items-center gap-2">
                <span className="text-ink-soft">第</span>
                <input
                  type="number"
                  min={1}
                  className="field w-24"
                  readOnly={ro}
                  value={m.round ?? ""}
                  onChange={(e) => setField("round", e.target.value ? Number(e.target.value) : null, "round")}
                />
                <span className="text-ink-soft">回</span>
              </div>
            </Field>
            <Field
              label="利用者名"
              required
              ai={isAi("clientName")}
              onConfirm={() => confirmField("clientName")}
              candidates={ro ? undefined : m.candidates.clientName?.filter((c) => c !== m.clientName)}
              onPick={(v) => setField("clientName", v, "clientName")}
            >
              <input
                className="field"
                list="clients"
                readOnly={ro}
                value={m.clientName}
                onChange={(e) => setField("clientName", e.target.value, "clientName")}
                onBlur={async () => {
                  if (m.round == null && m.clientName) {
                    const all = await listMeetings();
                    setField("round", nextRound(all, m.clientName, m.heldOn, m.id));
                  }
                }}
              />
              <datalist id="clients">
                {clients.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="居宅サービス計画作成者" required>
              <input className="field" readOnly={ro} value={m.author} onChange={(e) => setField("author", e.target.value, "author")} placeholder="例：佐藤 △△（ケアマネジャー）" />
            </Field>
          </div>

          <div className="mt-5">
            <div className="mb-1.5 flex items-center gap-2 text-[13px] font-bold text-ink-soft">
              参加者<span className="text-[11px] text-red-500">必須</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="hidden grid-cols-[150px_1fr_1fr_40px] gap-2 bg-paper px-3 py-2 text-[12px] font-bold text-ink-soft sm:grid">
                <span>区分</span>
                <span>事業所・続柄等</span>
                <span>氏名</span>
                <span />
              </div>
              {m.attendees.map((a, i) => {
                const pending = !ro && a.origin === "ai" && !a.reviewed;
                return (
                  <div key={a.id} className={`grid grid-cols-2 gap-2 border-t border-line px-3 py-2 first:border-t-0 sm:grid-cols-[150px_1fr_1fr_40px] sm:first:border-t ${pending ? "bg-ai/50" : ""}`}>
                    <div className="flex items-center gap-1.5">
                      <input list="att-cats" className="field py-1.5 text-[14px]" readOnly={ro} value={a.category} onChange={(e) => setAtt(i, { category: e.target.value })} placeholder="区分" />
                      {pending && <AiMark small />}
                    </div>
                    <input className="field py-1.5 text-[14px]" readOnly={ro} value={a.org} onChange={(e) => setAtt(i, { org: e.target.value })} placeholder="事業所・続柄" />
                    <input className="field py-1.5 text-[14px]" readOnly={ro} value={a.name} onChange={(e) => setAtt(i, { name: e.target.value })} placeholder="氏名" />
                    {!ro && (
                      <div className="flex items-center justify-end text-ink-faint">
                        <IconBtn label="削除" onClick={() => change((c) => ({ attendees: c.attendees.filter((_, j) => j !== i) }))}>
                          <Trash2 size={16} />
                        </IconBtn>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <datalist id="att-cats">
              {ATTENDEE_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {!ro && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => change((c) => ({ attendees: [...c.attendees, newAttendee()] }))} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[14px] font-bold text-brand hover:bg-brand-soft">
                  <Plus size={17} />
                  参加者を追加
                </button>
                {m.attendees.some((a) => a.origin === "ai" && !a.reviewed) && (
                  <button onClick={() => change((c) => ({ attendees: c.attendees.map((a) => ({ ...a, reviewed: true })) }))} className="rounded-full bg-ai px-3 py-1 text-[12px] font-bold text-ai-ink">
                    参加者をすべて確認
                  </button>
                )}
              </div>
            )}
          </div>

          <Field label="欠席者と照会内容" ai={isAi("absentees")} onConfirm={() => confirmField("absentees")} className="mt-4">
            <AutoTextarea value={m.absentees} readOnly={ro} onChange={(v) => setField("absentees", v, "absentees")} placeholder="例：次男（仕事のため欠席）→ 今後のサービス利用意向を電話で確認" />
          </Field>
        </section>

        {/* 本文 */}
        <div className="flex items-center gap-2 pt-3">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-navy text-[13px] font-bold text-white">2</span>
          <h2 className="font-round text-lg font-extrabold text-navy">本文セクション</h2>
        </div>
        {(["summary", "topics", "discussions", "decisions", "issues"] as SectionKey[]).map((k) => (
          <div id={k} key={k}>
            <RowsEditor def={SECTION_BY_KEY[k]} rows={m[k]} onChange={setRows(k)} onPlay={play} canPlay={!!audioUrl} readOnly={ro} />
          </div>
        ))}

        <section id="next" className="rounded-2xl border border-line bg-white p-4">
          <h3 className="mb-3 flex items-center gap-2 font-round text-[17px] font-extrabold text-navy">
            <span className="grid h-7 min-w-7 place-items-center rounded-full bg-navy text-[13px] font-bold text-white">⑤</span>
            次回開催時期
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="予定時期" ai={isAi("nextTiming")} onConfirm={() => confirmField("nextTiming")}>
              <input className="field" readOnly={ro} value={m.nextTiming} onChange={(e) => setField("nextTiming", e.target.value, "nextTiming")} placeholder="例：2026年12月（第4回）" />
            </Field>
            <Field label="条件" ai={isAi("nextCondition")} onConfirm={() => confirmField("nextCondition")}>
              <input className="field" readOnly={ro} value={m.nextCondition} onChange={(e) => setField("nextCondition", e.target.value, "nextCondition")} placeholder="例：状態変化時は随時開催" />
            </Field>
          </div>
        </section>

        <div className="flex items-center gap-2 pt-3">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-navy text-[13px] font-bold text-white">3</span>
          <h2 className="font-round text-lg font-extrabold text-navy">付帯情報</h2>
        </div>
        <div id="carryover">
          <RowsEditor def={SECTION_BY_KEY.carryover} rows={m.carryover} onChange={setRows("carryover")} onPlay={play} canPlay={!!audioUrl} readOnly={ro} />
        </div>
        <section className="rounded-2xl border border-line bg-white p-4">
          <h3 className="mb-2 font-round text-[17px] font-extrabold text-navy">備考</h3>
          <AutoTextarea value={m.notes} readOnly={ro} minRows={2} onChange={(v) => setField("notes", v)} placeholder="例：本議事録は録音データからAIが下書きを作成し、担当者が確認・編集のうえ確定しています。" />
        </section>

        {/* 文字起こし */}
        {m.transcript.length > 0 && (
          <section className="rounded-2xl border border-line bg-white">
            <button onClick={() => setShowTranscript((s) => !s)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
              <h3 className="flex-1 font-round text-[17px] font-extrabold text-navy">文字起こし（{m.transcript.length}発言）</h3>
              <ChevronDown className={`transition ${showTranscript ? "rotate-180" : ""}`} />
            </button>
            {showTranscript && (
              <ul className="max-h-[60vh] space-y-1 overflow-auto border-t border-line px-4 py-3 text-[14px]">
                {m.transcript.map((s) => (
                  <li key={s.id} className="flex gap-3">
                    <button disabled={!audioUrl} onClick={() => play(s.start)} className="h-fit shrink-0 rounded bg-paper px-1.5 py-0.5 font-mono text-[11px] text-ink-soft hover:text-brand disabled:hover:text-ink-soft">
                      {clock(s.start)}
                    </button>
                    <span className="leading-relaxed">{s.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-line bg-white p-4 text-[13px] text-ink-soft">
          <h3 className="mb-2 font-bold text-ink">履歴</h3>
          <ul className="space-y-1">
            {m.history.map((h, i) => (
              <li key={i}>
                {new Date(h.at).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}　{h.action}
              </li>
            ))}
          </ul>
        </section>
      </main>

      {/* 下部の操作バー */}
      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 sm:px-6">
          {!ro && (
            <button onClick={() => setShowCheck(true)} className="hidden text-left text-[13px] leading-tight sm:block">
              <span className={missing ? "font-bold text-red-600" : "text-green-700"}>未入力 {missing}</span>
              <span className="mx-2 text-line">|</span>
              <span className={unreviewed ? "font-bold text-ai-ink" : "text-green-700"}>未確認 {unreviewed}</span>
            </button>
          )}
          <span className="flex-1" />
          <Link href={`/meetings/${m.id}/print`} onClick={() => flush()} className="btn-ghost">
            <FileOutput size={18} />
            出力・印刷
          </Link>
          {!ro && (
            <button onClick={() => setShowCheck(true)} className="btn-primary">
              <CheckCircle2 size={18} />
              確定前チェック
            </button>
          )}
        </div>
      </div>

      {showCheck && (
        <Modal title="確定前チェック" onClose={() => setShowCheck(false)}>
          {problems.length === 0 ? (
            <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-bold text-green-700">第4表の必須項目はすべて入力・確認済みです。</p>
          ) : (
            <ul className="space-y-1.5">
              {problems.map((p, i) => (
                <li key={i}>
                  <a
                    href={`#${p.anchor}`}
                    onClick={() => setShowCheck(false)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:brightness-95 ${
                      p.kind === "missing" ? "bg-red-50 text-red-700" : "bg-ai text-ai-ink"
                    }`}
                  >
                    {p.kind === "missing" ? <AlertTriangle size={15} /> : <AiMark small />}
                    {p.message}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setShowCheck(false)}>
              戻って直す
            </button>
            <button
              className="btn-primary flex-1"
              onClick={() => {
                if (problems.length && !confirm("未入力・未確認の項目が残っています。このまま確定しますか？")) return;
                doConfirm();
              }}
            >
              <Lock size={16} />
              確定する
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
