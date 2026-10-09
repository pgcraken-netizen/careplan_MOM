"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, FileAudio, Loader2, Mic, PenLine, Sparkles, Square, Upload } from "lucide-react";
import { AppHeader } from "@/components/ui";
import { emptyMeeting, getSettings, listMeetings, nextRound, saveAudio, saveMeeting, uid } from "@/lib/store";
import { runPipeline } from "@/lib/pipeline";
import { sampleMeetings } from "@/lib/sample";
import type { AiStatus, Meeting } from "@/lib/types";

const pad = (n: number) => String(n).padStart(2, "0");

export default function NewMeetingPage() {
  const router = useRouter();
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [clients, setClients] = useState<string[]>([]);
  const [client, setClient] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<{ msg: string; percent: number } | null>(null);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const partsRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setAi)
      .catch(() => setAi({ transcribe: false, classify: false }));
    Promise.all([listMeetings(), getSettings()]).then(([all, s]) =>
      setClients([...new Set([...s.clients, ...all.map((m) => m.clientName).filter(Boolean)])].sort()),
    );
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const aiReady = Boolean(ai?.transcribe && ai?.classify);

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      partsRef.current = [];
      rec.ondataavailable = (e) => e.data.size && partsRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = rec.mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : "webm";
        const now = new Date();
        setFile(
          new File(partsRef.current, `録音_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.${ext}`, {
            type,
            lastModified: now.getTime(),
          }),
        );
      };
      rec.start(1000);
      recRef.current = rec;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setError("マイクを使えませんでした。ブラウザの設定でマイクを許可してください。");
    }
  }

  function stopRecording() {
    recRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function baseMeeting(): Promise<Meeting> {
    const [all, s] = await Promise.all([listMeetings(), getSettings()]);
    const d = file ? new Date(file.lastModified) : new Date();
    const heldOn = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return emptyMeeting({
      heldOn,
      endTime: file ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "",
      clientName: client.trim(),
      round: client.trim() ? nextRound(all, client.trim(), heldOn) : null,
      author: s.author,
      attendees: emptyMeeting().attendees.map((a) =>
        a.category === "居宅介護支援" ? { ...a, org: s.officeName, name: s.author } : a.category === "本人" ? { ...a, name: client.trim() } : a,
      ),
      aiFields: file ? ["heldOn"] : [],
    });
  }

  async function startAi() {
    if (!file) return;
    setError("");
    const m = await baseMeeting();
    m.status = "processing";
    m.progress = { transcribe: "pending", classify: "pending" };
    m.hasAudio = true;
    m.audioName = file.name;
    await saveMeeting(m);
    await saveAudio(m.id, file);

    let lock: { release: () => Promise<void> } | null = null;
    try {
      lock = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null;
    } catch {}
    setBusy({ msg: "準備しています", percent: 1 });
    try {
      await runPipeline(m.id, file, (msg, percent) => setBusy((b) => ({ msg, percent: percent ?? b?.percent ?? 0 })));
      router.push(`/meetings/${m.id}`);
    } catch (e) {
      setBusy(null);
      setError(
        `${e instanceof Error ? e.message : "処理に失敗しました"}。会議は一覧に保存されているので、編集画面から再実行できます。`,
      );
    } finally {
      lock?.release().catch(() => {});
    }
  }

  async function startManual() {
    const m = await baseMeeting();
    if (file) {
      m.hasAudio = true;
      m.audioName = file.name;
    }
    await saveMeeting(m);
    if (file) await saveAudio(m.id, file);
    router.push(`/meetings/${m.id}`);
  }

  async function startDemo() {
    const d = sampleMeetings().find((x) => x.id === "sample-draft")!;
    const m = await baseMeeting();
    const remap = <T extends { id: string }>(rows: T[]) => rows.map((r) => ({ ...r, id: uid() }));
    const demo: Meeting = {
      ...m,
      title: d.title,
      purpose: d.purpose,
      place: d.place,
      clientName: m.clientName || d.clientName,
      round: m.round ?? 1,
      startTime: d.startTime,
      endTime: d.endTime,
      attendees: remap(d.attendees),
      aiFields: d.aiFields,
      candidates: d.candidates,
      summary: remap(d.summary),
      topics: remap(d.topics),
      discussions: remap(d.discussions),
      decisions: remap(d.decisions),
      issues: remap(d.issues),
      transcript: d.transcript,
      status: "draft",
      progress: { transcribe: "done", classify: "done" },
      history: [{ at: new Date().toISOString(), action: "見本の文字起こしからAI下書きを作成（デモ）" }],
    };
    await saveMeeting(demo);
    router.push(`/meetings/${demo.id}`);
  }

  if (busy) {
    return (
      <div className="min-h-dvh">
        <AppHeader title="AIで整理中" />
        <main className="mx-auto flex max-w-md flex-col items-center px-6 pt-16 text-center">
          <Loader2 size={44} className="animate-spin text-brand" />
          <p className="mt-6 text-lg font-bold">{busy.msg}</p>
          <div className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${busy.percent}%` }} />
          </div>
          <p className="mt-6 text-sm leading-relaxed text-ink-soft">
            処理はこの端末で進めています。
            <br />
            完了するまでこの画面を開いたままにしてください。
            <br />
            60分の会議で数分かかります。
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-16">
      <AppHeader
        title="新しい会議を登録"
        back={
          <Link href="/" aria-label="戻る" className="-ml-2 grid h-10 w-10 place-items-center rounded-full hover:bg-white">
            <ArrowLeft />
          </Link>
        }
      />
      <main className="mx-auto max-w-xl space-y-5 px-4 pt-5 sm:px-6">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-round text-lg font-extrabold text-navy">1. 会議の録音</h2>
          <p className="mt-1 text-sm text-ink-soft">ボイスメモの書き出しファイル（m4a・mp3・wav）か、この場で録音します。</p>

          <input
            ref={fileInput}
            type="file"
            accept="audio/*,.m4a,.mp3,.wav,.aac,.webm"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button className="btn-ghost h-24 flex-col rounded-2xl" onClick={() => fileInput.current?.click()} disabled={recording}>
              <Upload size={24} className="text-brand" />
              ファイルを選ぶ
            </button>
            {recording ? (
              <button className="btn h-24 flex-col rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-200" onClick={stopRecording}>
                <Square size={22} fill="currentColor" />
                録音を止める {Math.floor(elapsed / 60)}:{pad(elapsed % 60)}
              </button>
            ) : (
              <button className="btn-ghost h-24 flex-col rounded-2xl" onClick={startRecording}>
                <Mic size={24} className="text-brand" />
                この場で録音
              </button>
            )}
          </div>
          {file && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-sm">
              <FileAudio size={18} className="shrink-0 text-brand" />
              <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
              <span className="shrink-0 text-ink-soft">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-round text-lg font-extrabold text-navy">2. 利用者（わかれば）</h2>
          <p className="mt-1 text-sm text-ink-soft">空欄でもAIが発言から候補を出します。</p>
          <input
            className="field mt-3"
            list="client-list"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="例：山田 太郎"
          />
          <datalist id="client-list">
            {clients.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </section>

        <label className="flex items-start gap-3 rounded-2xl border border-line bg-white p-5">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-brand" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span className="text-[15px] leading-relaxed">
            <b>参加者全員から録音の了承を得ています</b>
            <span className="mt-1 block text-sm text-ink-soft">
              音声はこの端末にだけ保存します。文字起こしと項目整理のため、音声と文字をAIのAPIへ送信します（APIへの入力はAIの学習には使われません）。
            </span>
          </span>
        </label>

        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <div className="space-y-3">
          <button className="btn-primary w-full rounded-2xl py-4 text-[17px]" disabled={!file || !consent || !aiReady || recording} onClick={startAi}>
            <Sparkles size={20} />
            AIで議事録の下書きを作る
          </button>
          {ai && !aiReady && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
              AIの接続設定（APIキー）がまだ無いため、AI処理は使えません。
              <button className="mt-2 block font-bold text-brand underline" onClick={startDemo}>
                見本の文字起こしでAI下書きの流れを試す
              </button>
            </div>
          )}
          <button className="btn-ghost w-full rounded-2xl py-3.5" onClick={startManual} disabled={recording}>
            <PenLine size={18} />
            手入力で議事録を作る
          </button>
        </div>
      </main>
    </div>
  );
}
