"use client";

import type { Meeting, Row } from "../types";
import { toneFor } from "../sections";
import { clock } from "../format";
import { LOGO_RATIO, download, fetchLogo, headerFacts, quotesOf, rowText, slashDate, summaryGroups, timeRange, titleLine } from "./common";

/*
 * Excel（.xlsx）出力。16列のグリッドに議事録を組み、
 * 印刷設定を「A4縦・1ページに収める」にする。
 */
export async function exportXlsx(m: Meeting, fileName: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "アソシエ";
  const ws = wb.addWorksheet("議事録", {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      margins: { left: 0.35, right: 0.35, top: 0.35, bottom: 0.45, header: 0.15, footer: 0.2 },
    },
    headerFooter: {
      oddFooter: `&L&8アソシエ&R&8出力日：${new Date().toLocaleDateString("ja-JP")}　|　作成者：${m.author || "—"}${m.status !== "confirmed" ? "　【未確定】" : ""}`,
    },
  });

  const FONT = "Meiryo UI";
  const NAVY = "FF1F3A68";
  const BRAND = "FF3A62B4";
  const LINE = "FFD9E1EE";
  const HEAD = "FFEEF3FB";
  const SOFT = "FF4A5875";
  const COLS = 16;
  const CW = 6.4;
  ws.columns = Array.from({ length: COLS }, () => ({ width: CW }));

  const col = (n: number) => String.fromCharCode(64 + n);
  const thin = { style: "thin" as const, color: { argb: LINE } };
  let r = 1;

  type Opt = Partial<{
    bold: boolean;
    size: number;
    color: string;
    fill: string;
    align: "left" | "center" | "right";
    border: boolean;
    valign: "top" | "middle";
  }>;

  function put(row: number, c1: number, c2: number, value: string, o: Opt = {}, rowEnd = row) {
    if (c2 > c1 || rowEnd > row) ws.mergeCells(`${col(c1)}${row}:${col(c2)}${rowEnd}`);
    const cell = ws.getCell(`${col(c1)}${row}`);
    cell.value = value;
    cell.font = { name: FONT, size: o.size ?? 9, bold: o.bold, color: { argb: o.color ?? "FF1F2A44" } };
    cell.alignment = { wrapText: true, vertical: o.valign ?? "top", horizontal: o.align ?? "left" };
    if (o.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.fill } };
    if (o.border !== false) {
      for (let rr = row; rr <= rowEnd; rr++)
        for (let cc = c1; cc <= c2; cc++) ws.getCell(`${col(cc)}${rr}`).border = { top: thin, left: thin, bottom: thin, right: thin };
    }
    return cell;
  }

  /** 全角1文字 ≒ 1.75 列幅として行数を見積もる */
  const linesFor = (text: string, cols: number, size = 9) => {
    const perLine = Math.max(4, Math.floor((cols * CW) / (1.75 * (size / 9))));
    return (text || "")
      .split("\n")
      .reduce((n, t) => n + Math.max(1, Math.ceil([...t].reduce((w, ch) => w + (ch.charCodeAt(0) < 256 ? 0.55 : 1), 0) / perLine)), 0);
  };
  const height = (row: number, lines: number, size = 9) => {
    const cur = ws.getRow(row).height ?? 0;
    ws.getRow(row).height = Math.max(cur, lines * (size + 4.5) + 4);
  };

  const h1 = (no: string, text: string) => {
    ws.getRow(r).height = 6;
    r++;
    put(r, 1, COLS, `${no}  ${text}`, { bold: true, size: 12, color: NAVY, border: false, valign: "middle" });
    ws.getCell(`A${r}`).border = { bottom: { style: "medium", color: { argb: NAVY } } };
    for (let c = 2; c <= COLS; c++) ws.getCell(`${col(c)}${r}`).border = { bottom: { style: "medium", color: { argb: NAVY } } };
    ws.getRow(r).height = 20;
    r++;
  };

  // ---------- ヘッダー ----------
  put(1, 1, 5, "サービス担当者会議", { bold: true, color: BRAND, size: 10, border: false });
  put(2, 1, 5, "議事録", { bold: true, size: 22, color: NAVY, border: false, valign: "middle" }, 3);
  put(4, 1, 5, titleLine(m), { size: 9.5, border: false });
  headerFacts(m).forEach(([k, v], i) => {
    put(1 + i, 6, 7, k, { bold: true, size: 8.5, color: SOFT, fill: HEAD, align: "center", valign: "middle" });
    put(1 + i, 8, 11, v, { size: 9, valign: "middle" });
  });
  put(4, 12, 16, `作成者　${m.author}`, { size: 9, align: "right", border: false, valign: "middle" });
  [1, 2, 3, 4].forEach((i) => (ws.getRow(i).height = 17));
  const logo = wb.addImage({ buffer: await fetchLogo(), extension: "png" });
  const logoH = 40;
  ws.addImage(logo, { tl: { col: 16 - (logoH * LOGO_RATIO) / (CW * 7.2), row: 0.15 }, ext: { width: logoH * LOGO_RATIO, height: logoH } });
  for (let c = 1; c <= COLS; c++) ws.getCell(`${col(c)}4`).border = { ...ws.getCell(`${col(c)}4`).border, bottom: { style: "medium", color: { argb: "FFC9D6EC" } } };
  r = 5;

  // ---------- 1 基本情報 ----------
  h1("1", "基本情報・参加者");
  const L = (row: number, c1: number, c2: number, t: string, end = row) =>
    put(row, c1, c2, t, { bold: true, size: 8.5, color: SOFT, fill: HEAD, valign: "middle" }, end);
  L(r, 1, 2, "会議名称");
  put(r, 3, 8, m.title);
  L(r, 9, 10, "会議目的");
  put(r, 11, 16, m.purpose);
  height(r, Math.max(linesFor(m.title, 6), linesFor(m.purpose, 6)));
  r++;
  L(r, 1, 2, "開催日");
  put(r, 3, 4, slashDate(m.heldOn));
  L(r, 5, 6, "開催時間");
  put(r, 7, 9, timeRange(m.startTime, m.endTime));
  L(r, 10, 11, "開催場所");
  put(r, 12, 16, m.place);
  height(r, 1);
  r++;
  L(r, 1, 2, "開催回数");
  put(r, 3, 4, m.round ? `第${m.round}回` : "");
  L(r, 5, 6, "計画作成者");
  put(r, 7, 16, m.author);
  height(r, 1);
  r++;
  const attStart = r;
  const att = m.attendees.length ? m.attendees : [];
  const attEnd = r + att.length;
  L(attStart, 1, 2, "参加者", attEnd);
  put(r, 3, 4, "区分", { bold: true, size: 8.5, color: SOFT, fill: HEAD });
  put(r, 5, 8, "事業所・続柄等", { bold: true, size: 8.5, color: SOFT, fill: HEAD });
  put(r, 9, 11, "氏名", { bold: true, size: 8.5, color: SOFT, fill: HEAD });
  put(r, 12, 16, "欠席者と照会内容", { bold: true, size: 8.5, color: NAVY, fill: "FFF3F6FC" });
  r++;
  att.forEach((a) => {
    put(r, 3, 4, a.category, { size: 8.5 });
    put(r, 5, 8, a.org, { size: 8.5 });
    put(r, 9, 11, a.name, { size: 8.5 });
    height(r, Math.max(1, linesFor(a.org, 4, 8.5)), 8.5);
    r++;
  });
  if (att.length) put(attStart + 1, 12, 16, m.absentees || "なし", { size: 8.5, fill: "FFF3F6FC" }, attEnd);
  const absLines = linesFor(m.absentees, 5, 8.5);
  if (att.length && absLines > att.length) height(attEnd, absLines - att.length + 1, 8.5);

  // ---------- 2 本文 ----------
  h1("2", "本文セクション");
  const groups = summaryGroups(m);
  put(r, 1, 3, "0  重要事項サマリー", { bold: true, color: NAVY, size: 9.5, valign: "middle" }, r + 1);
  const gc: [number, number][] = [
    [4, 7],
    [8, 11],
    [12, 16],
  ];
  groups.forEach((g, i) => {
    const t = toneFor(g.k);
    put(r, gc[i][0], gc[i][1], g.k, { bold: true, size: 8.5, color: `FF${t.hex.fg.slice(1)}`, fill: `FF${t.hex.bg.slice(1)}`, align: "center" });
    const text = g.rows.length ? g.rows.map((x) => `・${x.body}`).join("\n") : "なし";
    put(r + 1, gc[i][0], gc[i][1], text, { size: 8.5 });
    height(r + 1, linesFor(text, gc[i][1] - gc[i][0] + 1, 8.5), 8.5);
  });
  r += 2;

  const pair = (left: { no: string; title: string; rows: Row[]; lh: string; bh: string; quote?: boolean }, right: typeof left) => {
    ws.getRow(r).height = 5;
    r++;
    put(r, 1, 8, `${left.no}  ${left.title}`, { bold: true, color: NAVY, size: 9.5, border: false });
    put(r, 9, 16, `${right.no}  ${right.title}`, { bold: true, color: NAVY, size: 9.5, border: false });
    r++;
    const hd = { bold: true, size: 8.5, color: SOFT, fill: HEAD };
    put(r, 1, 2, left.lh, hd);
    put(r, 3, 8, left.bh, hd);
    put(r, 9, 10, right.lh, hd);
    put(r, 11, 16, right.bh, hd);
    r++;
    const n = Math.max(left.rows.length, right.rows.length, 1);
    for (let i = 0; i < n; i++) {
      const cells: [Row | undefined, number, boolean | undefined][] = [
        [left.rows[i], 1, left.quote],
        [right.rows[i], 9, right.quote],
      ];
      let lines = 1;
      for (const [row, c, q] of cells) {
        if (row) {
          const t = toneFor(row.label);
          put(r, c, c + 1, row.label, { bold: true, size: 8.5, color: `FF${t.hex.fg.slice(1)}`, fill: `FF${t.hex.bg.slice(1)}`, valign: "middle" });
          const body = rowText(row, q);
          put(r, c + 2, c + 7, body, { size: 8.5 });
          lines = Math.max(lines, linesFor(body, 6, 8.5), linesFor(row.label, 2, 8.5));
        } else if (i === 0) {
          put(r, c, c + 7, "記載なし", { size: 8.5, color: "FF8A93A6" });
        } else {
          put(r, c, c + 1, "");
          put(r, c + 2, c + 7, "");
        }
      }
      height(r, lines, 8.5);
      r++;
    }
  };
  pair(
    { no: "①", title: "検討した項目", rows: m.topics, lh: "分類", bh: "検討事項" },
    { no: "②", title: "検討内容（要点＋心情）", rows: m.discussions, lh: "立場", bh: "要点・心情", quote: true },
  );
  pair(
    { no: "③", title: "検討結果（決定のみ）", rows: m.decisions, lh: "区分", bh: "決定事項" },
    { no: "④", title: "今後の課題", rows: m.issues, lh: "分類", bh: "内容" },
  );
  ws.getRow(r).height = 5;
  r++;
  put(r, 1, 3, "⑤  次回開催時期", { bold: true, color: NAVY, size: 9.5, valign: "middle" });
  put(r, 4, 5, "予定時期", { bold: true, size: 8.5, color: SOFT, fill: HEAD, valign: "middle", align: "center" });
  put(r, 6, 10, m.nextTiming || "未定", { valign: "middle" });
  put(r, 11, 12, "条件", { bold: true, size: 8.5, color: SOFT, fill: HEAD, valign: "middle", align: "center" });
  put(r, 13, 16, m.nextCondition || "—", { valign: "middle" });
  height(r, Math.max(1, linesFor(m.nextTiming, 5), linesFor(m.nextCondition, 4)));
  r++;

  // ---------- 3 付帯情報 ----------
  h1("3", "付帯情報");
  put(r, 1, 8, "前回の宿題・モニタリング点の引継ぎ", { bold: true, color: NAVY, size: 9 });
  put(r, 9, 16, "備考", { bold: true, color: NAVY, size: 9 });
  r++;
  const carry = m.carryover.length ? m.carryover.map((x) => `・${x.body}　→ ${x.label}`).join("\n") : "なし";
  put(r, 1, 8, carry, { size: 8.5 });
  put(r, 9, 16, m.notes || "なし", { size: 8.5 });
  height(r, Math.max(linesFor(carry, 8, 8.5), linesFor(m.notes, 8, 8.5)), 8.5);
  r++;

  // ---------- 4 根拠 ----------
  const quotes = quotesOf(m);
  if (quotes.length) {
    h1("4", "会議の根拠となる発言（抜粋）");
    for (const { e, who } of quotes) {
      put(r, 1, 2, clock(e.start), { size: 8.5, color: BRAND, align: "center" });
      put(r, 3, 4, who, { bold: true, size: 8.5, color: SOFT });
      put(r, 5, 16, `「${e.text}」`, { size: 8.5 });
      height(r, linesFor(e.text, 12, 8.5), 8.5);
      r++;
    }
  }

  ws.pageSetup.printArea = `A1:${col(COLS)}${r - 1}`;
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileName}.xlsx`);
}
