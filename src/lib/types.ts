export type Origin = "ai" | "human";

export type MeetingStatus = "processing" | "draft" | "reviewing" | "confirmed";

export type StepState = "pending" | "running" | "done" | "error" | "skipped";

export interface Evidence {
  segmentId: string;
  start: number; // seconds
  end: number;
  text: string;
}

/** 本文セクションの1行（ラベル＋内容） */
export interface Row {
  id: string;
  label: string;
  body: string;
  origin: Origin;
  reviewed: boolean;
  evidence: Evidence[];
}

export interface Attendee {
  id: string;
  category: string; // 区分
  org: string; // 事業所・続柄等
  name: string; // 氏名
  origin: Origin;
  reviewed: boolean;
}

export interface Segment {
  id: string;
  start: number;
  end: number;
  text: string;
}

export interface HistoryEntry {
  at: string;
  action: string;
}

/** 基本情報のうちAIが補完したフィールド（未確認のもの） */
export type BasicField =
  | "title"
  | "purpose"
  | "heldOn"
  | "startTime"
  | "endTime"
  | "place"
  | "round"
  | "clientName"
  | "author"
  | "absentees"
  | "nextTiming"
  | "nextCondition";

export interface Meeting {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: MeetingStatus;
  sample?: boolean;
  progress: {
    transcribe: StepState;
    classify: StepState;
    message?: string;
    percent?: number;
  };

  // 基本情報
  title: string; // 会議名称
  purpose: string; // 会議目的
  heldOn: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  place: string;
  round: number | null;
  clientName: string;
  author: string; // 居宅サービス計画作成者
  attendees: Attendee[];
  absentees: string; // 欠席者と照会内容
  aiFields: BasicField[]; // AI補完で未確認のフィールド
  candidates: Partial<Record<BasicField, string[]>>; // 補完候補

  // 本文
  summary: Row[]; // 0 重要事項サマリー（決定/注意/宿題）
  topics: Row[]; // ① 検討した項目（分類｜検討事項）
  discussions: Row[]; // ② 検討内容（立場｜要点・心情）
  decisions: Row[]; // ③ 検討結果（区分｜決定事項）
  issues: Row[]; // ④ 今後の課題（注意/モニタリング点/宿題）
  nextTiming: string; // ⑤ 次回開催時期
  nextCondition: string;

  // 付帯情報
  carryover: Row[]; // 前回の宿題・モニタリング点の引継ぎ（label=対応状況）
  notes: string; // 備考

  transcript: Segment[];
  hasAudio: boolean;
  audioName?: string;
  confirmedAt?: string;
  history: HistoryEntry[];
}

export type SectionKey =
  | "summary"
  | "topics"
  | "discussions"
  | "decisions"
  | "issues"
  | "carryover";

export interface Settings {
  officeName: string;
  author: string;
  glossary: string; // 改行区切り
  places: string[];
  clients: string[];
  audioRetentionDays: number;
}

export interface AiStatus {
  transcribe: boolean;
  classify: boolean;
}
