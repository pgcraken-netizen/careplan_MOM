import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

/**
 * 90秒程度の WAV を1つ受け取り、OpenAI の文字起こしAPIに渡す。
 * 音声はこの関数の中で処理するだけで、どこにも保存しない。
 */
export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "OPENAI_API_KEY が設定されていません" }, { status: 503 });

  const form = await req.formData();
  const file = form.get("file");
  const offset = Number(form.get("offset") ?? 0);
  const prompt = String(form.get("prompt") ?? "").slice(0, 800);
  if (!(file instanceof Blob)) return NextResponse.json({ error: "音声がありません" }, { status: 400 });

  const body = new FormData();
  body.append("file", file, "chunk.wav");
  body.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1");
  body.append("language", "ja");
  body.append("response_format", "verbose_json");
  body.append("temperature", "0");
  if (prompt) body.append("prompt", prompt);

  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body,
    });
    if (res.ok || (res.status < 500 && res.status !== 429)) break;
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  if (!res || !res.ok) {
    const detail = res ? await res.text() : "no response";
    return NextResponse.json({ error: `文字起こしに失敗しました (${res?.status})`, detail: detail.slice(0, 300) }, { status: 502 });
  }

  const data = (await res.json()) as { text?: string; segments?: WhisperSegment[] };
  const segments = (data.segments ?? [{ start: 0, end: 0, text: data.text ?? "" }])
    .map((s) => ({ start: offset + s.start, end: offset + s.end, text: s.text.trim() }))
    .filter((s) => s.text && !/^(ご視聴ありがとうございました|チャンネル登録)/.test(s.text));

  return NextResponse.json({ segments });
}
