"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Play, Plus, Quote, Trash2, X } from "lucide-react";
import { AiMark, Chip } from "./ui";
import { clock } from "@/lib/format";
import { toneFor } from "@/lib/sections";
import type { SectionDef } from "@/lib/sections";
import type { Evidence, Row } from "@/lib/types";
import { newRow } from "@/lib/store";

export function AutoTextarea({
  value,
  onChange,
  className = "",
  placeholder,
  readOnly,
  minRows = 1,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`field ${readOnly ? "border-transparent bg-transparent px-0 focus:ring-0" : ""} ${className}`}
    />
  );
}

export function EvidenceButton({
  evidence,
  onPlay,
  canPlay,
}: {
  evidence: Evidence[];
  onPlay: (sec: number) => void;
  canPlay: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  if (!evidence.length) return null;
  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="根拠の発言"
        className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand hover:bg-brand hover:text-white"
      >
        {canPlay ? <Play size={15} fill="currentColor" /> : <Quote size={15} />}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-20 w-[min(340px,80vw)] rounded-xl border border-line bg-white p-3 shadow-xl">
          <p className="mb-2 text-xs font-bold text-ink-soft">根拠となった発言</p>
          <ul className="space-y-2">
            {evidence.map((e) => (
              <li key={e.segmentId} className="flex gap-2">
                <button
                  type="button"
                  disabled={!canPlay}
                  onClick={() => onPlay(e.start)}
                  className="h-fit shrink-0 rounded bg-brand-soft px-1.5 py-0.5 font-mono text-[11px] text-brand disabled:opacity-60"
                >
                  {canPlay ? "▶ " : ""}
                  {clock(e.start)}
                </button>
                <span className="text-[13px] leading-relaxed">「{e.text}」</span>
              </li>
            ))}
          </ul>
          {!canPlay && <p className="mt-2 text-[11px] text-ink-faint">音声が無いため再生できません（削除済みまたは見本）</p>}
        </div>
      )}
    </div>
  );
}

