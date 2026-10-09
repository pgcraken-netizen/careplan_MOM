"use client";

import type { Meeting, Row } from "../types";
import { toneFor } from "../sections";
import { clock } from "../format";
import {
  LOGO_RATIO,
  download,
  fetchLogo,
  headerFacts,
  quotesOf,
  rowText,
  slashDate,
  summaryGroups,
  timeRange,
  titleLine,
} from "./common";

/*
 * Word（.docx）出力。A4・余白10mmで1ページに収まるよう、
 * 画面のA4シートで計算した縮小率に合わせて文字サイズを決める。
 */
export async function exportDocx(m: Meeting, fileName: string, scale = 1) {
  const d = await import("docx");
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    ImageRun,
    LineRuleType,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    WidthType,
  } = d;

  const logo = await fetchLogo();
  const FONT = "游ゴシック";
  const NAVY = "1F3A68";
  const BRAND = "3A62B4";
  const LINE = "D9E1EE";
  const HEAD = "EEF3FB";
  const SOFT = "4A5875";

  // 1ページに収めるため、シートの縮小率から文字サイズ（半ポイント）を決める
  const k = Math.max(0.56, Math.min(1, scale) * 0.95);
  const sz = (pt: number) => Math.max(10, Math.round(pt * k * 2));
  const BODY = sz(8.6);
  const SMALL = sz(8);
  const pad = Math.round(40 * k);

  const PAGE_W = 11906; // A4 twips
  const MARGIN = 567; // 10mm
  const W = PAGE_W - MARGIN * 2;

  const run = (text: string, o: Partial<{ bold: boolean; size: number; color: string }> = {}) =>
    new TextRun({ text, font: { ascii: FONT, eastAsia: FONT, hAnsi: FONT }, size: o.size ?? BODY, bold: o.bold, color: o.color });

  const para = (
    children: InstanceType<typeof TextRun>[] | string,
    o: Partial<{ align: (typeof AlignmentType)[keyof typeof AlignmentType]; after: number; before: number; free: boolean }> = {},
  ) =>
    new Paragraph({
      children: typeof children === "string" ? [run(children)] : children,
      alignment: o.align,
      // 游ゴシックは行間が広いので「固定値」で詰める（文字サイズの1.42倍）
      spacing: o.free
        ? { after: o.after ?? 0, before: o.before ?? 0 }
        : { after: o.after ?? 0, before: o.before ?? 0, line: Math.round(BODY * 10 * 1.42), lineRule: LineRuleType.EXACT },
    });

  const lines = (text: string, o: Partial<{ size: number; color: string }> = {}) =>
    (text || "").split("\n").map((t) => para([run(t, o)]));

  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const thin = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
  const gridBorders = { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin };
  const shade = (fill: string) => ({ type: ShadingType.CLEAR, color: "auto", fill });
  const margins = { top: pad, bottom: pad, left: pad * 2, right: pad * 2 };

  const cell = (
    children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[],
    o: Partial<{ w: number; fill: string; span: number; vAlign: "top" | "center" | "bottom" }> = {},
  ) =>
    new TableCell({
      children: children.length ? children : [para("")],
      width: o.w ? { size: o.w, type: WidthType.DXA } : undefined,
      columnSpan: o.span,
      shading: o.fill ? shade(o.fill) : undefined,
      verticalAlign: o.vAlign ?? "top",
      margins,
    });

  const th = (text: string, w?: number) => cell([para([run(text, { bold: true, size: SMALL, color: SOFT })])], { w, fill: HEAD, vAlign: "center" });

  const chip = (label: string) => {
    const t = toneFor(label);
    return new TextRun({
      text: ` ${label || "—"} `,
      font: { ascii: FONT, eastAsia: FONT, hAnsi: FONT },
      size: SMALL,
      bold: true,
      color: t.hex.fg.slice(1),
      shading: { type: ShadingType.CLEAR, color: "auto", fill: t.hex.bg.slice(1) },
    });
  };

  const h1 = (no: string, text: string) =>
    new Paragraph({
      spacing: { before: Math.round(140 * k), after: Math.round(60 * k) },
      children: [
        new TextRun({ text: ` ${no} `, bold: true, color: "FFFFFF", size: sz(11), font: { ascii: FONT, eastAsia: FONT, hAnsi: FONT }, shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY } }),
        run(`  ${text}`, { bold: true, size: sz(12.5), color: NAVY }),
      ],
    });

  const h2 = (no: string, text: string) =>
    para(
      [
        new TextRun({ text: ` ${no} `, bold: true, color: "FFFFFF", size: SMALL, font: { ascii: FONT, eastAsia: FONT, hAnsi: FONT }, shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND } }),
        run(` ${text}`, { bold: true, size: sz(9.6), color: NAVY }),
      ],
      { after: Math.round(40 * k) },
    );

  const rowsTable = (rows: Row[], labelHeader: string, bodyHeader: string, width: number, quote = false) => {
    const lw = Math.round(width * 0.34);
    return new Table({
      width: { size: width, type: WidthType.DXA },
      columnWidths: [lw, width - lw],
      layout: TableLayoutType.FIXED,
      borders: { ...noBorders, insideHorizontal: thin, bottom: thin, top: thin },
      rows: [
        new TableRow({ children: [th(labelHeader, lw), th(bodyHeader, width - lw)], tableHeader: true }),
        ...(rows.length
          ? rows.map((r) => new TableRow({ children: [cell([para([chip(r.label)])], { w: lw }), cell(lines(rowText(r, quote)), { w: width - lw })] }))
          : [new TableRow({ children: [cell([para([run("記載なし", { color: "8A93A6" })])], { span: 2 })] })]),
      ],
    });
  };

  const panel = (children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[], w: number) =>
    cell(children, { w });

  // ---------- ヘッダー ----------
  const facts = headerFacts(m);
  const logoH = Math.round(38 * k);
  const header = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [3200, W - 3200 - 2700, 2700],
    layout: TableLayoutType.FIXED,
    borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 12, color: "C9D6EC" } },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 3200, type: WidthType.DXA },
            margins: { bottom: 80 },
            children: [
              para([run("サービス担当者会議", { bold: true, size: sz(10), color: BRAND })], { free: true }),
              para([run("議事録", { bold: true, size: sz(24), color: NAVY })], { free: true }),
              para([run(titleLine(m), { size: sz(9.5) })], { free: true }),
            ],
          }),
          new TableCell({
            width: { size: W - 5900, type: WidthType.DXA },
            margins: { bottom: 80 },
            children: [
              new Table({
                width: { size: W - 6000, type: WidthType.DXA },
                columnWidths: [1100, W - 6000 - 1100],
                layout: TableLayoutType.FIXED,
                borders: { ...noBorders, insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "EEF1F6" } },
                rows: facts.map(
                  ([a, b]) =>
                    new TableRow({
                      children: [
                        cell([para([run(a, { bold: true, size: SMALL, color: SOFT })], { align: AlignmentType.CENTER })], { w: 1100, fill: HEAD }),
                        cell([para([run(b, { size: sz(9) })])], { w: W - 6000 - 1100 }),
                      ],
                    }),
                ),
              }),
            ],
          }),
          new TableCell({
            width: { size: 2700, type: WidthType.DXA },
            margins: { bottom: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new ImageRun({ type: "png", data: logo, transformation: { width: Math.round(logoH * LOGO_RATIO), height: logoH } })],
              }),
              para([run("作成者 ", { bold: true, size: SMALL, color: SOFT }), run(m.author, { size: sz(8.6) })], { align: AlignmentType.RIGHT, before: 80 }),
            ],
          }),
        ],
      }),
    ],
  });

  // ---------- 1 基本情報 ----------
  const colW = [1050, 1700, 1050, 1800, 1050, 1250, 1100, W - (1050 * 3 + 1700 + 1800 + 1250 + 1100)];
  const span = (a: number, b: number) => colW.slice(a, b).reduce((x, y) => x + y, 0);
  const attW = Math.round((span(1, 8) - 200) * 0.6);
  const absW = span(1, 8) - 200 - attW;
  const attendees = new Table({
    width: { size: attW, type: WidthType.DXA },
    columnWidths: [Math.round(attW * 0.26), Math.round(attW * 0.44), attW - Math.round(attW * 0.26) - Math.round(attW * 0.44)],
    layout: TableLayoutType.FIXED,
    borders: gridBorders,
    rows: [
      new TableRow({ children: [th("区分"), th("事業所・続柄等"), th("氏名")] }),
      ...m.attendees.map(
        (a) =>
          new TableRow({
            children: [cell([para([run(a.category, { size: SMALL })])]), cell([para([run(a.org, { size: SMALL })])]), cell([para([run(a.name, { size: SMALL })])])],
          }),
      ),
    ],
  });
  const basic = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: colW,
    layout: TableLayoutType.FIXED,
    borders: gridBorders,
    rows: [
      new TableRow({
        children: [th("会議名称", colW[0]), cell(lines(m.title), { span: 3 }), th("会議目的", colW[4]), cell(lines(m.purpose), { span: 3 })],
      }),
      new TableRow({
        children: [
          th("開催日", colW[0]),
          cell([para(slashDate(m.heldOn))], { w: colW[1] }),
          th("開催時間", colW[2]),
          cell([para(timeRange(m.startTime, m.endTime))], { w: colW[3] }),
          th("開催場所", colW[4]),
          cell([para(m.place)], { span: 3 }),
        ],
      }),
      new TableRow({
        children: [th("開催回数", colW[0]), cell([para(m.round ? `第${m.round}回` : "")], { w: colW[1] }), th("計画作成者", colW[2]), cell([para(m.author)], { span: 5 })],
      }),
      new TableRow({
        children: [
          th("参加者", colW[0]),
          cell(
            [
              new Table({
                width: { size: attW + absW, type: WidthType.DXA },
                columnWidths: [attW, absW],
                layout: TableLayoutType.FIXED,
                borders: noBorders,
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({ width: { size: attW, type: WidthType.DXA }, children: [attendees], margins: { right: 100 } }),
                      new TableCell({
                        width: { size: absW, type: WidthType.DXA },
                        shading: shade("F3F6FC"),
                        margins,
                        children: [para([run("欠席者と照会内容", { bold: true, size: sz(8.6), color: NAVY })]), ...lines(m.absentees || "なし", { size: SMALL })],
                      }),
                    ],
                  }),
                ],
              }),
            ],
            { span: 7 },
          ),
        ],
      }),
    ],
  });

  // ---------- 2 本文 ----------
  const S0 = 2350;
  const sumW = [S0, Math.round((W - S0) / 3), Math.round((W - S0) / 3), W - S0 - 2 * Math.round((W - S0) / 3)];
  const summary = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: sumW,
    layout: TableLayoutType.FIXED,
    borders: gridBorders,
    rows: [
      new TableRow({
        children: [
          cell([h2("0", "重要事項サマリー")], { w: sumW[0] }),
          ...summaryGroups(m).map((g, i) =>
            cell([para([chip(g.k)], { after: 30 }), ...(g.rows.length ? g.rows.map((r) => para([run(`・${r.body}`, { size: SMALL })])) : [para([run("なし", { size: SMALL, color: "8A93A6" })])])], {
              w: sumW[i + 1],
            }),
          ),
        ],
      }),
    ],
  });

  const half = Math.floor((W - 120) / 2);
  const inner = half - pad * 4;
  const grid = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [half, W - half],
    layout: TableLayoutType.FIXED,
    borders: gridBorders,
    rows: [
      new TableRow({
        children: [
          panel([h2("①", "検討した項目"), rowsTable(m.topics, "分類", "検討事項", inner)], half),
          panel([h2("②", "検討内容（要点＋心情）"), rowsTable(m.discussions, "立場", "要点・心情", inner, true)], W - half),
        ],
      }),
      new TableRow({
        children: [
          panel([h2("③", "検討結果（決定のみ）"), rowsTable(m.decisions, "区分", "決定事項", inner)], half),
          panel([h2("④", "今後の課題"), rowsTable(m.issues, "分類", "内容", inner)], W - half),
        ],
      }),
    ],
  });

  const next = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W],
    borders: gridBorders,
    rows: [
      new TableRow({
        children: [
          cell([
            para([
              new TextRun({ text: " ⑤ ", bold: true, color: "FFFFFF", size: SMALL, font: { ascii: FONT, eastAsia: FONT, hAnsi: FONT }, shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND } }),
              run(" 次回開催時期　　", { bold: true, size: sz(9.6), color: NAVY }),
              run(" 予定時期 ", { bold: true, size: SMALL, color: SOFT }),
              run(`  ${m.nextTiming || "未定"}　／　`),
              run(" 条件 ", { bold: true, size: SMALL, color: SOFT }),
              run(`  ${m.nextCondition || "—"}`),
            ]),
          ]),
        ],
      }),
    ],
  });

  // ---------- 3 付帯情報 ----------
  const extra = new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [half, W - half],
    layout: TableLayoutType.FIXED,
    borders: gridBorders,
    rows: [
      new TableRow({
        children: [
          panel(
            [
              para([run("前回の宿題・モニタリング点の引継ぎ", { bold: true, size: sz(9), color: NAVY })], { after: 30 }),
              ...(m.carryover.length
                ? m.carryover.map((r) => para([run(`・${r.body}　→ ${r.label}`, { size: SMALL })]))
                : [para([run("なし", { size: SMALL, color: "8A93A6" })])]),
            ],
            half,
          ),
          panel([para([run("備考", { bold: true, size: sz(9), color: NAVY })], { after: 30 }), ...lines(m.notes || "なし", { size: SMALL })], W - half),
        ],
      }),
    ],
  });

  const quotes = quotesOf(m);
  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    header,
    h1("1", "基本情報・参加者"),
    basic,
    h1("2", "本文セクション"),
    summary,
    para("", { after: 60 }),
    grid,
    para("", { after: 60 }),
    next,
    h1("3", "付帯情報"),
    extra,
  ];
  if (quotes.length) {
    children.push(
      h1("4", "会議の根拠となる発言（抜粋）"),
      new Table({
        width: { size: W, type: WidthType.DXA },
        columnWidths: [W],
        borders: gridBorders,
        rows: [
          new TableRow({
            children: [
              cell(
                quotes.map(({ e, who }) =>
                  para([run(clock(e.start), { size: SMALL, color: BRAND }), run(`  ${who}  `, { bold: true, size: SMALL, color: SOFT }), run(`「${e.text}」`, { size: SMALL })]),
                ),
              ),
            ],
          }),
        ],
      }),
    );
  }

  const footerH = Math.round(14 * k);
  const doc = new Document({
    creator: "アソシエ",
    title: fileName,
    styles: { default: { document: { run: { font: { ascii: FONT, eastAsia: FONT, hAnsi: FONT }, size: BODY } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: 16838 },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 284, footer: 284 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                tabStops: [{ type: "right", position: W }],
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 2 } },
                children: [
                  new ImageRun({ type: "png", data: logo, transformation: { width: Math.round(footerH * LOGO_RATIO), height: footerH } }),
                  run(`\t出力日：${new Date().toLocaleDateString("ja-JP")}　|　作成者：${m.author || "—"}${m.status !== "confirmed" ? "　【未確定】" : ""}`, {
                    size: sz(7.5),
                    color: "5B667D",
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  download(await Packer.toBlob(doc), `${fileName}.docx`);
}
