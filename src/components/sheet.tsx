"use client";

import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import { jpDate, slashDate, timeRange, clock } from "@/lib/format";
import { toneFor } from "@/lib/sections";
import type { Meeting, Row } from "@/lib/types";

/*
 * A4 1枚の議事録。210mm × 297mm の紙に収まるよう、
 * 内容が多いときは自動で縮小する（下限 60%）。
 */

const PAGE_W = 793.7; // px (210mm @96dpi)
const PAGE_H = 1122.5; // px (297mm)
const PAD_X = 34; // ≒9mm
const PAD_Y = 30; // ≒8mm
const FOOTER = 26;
const MAX_UP = 1.1; // 内容が少ないときは少し拡大して紙面を使う

const NAVY = "#1f3a68";
const BRAND = "#3a62b4";
const LINE = "#d9e1ee";
const HEAD = "#eef3fb";

function ChipS({ label, w }: { label: string; w?: number }) {
  const t = toneFor(label);
  return (
    <span
      style={{ background: t.bg, color: t.fg, minWidth: w }}
      className="inline-block rounded-[5px] px-[6px] py-[1px] text-[9.5px] font-bold leading-[15px]"
    >
      {label}
    </span>
  );
}

function H1({ no, children }: { no: string; children: React.ReactNode }) {
  return (
    <div className="mb-[5px] mt-[9px] flex items-center gap-[7px]">
      <span
        style={{ background: NAVY }}
        className="grid h-[19px] w-[19px] place-items-center rounded-[4px] text-[11px] font-bold text-white"
      >
        {no}
      </span>
      <span style={{ color: NAVY }} className="font-round text-[14px] font-extrabold tracking-wide">
        {children}
      </span>
    </div>
  );
}

function H2({ no, children }: { no: string; children: React.ReactNode }) {
  return (
    <div className="mb-[4px] flex items-center gap-[5px]">
      <span
        style={{ background: BRAND }}
        className="grid h-[16px] min-w-[16px] place-items-center rounded-full px-[3px] text-[9px] font-bold text-white"
      >
        {no}
      </span>
      <span style={{ color: NAVY }} className="text-[11.5px] font-bold">
        {children}
      </span>
    </div>
  );
}

const box = "rounded-[6px] border bg-white";