function LabelInput({
  def,
  value,
  onChange,
  readOnly,
}: {
  def: SectionDef;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  const t = toneFor(value);
  if (readOnly) return <Chip label={value} className="mt-2" />;
  if (def.fixedOptions) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border-0 px-2 text-[13px] font-bold outline-none ring-1 ring-black/5"
        style={{ background: t.bg, color: t.fg }}
      >
        {!def.options.includes(value) && <option value={value}>{value || "選択"}</option>}
        {def.options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  }
  return (
    <>
      <input
        list={`opts-${def.key}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={def.labelHeader}
        className="h-9 w-full rounded-lg border-0 px-2 text-[13px] font-bold outline-none ring-1 ring-black/5 sm:w-44"
        style={{ background: t.bg, color: t.fg }}
      />
      <datalist id={`opts-${def.key}`}>
        {def.options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}

export function RowsEditor({
  def,
  rows,
  onChange,
  onPlay,
  canPlay,
  readOnly,
}: {
  def: SectionDef;
  rows: Row[];
  onChange: (rows: Row[]) => void;
  onPlay: (sec: number) => void;
  canPlay: boolean;
  readOnly?: boolean;
}) {
  const set = (i: number, patch: Partial<Row>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch, reviewed: patch.reviewed ?? true } : r)));
  const move = (i: number, d: number) => {
    const next = [...rows];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };
  const unreviewed = rows.filter((r) => r.origin === "ai" && !r.reviewed).length;

  return (
    <section className="rounded-2xl border border-line bg-white">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        {def.no && (
          <span className="grid h-7 min-w-7 place-items-center rounded-full bg-navy px-1.5 text-[13px] font-bold text-white">
            {def.no === "0" ? "0" : def.no}
          </span>
        )}
        <h3 className="flex-1 font-round text-[17px] font-extrabold text-navy">{def.title}</h3>
        {!readOnly && unreviewed > 0 && (
          <button
            type="button"
            onClick={() => onChange(rows.map((r) => ({ ...r, reviewed: true })))}
            className="shrink-0 rounded-full bg-ai px-3 py-1 text-[12px] font-bold text-ai-ink hover:brightness-95"
          >
            すべて確認（{unreviewed}）
          </button>
        )}
      </header>
      <p className="px-4 pt-2 text-[12px] text-ink-faint">
        {def.labelHeader}｜{def.bodyHeader}　—　{def.hint}
      </p>
      <ul className="divide-y divide-line/70">
        {rows.length === 0 && (
          <li className="px-4 py-4 text-sm text-ink-faint">{readOnly ? "記載なし" : "該当する発言なし。必要なら行を追加してください。"}</li>
        )}
        {rows.map((r, i) => {
          const pending = r.origin === "ai" && !r.reviewed;
          return (
            <li key={r.id} className={`px-4 py-3 ${pending ? "bg-ai/45" : ""}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="flex items-center gap-2 sm:w-48 sm:shrink-0 sm:pt-0.5">
                  <LabelInput def={def} value={r.label} readOnly={readOnly} onChange={(v) => set(i, { label: v })} />
                  {pending && <AiMark />}
                </div>
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <AutoTextarea
                    value={r.body}
                    readOnly={readOnly}
                    onChange={(v) => set(i, { body: v })}
                    placeholder={def.bodyHeader}
                    className={`min-w-0 flex-1 py-1.5 text-[15px] ${pending ? "bg-white/70" : ""}`}
                  />
                  <EvidenceButton evidence={r.evidence} onPlay={onPlay} canPlay={canPlay} />
                </div>
              </div>
              {!readOnly && (
                <div className="mt-2 flex items-center gap-1 text-ink-faint sm:pl-[200px]">
                  {pending ? (
                    <button
                      type="button"
                      onClick={() => set(i, { reviewed: true })}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-ai-ink ring-1 ring-ai-ink/30 hover:bg-ai"
                    >
                      <Check size={14} />
                      確認した
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1 text-[12px] text-green-700">
                      <Check size={14} />
                      {r.origin === "ai" ? "確認済み" : "手入力"}
                    </span>
                  )}
                  <span className="flex-1" />
                  <IconBtn label="上へ" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={16} />
                  </IconBtn>
                  <IconBtn label="下へ" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown size={16} />
                  </IconBtn>
                  <IconBtn label="削除" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                    <Trash2 size={16} />
                  </IconBtn>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!readOnly && (
        <div className="px-4 pb-4 pt-1">
          <button
            type="button"
            onClick={() => onChange([...rows, newRow(def.fixedOptions ? def.options[0] : "", "")])}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[14px] font-bold text-brand hover:bg-brand-soft"
          >
            <Plus size={17} />
            行を追加
          </button>
        </div>
      )}
    </section>
  );
}

export function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** AI補完された基本情報フィールドの枠 */
export function Field({
  label,
  required,
  ai,
  onConfirm,
  candidates,
  onPick,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  ai?: boolean;
  onConfirm?: () => void;
  candidates?: string[];
  onPick?: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${className}`}>
      <div className="mb-1 flex items-center gap-1.5 text-[13px] font-bold text-ink-soft">
        {label}
        {required && <span className="text-[11px] text-red-500">必須</span>}
        {ai && <AiMark small />}
        {ai && onConfirm && (
          <button type="button" onClick={onConfirm} className="ml-auto text-[11px] font-bold text-ai-ink hover:underline">
            確認した
          </button>
        )}
      </div>
      <div className={ai ? "rounded-lg ring-2 ring-ai" : ""}>{children}</div>
      {candidates && candidates.length > 0 && onPick && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {candidates.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onPick(c)}
              className="rounded-full border border-line bg-white px-2.5 py-0.5 text-[12px] hover:border-brand hover:text-brand"
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full max-w-lg overflow-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center">
          <h3 className="flex-1 font-round text-lg font-extrabold text-navy">{title}</h3>
          <IconBtn label="閉じる" onClick={onClose}>
            <X size={18} />
          </IconBtn>
        </div>
        {children}
      </div>
    </div>
  );
}
