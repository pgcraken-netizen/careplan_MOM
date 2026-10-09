"use client";

import { createStore, del, entries, get, set } from "idb-keyval";
import type { Attendee, Meeting, Row, Settings } from "./types";
import { DEFAULT_PLACES } from "./sections";
import { sampleMeetings } from "./sample";

/*
 * 端末内（IndexedDB）にデータを保存する。
 * 音声はサーバーに置かず、この端末の中だけに保存する。
 * 将来 Supabase に移す場合は、このファイルの関数の中身だけを差し替える。
 */

const meetingStore = () => createStore("careplan-mom", "meetings");
const audioStore = () => createStore("careplan-mom-audio", "audio");
const settingsStore = () => createStore("careplan-mom-settings", "settings");

const SEEDED_KEY = "seeded-v1";

export const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
  ).slice(0, 12);

export const nowIso = () => new Date().toISOString();

export function newRow(label = "", body = "", origin: Row["origin"] = "human"): Row {
  return { id: uid(), label, body, origin, reviewed: origin === "human", evidence: [] };
}

export function newAttendee(category = "", org = "", name = "", origin: Attendee["origin"] = "human"): Attendee {
  return { id: uid(), category, org, name, origin, reviewed: origin === "human" };
}

export const DEFAULT_SETTINGS: Settings = {
  officeName: "アソシエ",
  author: "",
  glossary: "アソシエ\nそよ風西川田\nダスキンヘルスレント",
  places: DEFAULT_PLACES,
  clients: [],
  audioRetentionDays: 30,
};

export async function getSettings(): Promise<Settings> {
  const s = (await get("settings", settingsStore())) as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export async function saveSettings(s: Settings) {
  await set("settings", s, settingsStore());
}

async function seedIfNeeded() {
  const seeded = await get(SEEDED_KEY, settingsStore());
  if (seeded) return;
  for (const m of sampleMeetings()) await set(m.id, m, meetingStore());
  await set(SEEDED_KEY, true, settingsStore());
}

export async function listMeetings(): Promise<Meeting[]> {
  await seedIfNeeded();
  const all = (await entries(meetingStore())).map(([, v]) => v as Meeting);
  return all.sort((a, b) =>
    (b.heldOn + b.startTime + b.createdAt).localeCompare(a.heldOn + a.startTime + a.createdAt),
  );
}

export async function getMeeting(id: string): Promise<Meeting | undefined> {
  await seedIfNeeded();
  return (await get(id, meetingStore())) as Meeting | undefined;
}

export async function saveMeeting(m: Meeting) {
  const next = { ...m, updatedAt: nowIso() };
  await set(m.id, next, meetingStore());
  return next;
}

export async function deleteMeeting(id: string) {
  await del(id, meetingStore());
  await del(id, audioStore());
}

export async function saveAudio(id: string, blob: Blob) {
  await set(id, blob, audioStore());
}

export async function getAudio(id: string): Promise<Blob | undefined> {
  return (await get(id, audioStore())) as Blob | undefined;
}

export async function deleteAudio(id: string) {
  await del(id, audioStore());
}

/** 確定から保持日数を過ぎた音声を削除する */
export async function purgeExpiredAudio() {
  const s = await getSettings();
  const limit = Date.now() - s.audioRetentionDays * 86400_000;
  const all = await listMeetings();
  for (const m of all) {
    if (m.hasAudio && m.confirmedAt && Date.parse(m.confirmedAt) < limit) {
      await deleteAudio(m.id);
      await saveMeeting({ ...m, hasAudio: false });
    }
  }
}

export function emptyMeeting(partial: Partial<Meeting> = {}): Meeting {
  const now = nowIso();
  return {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    status: "draft",
    progress: { transcribe: "skipped", classify: "skipped" },
    title: "",
    purpose: "",
    heldOn: now.slice(0, 10),
    startTime: "",
    endTime: "",
    place: "",
    round: null,
    clientName: "",
    author: "",
    attendees: [newAttendee("本人", "利用者"), newAttendee("家族"), newAttendee("居宅介護支援", "アソシエ")],
    absentees: "",
    aiFields: [],
    candidates: {},
    summary: [],
    topics: [],
    discussions: [],
    decisions: [],
    issues: [],
    nextTiming: "",
    nextCondition: "",
    carryover: [],
    notes: "",
    transcript: [],
    hasAudio: false,
    history: [{ at: now, action: "作成" }],
    ...partial,
  };
}

/** 同じ利用者の前回会議（確定済み優先） */
export function previousMeeting(all: Meeting[], m: Pick<Meeting, "id" | "clientName" | "heldOn">) {
  if (!m.clientName) return undefined;
  return all
    .filter((x) => x.id !== m.id && x.clientName === m.clientName && x.heldOn <= m.heldOn)
    .sort((a, b) => b.heldOn.localeCompare(a.heldOn))[0];
}

/** 前回の宿題・モニタリング点を引継ぎ行にする */
export function carryoverFrom(prev: Meeting | undefined): Row[] {
  if (!prev) return [];
  return prev.issues
    .filter((r) => r.label === "宿題" || r.label === "モニタリング点")
    .map((r) => ({ ...newRow("次回確認", r.body, "ai"), reviewed: false }));
}

export function nextRound(all: Meeting[], clientName: string, heldOn: string, selfId?: string) {
  if (!clientName) return null;
  return all.filter((x) => x.id !== selfId && x.clientName === clientName && x.heldOn < heldOn).length + 1;
}
