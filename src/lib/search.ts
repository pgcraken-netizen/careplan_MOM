import type { Meeting } from "./types";

/** 検索用に会議の全テキストを連結する */
export function meetingText(m: Meeting) {
  const rows = [...m.summary, ...m.topics, ...m.discussions, ...m.decisions, ...m.issues, ...m.carryover];
  return [
    m.title,
    m.purpose,
    m.clientName,
    m.place,
    m.author,
    m.absentees,
    m.nextTiming,
    m.nextCondition,
    m.notes,
    m.heldOn,
    m.heldOn.replaceAll("-", "/"),
    ...m.attendees.flatMap((a) => [a.category, a.org, a.name]),
    ...rows.flatMap((r) => [r.label, r.body]),
    ...m.transcript.map((s) => s.text),
  ].join("\n");
}

export interface Hit {
  meeting: Meeting;
  where: string;
  snippet: string;
}

export function searchMeetings(all: Meeting[], query: string): Hit[] {
  const q = query.trim();
  if (!q) return [];
  const hits: Hit[] = [];
  for (const m of all) {
    const parts: [string, string][] = [
      ["会議名称", m.title],
      ["会議目的", m.purpose],
      ["利用者", m.clientName],
      ...m.summary.map((r) => [`重要事項・${r.label}`, r.body] as [string, string]),
      ...m.topics.map((r) => [`検討した項目・${r.label}`, r.body] as [string, string]),
      ...m.discussions.map((r) => [`検討内容・${r.label}`, r.body] as [string, string]),
      ...m.decisions.map((r) => [`検討結果・${r.label}`, r.body] as [string, string]),
      ...m.issues.map((r) => [`今後の課題・${r.label}`, r.body] as [string, string]),
      ["備考", m.notes],
      ...m.transcript.map((s) => ["文字起こし", s.text] as [string, string]),
    ];
    for (const [where, text] of parts) {
      const i = text?.indexOf(q) ?? -1;
      if (i >= 0) {
        const from = Math.max(0, i - 18);
        hits.push({
          meeting: m,
          where,
          snippet: (from > 0 ? "…" : "") + text.slice(from, i + q.length + 30) + (i + q.length + 30 < text.length ? "…" : ""),
        });
      }
    }
  }
  return hits;
}
