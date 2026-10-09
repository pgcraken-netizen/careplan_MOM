import type { Attendee, Meeting, Row, Segment } from "./types";

let n = 0;
const id = (p: string) => `${p}${++n}`;

const row = (label: string, body: string, ai = false, ev: Segment[] = []): Row => ({
  id: id("r"),
  label,
  body,
  origin: ai ? "ai" : "human",
  reviewed: !ai,
  evidence: ev.map((s) => ({ segmentId: s.id, start: s.start, end: s.end, text: s.text })),
});

const att = (category: string, org: string, name: string, ai = false): Attendee => ({
  id: id("a"),
  category,
  org,
  name,
  origin: ai ? "ai" : "human",
  reviewed: !ai,
});

/** 見本データ（実在の人物ではありません） */
export function sampleMeetings(): Meeting[] {
  const t1: Segment[] = [
    { id: "s1", start: 12, end: 25, text: "アソシエの佐藤です。本日は第3回の担当者会議になります。よろしくお願いします。" },
    { id: "s2", start: 95, end: 108, text: "できるだけ家で過ごしたいと思っています。" },
    { id: "s3", start: 140, end: 160, text: "仕事もあるので、日中のサポートが必要だと感じています。" },
    { id: "s4", start: 420, end: 445, text: "服薬の継続が大事なので、訪問看護を週2回に増やすのがよいと思います。" },
    { id: "s5", start: 754, end: 770, text: "家では転ばないように、手すりをつけてほしいです。" },
    { id: "s6", start: 900, end: 930, text: "住宅改修については、ご家族に検討していただくようお願いします。" },
  ];

  const confirmed: Meeting = {
    id: "sample-confirmed",
    sample: true,
    createdAt: "2026-10-09T02:00:00.000Z",
    updatedAt: "2026-10-09T05:00:00.000Z",
    status: "confirmed",
    progress: { transcribe: "done", classify: "done" },
    title: "要介護4認定後のケアプラン確認・在宅支援調整のための担当者会議",
    purpose: "利用者の生活機能の維持・向上と在宅生活の継続に向けた支援方針の確認",
    heldOn: "2026-10-09",
    startTime: "10:00",
    endTime: "11:30",
    place: "利用者宅",
    round: 3,
    clientName: "山田 ○○",
    author: "佐藤 △△（ケアマネジャー）",
    attendees: [
      att("本人", "利用者", "山田 ○○"),
      att("家族", "長男", "山田 □□"),
      att("居宅介護支援", "アソシエ", "佐藤 △△"),
      att("訪問看護", "○○訪問看護ステーション", "鈴木 ××"),
      att("福祉用具", "○○福祉用具", "高橋 ◇◇"),
    ],
    absentees: "次男（仕事のため欠席）→ 今後の介護保険サービスの利用意向を電話で確認",
    aiFields: [],
    candidates: {},
    summary: [
      row("決定", "訪問看護を週2回に増やす"),
      row("注意", "転倒リスクが高いため見守りを強化する"),
      row("宿題", "家族へ住宅改修の検討を依頼する"),
    ],
    topics: [
      row("全体・制度・計画", "介護保険サービスの見直し"),
      row("健康管理・医療連携", "血圧の管理方法、服薬状況"),
      row("移動・転倒予防", "自宅内の動線、福祉用具の活用"),
      row("家族支援・連絡体制", "家族への支援、緊急時の連絡体制"),
    ],
    discussions: [
      row("本人", "「できるだけ家で過ごしたい」", false, [t1[1]]),
      row("家族", "「仕事もあるのでサポートが必要」", false, [t1[2]]),
      row("ケアマネジャー", "「安全に生活できる環境を整えたい」"),
      row("訪問看護", "「服薬の継続が重要」", false, [t1[3]]),
    ],
    decisions: [
      row("支援方針", "在宅生活を継続し、訪問看護を週2回に増やす"),
      row("各サービス", "訪問看護：週2回　福祉用具：手すり設置"),
      row("連携", "家族と住宅改修の検討を進める"),
    ],
    issues: [
      row("注意", "転倒リスクのため見守りを強化する"),
      row("モニタリング点", "血圧・服薬状況の確認（1か月後）"),
      row("宿題", "家族へ住宅改修の検討を依頼する", false, [t1[5]]),
    ],
    nextTiming: "2026年12月（第4回）",
    nextCondition: "状態変化時は随時開催",
    carryover: [row("対応中", "住宅改修の検討（家族へ確認）"), row("次回確認", "服薬状況の確認")],
    notes:
      "今回の会議は録音データからAIが下書きを作成しました。\nすべての項目を確認・編集のうえ、確定しています。\n本議事録は第4表の様式に準拠しています。",
    transcript: t1,
    hasAudio: false,
    confirmedAt: "2026-10-09T05:00:00.000Z",
    history: [
      { at: "2026-10-09T02:00:00.000Z", action: "AI下書きを作成" },
      { at: "2026-10-09T05:00:00.000Z", action: "確定" },
    ],
  };

  const t2: Segment[] = [
    { id: "u1", start: 30, end: 48, text: "自分で歩きたいです。デイサービスは大丈夫です。" },
    { id: "u2", start: 120, end: 150, text: "退院した頃に比べると歩くのもトイレも良くなってきました。ただ夜中に何度もトイレに起きるのが心配です。" },
    { id: "u3", start: 300, end: 330, text: "デイは週2回を基本にして、慣れ具合や体調を見ながら調整していきましょう。" },
    { id: "u4", start: 480, end: 505, text: "夜間のトイレ移動が多いので、トイレ周りの手すりも状態に応じてご提案できます。" },
  ];

  const draft: Meeting = {
    id: "sample-draft",
    sample: true,
    createdAt: "2026-10-07T03:00:00.000Z",
    updatedAt: "2026-10-07T03:10:00.000Z",
    status: "draft",
    progress: { transcribe: "done", classify: "done" },
    title: "要介護認定後のケアプラン確認",
    purpose: "要介護認定後のケアプラン確認・在宅支援調整",
    heldOn: "2026-10-07",
    startTime: "14:00",
    endTime: "14:50",
    place: "利用者宅",
    round: 1,
    clientName: "見本 太郎",
    author: "",
    attendees: [
      att("本人", "利用者", "見本 太郎", true),
      att("家族", "妻", "見本 花子", true),
      att("居宅介護支援", "アソシエ", "", true),
      att("通所介護", "○○デイサービス", "", true),
      att("福祉用具", "○○福祉用具", "", true),
    ],
    absentees: "",
    aiFields: ["title", "purpose", "place", "round", "clientName"],
    candidates: { place: ["利用者宅", "事業所"], clientName: ["見本 太郎"] },
    summary: [
      row("決定", "通所介護は週2回を基本に、慣れ・体調を見ながら調整する", true, [t2[2]]),
      row("注意", "夜間のトイレ回数が多く、移動時の転倒リスクに注意する", true, [t2[1]]),
    ],
    topics: [
      row("移動・転倒予防", "歩行状態の改善状況、夜間の排泄時の安全", true, [t2[1]]),
      row("通所介護", "利用回数、利用への慣れ", true, [t2[2]]),
    ],
    discussions: [
      row("本人", "自分で歩きたいとの意向。通所介護については「大丈夫」と話している", true, [t2[0]]),
      row("家族", "歩行やトイレ動作は改善している一方、夜間の頻回なトイレを心配している", true, [t2[1]]),
      row("福祉用具", "夜間のトイレ移動が多いため、トイレ周りの手すりを状態に応じて提案可能", true, [t2[3]]),
    ],
    decisions: [row("通所介護", "週2回を基本に利用し、慣れ・体調を確認しながら調整する", true, [t2[2]])],
    issues: [row("注意", "夜間にトイレへ行く回数が多いため、移動時の転倒に注意する", true, [t2[1]])],
    nextTiming: "",
    nextCondition: "",
    carryover: [],
    notes: "",
    transcript: t2,
    hasAudio: false,
    history: [{ at: "2026-10-07T03:10:00.000Z", action: "AI下書きを作成（見本）" }],
  };

  return [confirmed, draft];
}
