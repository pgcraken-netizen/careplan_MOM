import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

interface Seg {
  id: string;
  start: number;
  end: number;
  text: string;
}

interface Ctx {
  recordedDate?: string;
  startTime?: string;
  endTime?: string;
  clients?: string[];
  places?: string[];
  glossary?: string;
  prevAttendees?: { category: string; org: string; name: string }[];
  prevIssues?: string[];
  clientHint?: string;
  officeName?: string;
}

const rowsSchema = (labels: string, fixed?: string[]) => ({
  type: "array",
  items: {
    type: "object",
    properties: {
      label: fixed ? { type: "string", enum: fixed } : { type: "string", description: labels },
      body: { type: "string", description: "1行40字程度の簡潔な文。体言止めか「〜する」で終える" },
      evidence: { type: "array", items: { type: "string" }, description: "根拠となる発言ID（例: s12）。1つ以上" },
    },
    required: ["label", "body", "evidence"],
  },
});

const TOOL = {
  name: "write_minutes",
  description: "サービス担当者会議の議事録（第4表準拠）を項目ごとに書き出す",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "会議名称。例：要介護4認定後のケアプラン確認・在宅支援調整のための担当者会議" },
      purpose: { type: "string", description: "会議目的（1文）" },
      heldOn: { type: "string", description: "発言から開催日がわかる場合のみ YYYY-MM-DD。不明なら空文字" },
      clientCandidates: { type: "array", items: { type: "string" }, description: "利用者名の候補（発言に出た名前。敬称なし）" },
      placeCandidates: { type: "array", items: { type: "string" }, description: "開催場所の候補（発言から推定できる場合のみ）" },
      attendees: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string", description: "本人/家族/居宅介護支援/通所介護/訪問介護/訪問看護/福祉用具/主治医/その他" },
            org: { type: "string", description: "事業所名、または家族の続柄（妻・長男など）" },
            name: { type: "string", description: "氏名。発言に無ければ空文字" },
          },
          required: ["category", "org", "name"],
        },
      },
      absentees: { type: "string", description: "欠席者と照会内容。発言が無ければ空文字" },
      summary: rowsSchema("", ["決定", "注意", "宿題"]),
      topics: rowsSchema("分類。全体・制度・計画/健康管理・医療連携/移動・転倒予防/通所介護/福祉用具/家族支援・連絡体制 など"),
      discussions: rowsSchema("立場。本人/家族/ケアマネジャー/各サービス事業所名の種別（通所介護、福祉用具など）"),
      decisions: rowsSchema("区分。支援方針/各サービス/通所介護/福祉用具/連携 など"),
      issues: rowsSchema("", ["注意", "モニタリング点", "宿題"]),
      nextTiming: { type: "string", description: "次回開催時期。発言が無ければ空文字" },
      nextCondition: { type: "string", description: "次回開催の条件（例：状態変化時は随時）。発言が無ければ空文字" },
      carryover: {
        type: "array",
        description: "前回の宿題・モニタリング点それぞれの対応状況",
        items: {
          type: "object",
          properties: {
            index: { type: "integer" },
            status: { type: "string", enum: ["対応済み", "対応中", "未対応", "次回確認"] },
            evidence: { type: "array", items: { type: "string" } },
          },
          required: ["index", "status", "evidence"],
        },
      },
    },
    required: [
      "title",
      "purpose",
      "heldOn",
      "clientCandidates",
      "placeCandidates",
      "attendees",
      "absentees",
      "summary",
      "topics",
      "discussions",
      "decisions",
      "issues",
      "nextTiming",
      "nextCondition",
      "carryover",
    ],
  },
};

const SYSTEM = `あなたは居宅介護支援事業所のケアマネジャーを補助する記録係です。
サービス担当者会議の文字起こしから、厚生労働省の第4表「サービス担当者会議の要点」に沿った議事録の下書きを作ります。

厳守するルール:
- 文字起こしに根拠がある内容だけを書く。病名・数値・日付・回数・氏名を推測で補わない。
- 各行には根拠となる発言IDを evidence に必ず1つ以上入れる。根拠が無い行は書かない。
- 該当する発言が無い項目は空配列または空文字にする（無理に埋めない）。
- 文字起こしには話者ラベルが無い。発言内容・口調・名乗りから立場（本人・家族・ケアマネジャー・各事業所）を判断する。判断できない発言は使わない。
- ② 検討内容では、本人・家族の発言は意向や心情が伝わるよう、短い言葉を「」で引用して残す。
- ③ 検討結果には会議で合意・決定したことだけを書く。提案や検討中のものは④に回す。
- 0 重要事項サマリーは③④から特に重要なものを最大6行に絞る。
- 文は簡潔に（1行40字程度）。敬語や話し言葉はやめ、記録の文体にする。
- 個人の住所・電話番号などは書かない。`;

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 503 });

  const { segments, context } = (await req.json()) as { segments: Seg[]; context: Ctx };
  if (!segments?.length) return NextResponse.json({ error: "文字起こしが空です" }, { status: 400 });

  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const transcript = segments.map((s) => `[${s.id}] (${mmss(s.start)}) ${s.text}`).join("\n");

  const info = [
    context.officeName && `居宅介護支援事業所: ${context.officeName}`,
    context.recordedDate && `録音日（ファイルの日時）: ${context.recordedDate}`,
    context.clientHint && `登録時に選ばれた利用者: ${context.clientHint}`,
    context.clients?.length && `登録済みの利用者: ${context.clients.join("、")}`,
    context.places?.length && `よく使う会議場所: ${context.places.join("、")}`,
    context.glossary && `固有名詞（表記をこれに合わせる）: ${context.glossary.split(/\n+/).filter(Boolean).join("、")}`,
    context.prevAttendees?.length &&
      `前回の参加者: ${context.prevAttendees.map((a) => `${a.category}/${a.org}/${a.name}`).join("、")}`,
    context.prevIssues?.length &&
      `前回の宿題・モニタリング点（index: 内容）:\n${context.prevIssues.map((t, i) => `${i}: ${t}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 8000,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [
        {
          role: "user",
          content: `## 参考情報\n${info || "なし"}\n\n## 文字起こし（[発言ID] (経過時間) 内容）\n${transcript}\n\nwrite_minutes で議事録の下書きを出力してください。`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: `項目整理に失敗しました (${res.status})`, detail: detail.slice(0, 400) }, { status: 502 });
  }
  const data = (await res.json()) as { content: { type: string; name?: string; input?: unknown }[] };
  const tool = data.content.find((c) => c.type === "tool_use" && c.name === TOOL.name);
  if (!tool) return NextResponse.json({ error: "AIの出力を読み取れませんでした" }, { status: 502 });
  return NextResponse.json({ result: tool.input });
}
