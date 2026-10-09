"use client";

import { CHUNK_SEC, decodeToMono16k, durationOf, splitChunks } from "./audio";
import {
  carryoverFrom,
  getMeeting,
  getSettings,
  listMeetings,
  newAttendee,
  nextRound,
  previousMeeting,
  saveMeeting,
  uid,
} from "./store";
import type { Attendee, BasicField, Evidence, Meeting, Row, Segment } from "./types";

type Progress = (msg: string, percent?: number) => void;

interface AiRow {
  label: string;
  body: string;
  evidence: string[];
}

interface AiResult {
  title: string;
  purpose: string;
  heldOn: string;
  clientCandidates: string[];
  placeCandidates: string[];
  attendees: { category: string; org: string; name: string }[];
  absentees: string;
  summary: AiRow[];
  topics: AiRow[];
  discussions: AiRow[];
  decisions: AiRow[];
  issues: AiRow[];
  nextTiming: string;
  nextCondition: string;
  carryover: { index: number; status: string; evidence: string[] }[];
}

async function update(id: string, patch: (m: Meeting) => Partial<Meeting>) {
  const m = await getMeeting(id);
  if (!m) throw new Error("会議が見つかりません");
  return saveMeeting({ ...m, ...patch(m) });
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `通信エラー (${res.status})`);
  return data as T;
}

