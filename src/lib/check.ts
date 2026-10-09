import { SECTION_BY_KEY } from "./sections";
import type { BasicField, Meeting, SectionKey } from "./types";

export interface Problem {
  anchor: string;
  kind: "missing" | "unreviewed";
  message: string;
}

const FIELD_LABEL: Record<BasicField, string> = {
  title: "会議名称",
  purpose: "会議目的",
  heldOn: "開催日",
  startTime: "開始時刻",
  endTime: "終了時刻",
  place: "開催場所",
  round: "開催回数",
  clientName: "利用者名",
  author: "居宅サービス計画作成者",
  absentees: "欠席者と照会内容",
  nextTiming: "次回開催時期",
  nextCondition: "次回開催の条件",
};

/** 第4表として確定する前のチェック */
export function checkMeeting(m: Meeting): Problem[] {
  const p: Problem[] = [];
  const need: [BasicField, unknown][] = [
    ["title", m.title],
    ["heldOn", m.heldOn],
    ["startTime", m.startTime],
    ["endTime", m.endTime],
    ["place", m.place],
    ["round", m.round],
    ["clientName", m.clientName],
    ["author", m.author],
  ];
  for (const [f, v] of need) {
    if (v === null || v === undefined || String(v).trim() === "")
      p.push({ anchor: "basic", kind: "missing", message: `${FIELD_LABEL[f]}が未入力です` });
  }
  if (!m.attendees.some((a) => a.name.trim() || a.org.trim()))
    p.push({ anchor: "basic", kind: "missing", message: "参加者が未入力です" });

  const required: SectionKey[] = ["topics", "discussions", "decisions", "issues"];
  for (const k of required) {
    if (!m[k].some((r) => r.body.trim()))
      p.push({ anchor: k, kind: "missing", message: `${SECTION_BY_KEY[k].title}が空です` });
  }
  if (!m.nextTiming.trim()) p.push({ anchor: "next", kind: "missing", message: "次回開催時期が未入力です" });

  for (const f of m.aiFields)
    p.push({ anchor: "basic", kind: "unreviewed", message: `${FIELD_LABEL[f]}（AI補完）が未確認です` });
  if (m.attendees.some((a) => a.origin === "ai" && !a.reviewed))
    p.push({ anchor: "basic", kind: "unreviewed", message: "参加者（AI補完）が未確認です" });

  const all: SectionKey[] = ["summary", "topics", "discussions", "decisions", "issues", "carryover"];
  for (const k of all) {
    const n = m[k].filter((r) => r.origin === "ai" && !r.reviewed).length;
    if (n) p.push({ anchor: k, kind: "unreviewed", message: `${SECTION_BY_KEY[k].title}：AIの行が${n}件未確認です` });
  }
  return p;
}

export function unreviewedCount(m: Meeting) {
  return checkMeeting(m).filter((x) => x.kind === "unreviewed").length;
}