function RowTable({
  rows,
  labelHeader,
  bodyHeader,
  labelW = 92,
  quote = false,
}: {
  rows: Row[];
  labelHeader: string;
  bodyHeader: string;
  labelW?: number;
  quote?: boolean;
}) {
  return (
    <table className="w-full border-collapse text-[10px] leading-[1.45]">
      <thead>
        <tr style={{ background: HEAD, color: "#4a5875" }}>
          <th style={{ width: labelW, borderColor: LINE }} className="border-b px-[5px] py-[2px] text-left text-[9px] font-bold">
            {labelHeader}
          </th>
          <th style={{ borderColor: LINE }} className="border-b px-[5px] py-[2px] text-left text-[9px] font-bold">
            {bodyHeader}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={2} className="px-[5px] py-[4px] text-[#8a93a6]">
              記載なし
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.id} style={{ borderColor: LINE }} className="border-b last:border-b-0">
            <td className="px-[4px] py-[3px] align-top">
              <ChipS label={r.label || "—"} w={labelW - 12} />
            </td>
            <td className="whitespace-pre-wrap px-[5px] py-[3px] align-top">
              {quote || r.body.startsWith("「") ? r.body : `・${r.body}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const MinutesSheet = forwardRef<HTMLDivElement, { m: Meeting; outputDate?: string; onScale?: (s: number) => void }>(
  function MinutesSheet({ m, outputDate, onScale }, ref) {
    const inner = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useLayoutEffect(() => {
      const el = inner.current;
      if (!el) return;
      const fit = () => {
        const avail = PAGE_H - PAD_Y * 2 - FOOTER;
        el.style.transform = "none";
        el.style.width = `${PAGE_W - PAD_X * 2}px`;
        const h = el.scrollHeight;
        let s = Math.min(MAX_UP, avail / h);
        // 縮めると幅が広がり行数が減るので、2回で収束させる
        for (let i = 0; i < 3 && s !== 1; i++) {
          el.style.width = `${(PAGE_W - PAD_X * 2) / s}px`;
          const h2 = el.scrollHeight;
          s = Math.min(MAX_UP, avail / h2);
        }
        s = Math.max(0.6, Math.floor(s * 1000) / 1000);
        el.style.width = `${(PAGE_W - PAD_X * 2) / s}px`;
        // 最終確認：はみ出すなら縮める
        for (let i = 0; i < 4 && el.scrollHeight * s > avail && s > 0.6; i++) {
          s = Math.max(0.6, Math.floor((avail / el.scrollHeight) * 1000) / 1000 - 0.002);
          el.style.width = `${(PAGE_W - PAD_X * 2) / s}px`;
        }
        el.style.transform = `scale(${s})`;
        setScale(s);
        onScale?.(s);
      };
      fit();
      document.fonts?.ready.then(fit);
    }, [m, onScale]);

    const sumGroups = (["決定", "注意", "宿題"] as const).map((k) => ({
      k,
      rows: m.summary.filter((r) => r.label === k),
    }));
    const otherSummary = m.summary.filter((r) => !["決定", "注意", "宿題"].includes(r.label));
    const quotes = [...m.discussions, ...m.issues, ...m.decisions]
      .flatMap((r) => r.evidence.map((e) => ({ e, who: r.label })))
      .filter((x, i, a) => a.findIndex((y) => y.e.segmentId === x.e.segmentId) === i)
      .slice(0, 2);
    const today = outputDate ?? new Date().toISOString().slice(0, 10);

    return (
      <div
        ref={ref}
        className="a4-sheet relative overflow-hidden bg-white text-[#1f2a44] shadow-[0_2px_24px_rgba(16,24,40,0.12)]"
        style={{ width: "210mm", height: "297mm", padding: `${PAD_Y}px ${PAD_X}px`, fontFeatureSettings: '"palt" 1' }}
        data-scale={scale}
      >
        <div ref={inner} style={{ transformOrigin: "top left" }}>
          {/* ヘッダー */}
          <div className="flex items-start gap-[14px] border-b-[2px] pb-[9px]" style={{ borderColor: "#c9d6ec" }}>
            <div className="w-[180px] shrink-0">
              <div style={{ color: BRAND }} className="flex items-center gap-[5px] text-[12px] font-bold">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <path d="M8 3v18M12 8h5M12 12h5M12 16h5" />
                </svg>
                サービス担当者会議
              </div>
              <div style={{ color: NAVY }} className="mt-[2px] font-round text-[30px] font-extrabold leading-[1.15] tracking-[0.08em]">
                議事録
              </div>
              <div className="mt-[3px] text-[11px] font-medium">
                {jpDate(m.heldOn)}
                {m.round ? `　第${m.round}回` : ""}
              </div>
            </div>
            <div className="min-w-0 flex-1 border-l pl-[12px]" style={{ borderColor: LINE }}>
              {[
                ["利用者名", m.clientName ? `${m.clientName} 様` : ""],
                ["開催場所", m.place],
                ["開催時間", timeRange(m.startTime, m.endTime)],
                ["開催回数", m.round ? `第${m.round}回` : ""],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center gap-[8px] border-b py-[2px] text-[10.5px] last:border-b-0" style={{ borderColor: "#eef1f6" }}>
                  <span style={{ background: HEAD, color: "#4a5875" }} className="w-[64px] shrink-0 rounded-[4px] py-[1px] text-center text-[9.5px] font-bold">
                    {k}
                  </span>
                  <span className="truncate">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex w-[170px] shrink-0 flex-col items-end gap-[10px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo-horizontal.png" alt="アソシエ" style={{ height: 38, width: "auto" }} />
              <div className="flex items-center gap-[6px] text-[10px]">
                <span style={{ background: HEAD, color: "#4a5875" }} className="rounded-[4px] px-[6px] py-[1px] text-[9.5px] font-bold">
                  作成者
                </span>
                <span>{m.author}</span>
              </div>
            </div>
          </div>

          {/* 1 基本情報 */}
          <H1 no="1">基本情報・参加者</H1>
          <div className={`${box} overflow-hidden`} style={{ borderColor: LINE }}>
            <table className="w-full border-collapse text-[10px] leading-[1.45]">
              <tbody>
                <tr style={{ borderColor: LINE }} className="border-b">
                  <Th>会議名称</Th>
                  <td className="px-[7px] py-[4px]" colSpan={3}>
                    {m.title}
                  </td>
                  <Th>会議目的</Th>
                  <td className="px-[7px] py-[4px]" colSpan={3}>
                    {m.purpose}
                  </td>
                </tr>
                <tr style={{ borderColor: LINE }} className="border-b">
                  <Th>開催日</Th>
                  <td className="whitespace-nowrap px-[7px] py-[4px]">{slashDate(m.heldOn)}</td>
                  <Th>開催時間</Th>
                  <td className="whitespace-nowrap px-[7px] py-[4px]">{timeRange(m.startTime, m.endTime)}</td>
                  <Th>開催場所</Th>
                  <td className="px-[7px] py-[4px]" colSpan={3}>
                    {m.place}
                  </td>
                </tr>
                <tr style={{ borderColor: LINE }} className="border-b">
                  <Th>開催回数</Th>
                  <td className="px-[7px] py-[4px]">{m.round ? `第${m.round}回` : ""}</td>
                  <Th>計画作成者</Th>
                  <td className="px-[7px] py-[4px]" colSpan={5}>
                    {m.author}
                  </td>
                </tr>
                <tr>
                  <Th top>参加者</Th>
                  <td colSpan={7} className="p-[5px]">
                    <div className="flex gap-[7px]">
                      <table className="flex-[1.6] border-collapse overflow-hidden rounded-[4px] text-[9.5px] leading-[1.4]" style={{ outline: `1px solid ${LINE}` }}>
                        <thead>
                          <tr style={{ background: HEAD, color: "#4a5875" }}>
                            <th className="w-[26%] px-[5px] py-[2px] text-left font-bold">区分</th>
                            <th className="w-[44%] px-[5px] py-[2px] text-left font-bold">事業所・続柄等</th>
                            <th className="px-[5px] py-[2px] text-left font-bold">氏名</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.attendees.map((a) => (
                            <tr key={a.id} style={{ borderColor: LINE }} className="border-t">
                              <td className="px-[5px] py-[1.5px]">{a.category}</td>
                              <td className="px-[5px] py-[1.5px]">{a.org}</td>
                              <td className="px-[5px] py-[1.5px]">{a.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="flex-1 rounded-[5px] px-[8px] py-[5px]" style={{ background: "#f3f6fc" }}>
                        <div style={{ color: NAVY }} className="mb-[3px] text-[10px] font-bold">
                          欠席者と照会内容
                        </div>
                        <div className="whitespace-pre-wrap text-[9.5px] leading-[1.5]">{m.absentees || "なし"}</div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 2 本文 */}
          <H1 no="2">本文セクション</H1>
          <div className={`${box} flex items-stretch gap-[7px] p-[7px]`} style={{ borderColor: LINE }}>
            <div className="w-[118px] shrink-0 pt-[2px]">
              <H2 no="0">重要事項サマリー</H2>
            </div>
            {sumGroups.map(({ k, rows }) => (
              <div key={k} className="min-w-0 flex-1 rounded-[5px] border px-[6px] py-[4px]" style={{ borderColor: LINE }}>
                <ChipS label={k} />
                <ul className="mt-[3px] space-y-[1px] text-[9.5px] leading-[1.45]">
                  {rows.length === 0 && <li className="text-[#8a93a6]">なし</li>}
                  {rows.map((r) => (
                    <li key={r.id}>・{r.body}</li>
                  ))}
                  {k === "宿題" && otherSummary.map((r) => <li key={r.id}>・{r.body}</li>)}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-[6px] grid grid-cols-2 gap-[6px]">
            <div className={`${box} p-[6px]`} style={{ borderColor: LINE }}>
              <H2 no="①">検討した項目</H2>
              <RowTable rows={m.topics} labelHeader="分類" bodyHeader="検討事項" labelW={104} />
            </div>
            <div className={`${box} p-[6px]`} style={{ borderColor: LINE }}>
              <H2 no="②">検討内容（要点＋心情）</H2>
              <RowTable rows={m.discussions} labelHeader="立場" bodyHeader="要点・心情" labelW={94} quote />
            </div>
            <div className={`${box} p-[6px]`} style={{ borderColor: LINE }}>
              <H2 no="③">検討結果（決定のみ）</H2>
              <RowTable rows={m.decisions} labelHeader="区分" bodyHeader="決定事項" labelW={82} />
            </div>
            <div className={`${box} p-[6px]`} style={{ borderColor: LINE }}>
              <H2 no="④">今後の課題</H2>
              <RowTable rows={m.issues} labelHeader="分類" bodyHeader="内容" labelW={92} />
            </div>
          </div>

          <div className={`${box} mt-[6px] flex items-center gap-[8px] px-[7px] py-[5px]`} style={{ borderColor: LINE }}>
            <div className="w-[118px] shrink-0">
              <H2 no="⑤">次回開催時期</H2>
            </div>
            <span style={{ background: HEAD, color: "#4a5875" }} className="rounded-[4px] px-[7px] py-[1px] text-[9.5px] font-bold">
              予定時期
            </span>
            <span className="text-[10px]">{m.nextTiming || "未定"}</span>
            <span className="text-[#b6c0d2]">/</span>
            <span style={{ background: HEAD, color: "#4a5875" }} className="rounded-[4px] px-[7px] py-[1px] text-[9.5px] font-bold">
              条件
            </span>
            <span className="text-[10px]">{m.nextCondition || "—"}</span>
          </div>

          {/* 3 付帯情報 */}
          <H1 no="3">付帯情報</H1>
          <div className="grid grid-cols-2 gap-[6px]">
            <div className={`${box} px-[8px] py-[6px]`} style={{ borderColor: LINE }}>
              <div style={{ color: NAVY }} className="mb-[3px] text-[10.5px] font-bold">
                前回の宿題・モニタリング点の引継ぎ
              </div>
              <ul className="space-y-[1px] text-[9.5px] leading-[1.5]">
                {m.carryover.length === 0 && <li className="text-[#8a93a6]">なし</li>}
                {m.carryover.map((r) => (
                  <li key={r.id}>
                    ・{r.body}　<span className="text-[#8a93a6]">→</span> {r.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className={`${box} px-[8px] py-[6px]`} style={{ borderColor: LINE }}>
              <div style={{ color: NAVY }} className="mb-[3px] text-[10.5px] font-bold">
                備考
              </div>
              <div className="whitespace-pre-wrap text-[9.5px] leading-[1.5]">{m.notes || "なし"}</div>
            </div>
          </div>

          {/* 4 根拠となる発言 */}
          {quotes.length > 0 && (
            <>
              <H1 no="4">
                会議の根拠となる発言<span className="text-[10px] font-bold">（抜粋）</span>
              </H1>
              <div className={`${box} space-y-[3px] px-[8px] py-[5px]`} style={{ borderColor: LINE }}>
                {quotes.map(({ e, who }) => (
                  <div key={e.segmentId} className="flex items-baseline gap-[8px] text-[9.5px] leading-[1.5]">
                    <span style={{ background: HEAD, color: BRAND }} className="shrink-0 rounded-[3px] px-[4px] font-mono text-[8.5px]">
                      {clock(e.start)}
                    </span>
                    <span className="shrink-0 font-bold text-[#4a5875]">{who}</span>
                    <span>「{e.text}」</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* フッター（縮小しない） */}
        <div
          className="absolute flex items-center border-t pt-[5px]"
          style={{ left: PAD_X, right: PAD_X, bottom: PAD_Y - 8, borderColor: LINE }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-horizontal.png" alt="" style={{ height: 16, width: "auto", opacity: 0.85 }} />
          <span className="flex-1" />
          <span className="text-[8.5px] text-[#5b667d]">
            出力日：{today.replaceAll("-", "/")}　|　作成者：{m.author || "—"}
            {m.status !== "confirmed" && <b className="ml-[6px] text-[#c2462b]">【未確定】</b>}
          </span>
        </div>
      </div>
    );
  },
);

function Th({ children, top }: { children: React.ReactNode; top?: boolean }) {
  return (
    <th
      style={{ background: HEAD, color: "#4a5875", borderColor: LINE }}
      className={`w-[70px] whitespace-nowrap border-r px-[7px] py-[4px] text-left text-[9.5px] font-bold ${top ? "align-top" : ""}`}
    >
      {children}
    </th>
  );
}

export const A4 = { PAGE_W, PAGE_H };
