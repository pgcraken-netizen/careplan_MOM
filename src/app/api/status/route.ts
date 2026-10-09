import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    transcribe: Boolean(process.env.OPENAI_API_KEY),
    classify: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}
