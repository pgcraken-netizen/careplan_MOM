"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, FileSpreadsheet, FileText, FileType2, Loader2, Printer } from "lucide-react";
import { MinutesSheet } from "@/components/sheet";
import { getMeeting } from "@/lib/store";
import { safeFileName } from "@/lib/format";
import type { Meeting } from "@/lib/types";

type Kind = "pdf" | "docx" | "xlsx";

export default function PrintPage() {
  const { id } = useParams<{ id: string }>();
  const [m, setM] = useState<Meeting | null | undefined>(undefined);
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [view, setView] = useState(1);
  const sheet = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getMeeting(id).then((x) => setM(x ?? null));
  }, [id]);

  // 画面幅に合わせてプレビューを縮小（印刷時は等倍）
  useEffect(() => {
    const fit = () => {
      const w = wrap.current?.clientWidth ?? window.innerWidth;
      setView(Math.min(1, (w - 16) / 794));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [m]);

  const onScale = useCallback((s: number) => setScale(s), []);

  async function run(kind: Kind) {
    if (!m) return;
    setBusy(kind);
    try {
      const name = safeFileName(m);
      if (kind === "pdf" && sheet.current) {
        const { exportPdf } = await import("@/lib/export/pdf");
        await exportPdf(sheet.current, name);
      } else if (kind === "docx") {
        const { exportDocx } = await import("@/lib/export/docx");
        await exportDocx(m, name, Math.min(1, scale));
      } else if (kind === "xlsx") {
        const { exportXlsx } = await import("@/lib/export/xlsx");
        await exportXlsx(m, name);
      }
    } catch (e) {
      console.error(e);
      alert(`出力に失敗しました：${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
  }

  if (m === undefined)
    return (
      <div className="grid min-h-dvh place-items-center text-ink-soft">
        <Loader2 className="animate-spin" />
      </div>
    );
  if (m === null) return <p className="p-10 text-center">この会議は見つかりませんでした。</p>;

  return (
    <div className="print-root min-h-dvh bg-[#e9edf3] pb-10">
      <div className="no-print sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          <Link href={`/meetings/${m.id}`} aria-label="戻る" className="-ml-2 grid h-10 w-10 place-items-center rounded-full hover:bg-paper">
            <ArrowLeft />
          </Link>
          <h1 className="font-round text-[19px] font-extrabold text-navy">出力プレビュー</h1>
          <span className="flex-1" />
          <div className="flex w-full gap-2 sm:w-auto">
            <ExportBtn onClick={() => window.print()} icon={<Printer size={17} />} label="印刷" />
            <ExportBtn onClick={() => run("pdf")} busy={busy === "pdf"} icon={<FileType2 size={17} />} label="PDF" tone="text-[#C2462B]" />
            <ExportBtn onClick={() => run("docx")} busy={busy === "docx"} icon={<FileText size={17} />} label="Word" tone="text-[#2B5797]" />
            <ExportBtn onClick={() => run("xlsx")} busy={busy === "xlsx"} icon={<FileSpreadsheet size={17} />} label="Excel" tone="text-[#1E7145]" />
          </div>
        </div>
        <p className="mx-auto max-w-5xl px-4 pb-2 text-[12px] text-ink-soft sm:px-6">
          A4縦1枚に収まるよう調整しています
          {scale < 0.999 && `（内容が多いため ${Math.round(scale * 100)}% に縮小）`}。
          {m.status !== "confirmed" && <b className="ml-1 text-[#C2462B]">未確定のため「未確定」と印字されます。</b>}
        </p>
      </div>

      <div ref={wrap} className="mx-auto max-w-5xl px-2 pt-4 print:p-0">
        <div
          className="mx-auto origin-top print:!h-auto print:!w-auto print:![transform:none]"
          style={{ width: 794 * view, height: 1123 * view }}
        >
          <div className="origin-top-left print:![transform:none]" style={{ transform: `scale(${view})`, width: 794 }}>
            <MinutesSheet ref={sheet} m={m} onScale={onScale} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ExportBtn({
  onClick,
  icon,
  label,
  busy,
  tone = "text-ink",
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  busy?: boolean;
  tone?: string;
}) {
  return (
    <button onClick={onClick} disabled={busy} className={`btn-ghost flex-1 px-3 sm:flex-none ${tone}`}>
      {busy ? <Loader2 size={17} className="animate-spin" /> : icon}
      <span className="text-ink">{label}</span>
    </button>
  );
}
