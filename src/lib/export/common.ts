"use client";

import { jpDate, slashDate, timeRange } from "../format";
import type { Meeting, Row } from "../types";

export async function fetchLogo(): Promise<ArrayBuffer> {
  const res = await fetch("/brand/logo-horizontal.png");
  return res.arrayBuffer();
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const LOGO_RATIO = 626 / 240;

export function headerFacts(m: Meeting): [string, string][] {
  return [
    ["利用者名", m.clientName ? `${m.clientName} 様` : ""],
    ["開催場所", m.place],
    ["開催時間", timeRange(m.startTime, m.endTime)],
    ["開催回数", m.round ? `第${m.round}回` : ""],
  ];
}

export function titleLine(m: Meeting) {
  return `${jpDate(m.heldOn)}${m.round ? `　第${m.round}回` : ""}`;
}

export { slashDate, timeRange };

export const rowText = (r: Row, quote = false) => (quote || r.body.startsWith("「") ? r.body : `・${r.body}`);

export function quotesOf(m: Meeting) {
  return [...m.discussions, ...m.issues, ...m.decisions]
    .flatMap((r) => r.evidence.map((e) => ({ e, who: r.label })))
    .filter((x, i, a) => a.findIndex((y) => y.e.segmentId === x.e.segmentId) === i)
    .slice(0, 2);
}

export const SUMMARY_KINDS = ["決定", "注意", "宿題"] as const;

export function summaryGroups(m: Meeting) {
  const other = m.summary.filter((r) => !(SUMMARY_KINDS as readonly string[]).includes(r.label));
  return SUMMARY_KINDS.map((k) => ({
    k,
    rows: [...m.summary.filter((r) => r.label === k), ...(k === "宿題" ? other : [])],
  }));
}
