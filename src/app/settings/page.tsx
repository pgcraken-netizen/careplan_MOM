"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Upload, XCircle } from "lucide-react";
import { AppHeader, BottomNav, SectionTitle } from "@/components/ui";
import { getSettings, listMeetings, saveMeeting, saveSettings } from "@/lib/store";
import { download } from "@/lib/export/common";
import type { AiStatus, Meeting, Settings } from "@/lib/types";

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then(setS);
    fetch("/api/status")
      .then((r) => r.json())
      .then(setAi)
      .catch(() => setAi({ transcribe: false, classify: false }));
  }, []);

  if (!s) return null;
  const up = (patch: Partial<Settings>) => {
    setS({ ...s, ...patch });
    setSaved(false);
  };

  async function exportAll() {
    const all = await listMeetings();
    download(new Blob([JSON.stringify({ version: 1, settings: s, meetings: all }, null, 2)], { type: "application/json" }), `議事録バックアップ_${new Date().toISOString().slice(0, 10)}.json`);
  }

  async function importAll(file: File) {
    const data = JSON.parse(await file.text()) as { meetings?: Meeting[]; settings?: Settings };
    for (const m of data.meetings ?? []) await saveMeeting(m);
    if (data.settings) await saveSettings(data.settings);
    alert(`${data.meetings?.length ?? 0}件の会議を読み込みました`);
    location.reload();
  }

  return (
    <div className="pb-28">
      <AppHeader title="設定" />
      <main className="mx-auto max-w-2xl space-y-1 px-4 sm:px-6">
        <SectionTitle>事業所・作成者</SectionTitle>
        <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
          <label className="block">
            <span className="mb-1 block text-[13px] font-bold text-ink-soft">事業所名</span>
            <input className="field" value={s.officeName} onChange={(e) => up({ officeName: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-bold text-ink-soft">作成者（居宅サービス計画作成者の初期値）</span>
            <input className="field" value={s.author} onChange={(e) => up({ author: e.target.value })} placeholder="例：佐藤 △△（ケアマネジャー）" />
          </label>
        </div>

        <SectionTitle>マスタ</SectionTitle>
        <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
          <label className="block">
            <span className="mb-1 block text-[13px] font-bold text-ink-soft">利用者（1行に1人）</span>
            <textarea className="field" rows={4} value={s.clients.join("\n")} onChange={(e) => up({ clients: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-bold text-ink-soft">よく使う会議場所（1行に1つ）</span>
            <textarea className="field" rows={4} value={s.places.join("\n")} onChange={(e) => up({ places: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-bold text-ink-soft">固有名詞辞書（事業所名・担当者名など。文字起こしの誤変換を防ぎます）</span>
            <textarea className="field" rows={5} value={s.glossary} onChange={(e) => up({ glossary: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-bold text-ink-soft">音声の保持日数（確定後この日数で端末から削除）</span>
            <input type="number" min={1} className="field w-32" value={s.audioRetentionDays} onChange={(e) => up({ audioRetentionDays: Number(e.target.value) || 30 })} />
          </label>
        </div>

        <div className="pt-4">
          <button
            className="btn-primary w-full rounded-2xl py-3.5"
            onClick={async () => {
              await saveSettings(s);
              setSaved(true);
            }}
          >
            {saved ? "保存しました" : "設定を保存"}
          </button>
        </div>

        <SectionTitle>AIの接続状況</SectionTitle>
        <div className="space-y-2 rounded-2xl border border-line bg-white p-5 text-[15px]">
          <Status ok={ai?.transcribe} label="文字起こし（OPENAI_API_KEY）" />
          <Status ok={ai?.classify} label="項目整理（ANTHROPIC_API_KEY）" />
          <p className="pt-1 text-[12px] leading-relaxed text-ink-soft">
            APIキーは Vercel のプロジェクト設定「Environment Variables」に登録します。キーはサーバー側だけで使われ、画面には表示されません。
          </p>
        </div>

        <SectionTitle>データ</SectionTitle>
        <div className="space-y-3 rounded-2xl border border-line bg-white p-5">
          <p className="text-[13px] leading-relaxed text-ink-soft">
            議事録と音声はこの端末のブラウザ内に保存されています。別の端末へ移すときや機種変更の前に、バックアップを書き出してください。
          </p>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={exportAll}>
              <Download size={17} />
              バックアップを書き出す
            </button>
            <label className="btn-ghost flex-1 cursor-pointer">
              <Upload size={17} />
              読み込む
              <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importAll(e.target.files[0])} />
            </label>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

function Status({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle2 size={19} className="text-green-600" /> : <XCircle size={19} className="text-ink-faint" />}
      <span className="flex-1">{label}</span>
      <span className={`text-[13px] font-bold ${ok ? "text-green-700" : "text-ink-faint"}`}>{ok ? "接続済み" : "未設定"}</span>
    </div>
  );
}
