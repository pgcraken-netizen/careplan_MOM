import type { SectionKey } from "./types";

export interface Tone {
  bg: string; // chip background
  fg: string; // chip text
  hex: { bg: string; fg: string }; // Word/Excel用
}

const t = (bg: string, fg: string): Tone => ({ bg, fg, hex: { bg, fg } });

export const TONES = {
  blue: t("#E3EEFC", "#2457A6"),
  red: t("#FCE6E2", "#B5402F"),
  green: t("#E2F4E6", "#2F7A43"),
  pink: t("#F6E6F3", "#8A3A7C"),
  purple: t("#ECE7FB", "#5B45B0"),
  amber: t("#FBF0D9", "#8A5A12"),
  teal: t("#DFF2F1", "#1E6E69"),
  gray: t("#EEF1F5", "#4A5568"),
} as const;

export type ToneKey = keyof typeof TONES;

/** ラベル→色。登録の無いラベルは順番に色を割り当てる */
const LABEL_TONES: Record<string, ToneKey> = {
  決定: "blue",
  注意: "red",
  宿題: "green",
  モニタリング点: "pink",
  本人: "blue",
  家族: "red",
  ケアマネジャー: "green",
  通所介護: "purple",
  訪問看護: "purple",
  訪問介護: "purple",
  福祉用具: "amber",
  "全体・制度・計画": "blue",
  "健康管理・医療連携": "purple",
  "移動・転倒予防": "green",
  "家族支援・連絡体制": "pink",
  支援方針: "blue",
  各サービス: "teal",
  連携: "amber",
  対応中: "amber",
  対応済み: "green",
  未対応: "red",
  次回確認: "gray",
};

const ROTATE: ToneKey[] = ["teal", "purple", "amber", "pink", "gray", "blue", "green"];

export function toneFor(label: string): Tone {
  const k = LABEL_TONES[label];
  if (k) return TONES[k];
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[ROTATE[h % ROTATE.length]];
}

export interface SectionDef {
  key: SectionKey;
  no: string; // 表示番号
  title: string;
  labelHeader: string;
  bodyHeader: string;
  options: string[];
  fixedOptions?: boolean; // 選択肢以外を使わない
  hint: string;
}

export const SECTIONS: SectionDef[] = [
  {
    key: "summary",
    no: "0",
    title: "重要事項サマリー",
    labelHeader: "種別",
    bodyHeader: "内容",
    options: ["決定", "注意", "宿題"],
    fixedOptions: true,
    hint: "③④から重要なものを抜き出したもの",
  },
  {
    key: "topics",
    no: "①",
    title: "検討した項目",
    labelHeader: "分類",
    bodyHeader: "検討事項",
    options: [
      "全体・制度・計画",
      "健康管理・医療連携",
      "移動・転倒予防",
      "通所介護",
      "福祉用具",
      "家族支援・連絡体制",
    ],
    hint: "会議で取り上げたテーマ",
  },
  {
    key: "discussions",
    no: "②",
    title: "検討内容（要点＋心情）",
    labelHeader: "立場",
    bodyHeader: "要点・心情",
    options: ["本人", "家族", "ケアマネジャー", "通所介護", "訪問看護", "福祉用具"],
    hint: "立場ごとの発言の要点。本人・家族の言葉は「」で残す",
  },
  {
    key: "decisions",
    no: "③",
    title: "検討結果（決定のみ）",
    labelHeader: "区分",
    bodyHeader: "決定事項",
    options: ["支援方針", "各サービス", "通所介護", "福祉用具", "連携"],
    hint: "会議で決まったことだけ",
  },
  {
    key: "issues",
    no: "④",
    title: "今後の課題",
    labelHeader: "分類",
    bodyHeader: "内容",
    options: ["注意", "モニタリング点", "宿題"],
    fixedOptions: true,
    hint: "残された課題・次回までの確認事項",
  },
  {
    key: "carryover",
    no: "",
    title: "前回の宿題・モニタリング点の引継ぎ",
    labelHeader: "対応状況",
    bodyHeader: "内容",
    options: ["対応中", "対応済み", "未対応", "次回確認"],
    fixedOptions: true,
    hint: "前回会議から引き継いだ項目",
  },
];

export const SECTION_BY_KEY = Object.fromEntries(SECTIONS.map((s) => [s.key, s])) as Record<
  SectionKey,
  SectionDef
>;

export const ATTENDEE_CATEGORIES = [
  "本人",
  "家族",
  "居宅介護支援",
  "通所介護",
  "訪問介護",
  "訪問看護",
  "福祉用具",
  "主治医",
  "その他",
];

export const DEFAULT_PLACES = ["利用者宅", "事業所", "通所介護事業所", "病院", "オンライン"];

export const STATUS_LABEL: Record<string, string> = {
  processing: "AI処理中",
  draft: "AI下書き",
  reviewing: "確認中",
  confirmed: "確定",
};