/** 文字起こし：90秒ずつ並列3本で送る */
export async function transcribeAudio(file: Blob, glossary: string, onProgress: Progress): Promise<{ segments: Segment[]; duration: number }> {
  onProgress("音声を読み込んでいます", 2);
  const samples = await decodeToMono16k(file);
  const duration = durationOf(samples);
  const chunks = splitChunks(samples);
  if (!chunks.length) throw new Error("音声が短すぎます");
  const prompt = glossary.split(/\n+/).filter(Boolean).join("、");

  const results: { start: number; end: number; text: string }[][] = new Array(chunks.length);
  let done = 0;
  let next = 0;
  const worker = async () => {
    while (next < chunks.length) {
      const c = chunks[next++];
      const fd = new FormData();
      fd.append("file", c.wav, `chunk-${c.index}.wav`);
      fd.append("offset", String(c.offset));
      fd.append("prompt", prompt);
      let lastErr: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch("/api/transcribe", { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `文字起こしエラー (${res.status})`);
          results[c.index] = data.segments;
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (lastErr) throw lastErr;
      done++;
      onProgress(`文字起こし中（${done}/${chunks.length}）`, 5 + Math.round((done / chunks.length) * 60));
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  const segments: Segment[] = results
    .flat()
    .filter(Boolean)
    .sort((a, b) => a.start - b.start)
    .map((s, i) => ({ id: `s${i + 1}`, start: s.start, end: s.end, text: s.text }));
  return { segments, duration };
}

function toRows(items: AiRow[] | undefined, seg: Map<string, Segment>): Row[] {
  return (items ?? [])
    .filter((r) => r.body?.trim())
    .map((r) => ({
      id: uid(),
      label: r.label ?? "",
      body: r.body.trim(),
      origin: "ai" as const,
      reviewed: false,
      evidence: (r.evidence ?? [])
        .map((e) => seg.get(e))
        .filter((s): s is Segment => Boolean(s))
        .map<Evidence>((s) => ({ segmentId: s.id, start: s.start, end: s.end, text: s.text })),
    }));
}

/** AIの結果を会議データに反映する。基本情報は「候補」として入れ、確定値にしない */
export async function applyAiResult(id: string, r: AiResult) {
  const all = await listMeetings();
  const settings = await getSettings();
  return update(id, (m) => {
    const seg = new Map(m.transcript.map((s) => [s.id, s]));
    const aiFields = new Set<BasicField>(m.aiFields);
    const candidates = { ...m.candidates };
    const patch: Partial<Meeting> = {};

    if (r.title) {
      patch.title = r.title;
      aiFields.add("title");
    }
    if (r.purpose) {
      patch.purpose = r.purpose;
      aiFields.add("purpose");
    }
    if (r.heldOn && /^\d{4}-\d{2}-\d{2}$/.test(r.heldOn) && r.heldOn !== m.heldOn) {
      candidates.heldOn = [r.heldOn, m.heldOn];
      aiFields.add("heldOn");
    }

    // 利用者：登録済みの名前に一致する候補を優先
    const known = new Set([...settings.clients, ...all.map((x) => x.clientName).filter(Boolean)]);
    const clientCands = [...new Set((r.clientCandidates ?? []).map((c) => c.trim()).filter(Boolean))];
    const matched = clientCands.filter((c) => known.has(c) || [...known].some((k) => k.replace(/\s/g, "") === c.replace(/\s/g, "")));
    if (!m.clientName && (matched[0] || clientCands[0])) {
      patch.clientName = [...known].find((k) => k.replace(/\s/g, "") === (matched[0] || "").replace(/\s/g, "")) || matched[0] || clientCands[0];
      aiFields.add("clientName");
    }
    if (clientCands.length) candidates.clientName = clientCands;

    const places = [...new Set([...(r.placeCandidates ?? []), ...settings.places])].slice(0, 6);
    candidates.place = places;
    if (!m.place && r.placeCandidates?.[0]) {
      patch.place = r.placeCandidates[0];
      aiFields.add("place");
    }

    const clientName = patch.clientName ?? m.clientName;
    const prev = previousMeeting(all, { id: m.id, clientName, heldOn: m.heldOn });
    if (m.round == null && clientName) {
      patch.round = nextRound(all, clientName, m.heldOn, m.id);
      aiFields.add("round");
    }

    // 参加者：AI抽出＋前回の参加者で補う
    const fromAi: Attendee[] = (r.attendees ?? []).map((a) => newAttendee(a.category, a.org, a.name, "ai"));
    for (const p of prev?.attendees ?? []) {
      const exists = fromAi.some((a) => a.category === p.category && (a.org === p.org || a.name === p.name));
      if (!exists) fromAi.push({ ...newAttendee(p.category, p.org, p.name, "ai") });
    }
    if (fromAi.length) {
      const own = fromAi.find((a) => a.category === "居宅介護支援");
      if (!own) fromAi.push(newAttendee("居宅介護支援", settings.officeName, settings.author, "ai"));
      patch.attendees = fromAi;
    }
    if (r.absentees) {
      patch.absentees = r.absentees;
      aiFields.add("absentees");
    }
    if (r.nextTiming) {
      patch.nextTiming = r.nextTiming;
      aiFields.add("nextTiming");
    }
    if (r.nextCondition) {
      patch.nextCondition = r.nextCondition;
      aiFields.add("nextCondition");
    }
    if (!m.author && settings.author) patch.author = settings.author;

    // 前回の宿題の引継ぎ
    const carry = carryoverFrom(prev);
    for (const c of r.carryover ?? []) {
      const row = carry[c.index];
      if (!row) continue;
      row.label = c.status;
      row.evidence = (c.evidence ?? [])
        .map((e) => seg.get(e))
        .filter((s): s is Segment => Boolean(s))
        .map((s) => ({ segmentId: s.id, start: s.start, end: s.end, text: s.text }));
    }

    return {
      ...patch,
      aiFields: [...aiFields],
      candidates,
      summary: toRows(r.summary, seg),
      topics: toRows(r.topics, seg),
      discussions: toRows(r.discussions, seg),
      decisions: toRows(r.decisions, seg),
      issues: toRows(r.issues, seg),
      carryover: carry.length ? carry : m.carryover,
      status: "draft",
      progress: { ...m.progress, classify: "done", message: undefined, percent: 100 },
      history: [...m.history, { at: new Date().toISOString(), action: "AI下書きを作成" }],
    };
  });
}

export async function classifyMeeting(id: string, onProgress: Progress) {
  const m = await getMeeting(id);
  if (!m) throw new Error("会議が見つかりません");
  const all = await listMeetings();
  const settings = await getSettings();
  const prev = previousMeeting(all, m);
  onProgress("AIが項目を整理しています（1〜2分）", 75);
  const { result } = await postJson<{ result: AiResult }>("/api/classify", {
    segments: m.transcript,
    context: {
      officeName: settings.officeName,
      recordedDate: m.heldOn,
      clientHint: m.clientName,
      clients: [...new Set([...settings.clients, ...all.map((x) => x.clientName).filter(Boolean)])],
      places: settings.places,
      glossary: settings.glossary,
      prevAttendees: prev?.attendees.map(({ category, org, name }) => ({ category, org, name })),
      prevIssues: carryoverFrom(prev).map((r) => r.body),
    },
  });
  return applyAiResult(id, result);
}

/** 録音ファイルから議事録の下書きまでを通しで行う */
export async function runPipeline(id: string, file: Blob, onProgress: Progress) {
  const settings = await getSettings();
  try {
    await update(id, (m) => ({ status: "processing", progress: { ...m.progress, transcribe: "running", classify: "pending" } }));
    const { segments, duration } = await transcribeAudio(file, settings.glossary, onProgress);
    await update(id, (m) => {
      // 終了時刻 = ファイル日時、開始時刻 = 終了 − 録音の長さ
      const { endTime } = m;
      let { startTime } = m;
      if (!startTime && endTime) {
        const [h, mi] = endTime.split(":").map(Number);
        const t = h * 60 + mi - Math.round(duration / 60);
        if (t >= 0) startTime = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
      }
      return {
        transcript: segments,
        startTime,
        endTime,
        aiFields: [...new Set([...m.aiFields, ...(startTime ? (["startTime", "endTime"] as BasicField[]) : [])])],
        progress: { ...m.progress, transcribe: "done", classify: "running" },
      };
    });
    await classifyMeeting(id, onProgress);
    onProgress("完了しました", 100);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await update(id, (m) => ({
      status: m.transcript.length ? "draft" : "processing",
      progress: {
        ...m.progress,
        transcribe: m.transcript.length ? "done" : "error",
        classify: m.transcript.length ? "error" : "pending",
        message,
      },
    }));
    throw e;
  }
}

export const MAX_RECOMMENDED_MIN = 90;
export const chunkSeconds = CHUNK_SEC;
