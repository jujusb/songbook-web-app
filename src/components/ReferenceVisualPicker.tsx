"use client";

import { useMemo, useRef, useState } from "react";
import { buildSectionSpans, sectionForLine } from "@/lib/chordpro/visual-parse";
import { renderVisualChordSheet } from "@/lib/chordpro/visual-render";

interface ReferenceLocation {
  line?: number;
  verse?: string;
  chorus?: string;
  highlight?: string;
  highlights?: Record<string, string>;
}

interface Reference {
  type: string;
  label: string;
  target: string;
  line?: number;
  verse?: string;
  chorus?: string;
  text?: string;
  texts?: Record<string, string>;
  highlight?: string;
  highlights?: Record<string, string>;
  locations?: ReferenceLocation[];
}

interface Pick {
  lineIndex: number;
  section: { type: string; label: string } | null;
  highlight: string;
  range?: { line: number; start: number; end: number };
}

const REF_TYPES = ["link", "song", "text", "bible"];

export function ReferenceVisualPicker({
  source,
  refs,
  lang,
  languages,
  onAddLocationToRef,
  onAddNewRef,
}: {
  source: string;
  refs: Reference[];
  lang: string;
  languages: string[];
  onAddLocationToRef: (refIndex: number, loc: ReferenceLocation) => void;
  onAddNewRef: (ref: Reference) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [targetIdx, setTargetIdx] = useState(-1);
  const [cloneIdx, setCloneIdx] = useState(-1);
  const [draft, setDraft] = useState({
    type: "link",
    label: "",
    target: "",
    text: "",
  });
  const [applied, setApplied] = useState("");
  const [action, setAction] = useState<"add" | "create">("add");

  const spans = useMemo(() => buildSectionSpans(source), [source]);

  const html = useMemo(
    () =>
      renderVisualChordSheet(source, {
        dataContentLine: true,
        highlightRange: pick?.range,
      }),
    [source, pick]
  );

  const buildLocation = (p: Pick): ReferenceLocation => {
    const loc: ReferenceLocation = { line: p.lineIndex };
    if (p.section?.type === "verse") loc.verse = p.section.label;
    else if (p.section?.type === "chorus") loc.chorus = p.section.label;
    const hl = p.highlight.trim();
    if (hl) {
      loc.highlight = hl;
      loc.highlights = { [lang]: hl };
    }
    return loc;
  };

  const langBadge = (r: Reference): string => {
    const found = new Set<string>();
    if (r.texts) Object.keys(r.texts).forEach((l) => found.add(l));
    if (r.highlights) Object.keys(r.highlights).forEach((l) => found.add(l));
    for (const loc of r.locations || []) {
      if (loc.highlights) Object.keys(loc.highlights).forEach((l) => found.add(l));
    }
    const known = languages.filter((l) => found.has(l));
    return known.length > 0 ? ` [${known.join(", ")}]` : "";
  };

  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (!sel) return;
    const text = sel.toString();
    if (!text || !text.trim()) return;
    if (!containerRef.current || !containerRef.current.contains(sel.anchorNode)) return;
    const lineEl =
      (sel.anchorNode?.parentElement ?? null)?.closest?.(".vce-line") ?? null;
    if (!lineEl) return;
    const lineIndex = Number(lineEl.getAttribute("data-content-line"));
    if (Number.isNaN(lineIndex)) return;
    const lyricsEl = lineEl.querySelector(".vce-lyrics-text");
    const lineText = lyricsEl?.textContent || "";
    const trimmed = text.trim();
    const s = lineText.indexOf(trimmed);
    setPick({
      lineIndex,
      section: sectionForLine(spans, lineIndex),
      highlight: trimmed,
      range:
        s >= 0 ? { line: lineIndex, start: s, end: s + trimmed.length } : undefined,
    });
    setTargetIdx(-1);
    setApplied("");
  };

  const handleLineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const lineEl = target.closest?.(".vce-line") ?? null;
    if (!lineEl) return;
    const lineIndex = Number(lineEl.getAttribute("data-content-line"));
    if (Number.isNaN(lineIndex)) return;
    const sel = window.getSelection();
    // A drag selection just happened (mouseup runs before click) — keep it.
    if (
      sel &&
      sel.toString() &&
      containerRef.current &&
      containerRef.current.contains(sel.anchorNode)
    ) {
      return;
    }
    setPick({
      lineIndex,
      section: sectionForLine(spans, lineIndex),
      highlight: "",
      range: undefined,
    });
    setTargetIdx(-1);
    setApplied("");
  };

  const handlePickClone = (i: number) => {
    setCloneIdx(i);
    if (i >= 0) {
      const r = refs[i];
      setDraft({
        type: r.type,
        label: r.label,
        target: r.target,
        text: r.text || "",
      });
    } else {
      setDraft({ type: "link", label: "", target: "", text: "" });
    }
  };

  const handleAddLocation = () => {
    if (!pick || targetIdx < 0) return;
    const loc = buildLocation(pick);
    const target = refs[targetIdx];
    const already =
      target?.label ||
      `ref #${targetIdx + 1}`;
    const exists = (target?.locations || []).some((l) => l.line === loc.line);
    if (exists) {
      setApplied(`Already in \u00bb ${already} \u2014 same line`);
      setTargetIdx(-1);
      return;
    }
    onAddLocationToRef(targetIdx, loc);
    setApplied(`Added to \u00bb ${already} \u2022 remember to Save`);
    setTargetIdx(-1);
  };

  const handleCreate = () => {
    if (!pick) return;
    const loc = buildLocation(pick);
    const base: Reference = {
      type: draft.type,
      label: draft.label,
      target: draft.target,
      text: draft.text || undefined,
    };
    if (cloneIdx >= 0) {
      const clone = refs[cloneIdx];
      base.texts = clone.texts;
      base.highlight = clone.highlight;
      base.highlights = clone.highlights;
    }
    onAddNewRef({ ...base, locations: [loc] });
    setApplied(
      `Created \u00bb ${draft.label || draft.type} \u2022 remember to Save`
    );
    setCloneIdx(-1);
    setDraft({ type: "link", label: "", target: "", text: "" });
  };

  const inputCls =
    "w-full text-sm border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 bg-transparent";
  const labelCls = "block text-xs text-neutral-500 mb-0.5";
  const selectCls =
    "w-full text-sm border border-neutral-300 dark:border-neutral-700 rounded px-1 py-1 bg-transparent";

  return (
    <div className="flex flex-col md:flex-row gap-4 p-5 overflow-auto">
      {/* Interactive sheet */}
      <div className="flex-1 min-w-0 border border-neutral-200 dark:border-neutral-800 rounded-lg p-2 max-h-[62vh] overflow-auto">
        <div
          ref={containerRef}
          className="visual-chord-editor visual-chord-sheet ref-picker"
          dangerouslySetInnerHTML={{ __html: html }}
          onMouseUp={handleMouseUp}
          onClick={handleLineClick}
        />
      </div>

      {/* Side panel */}
      <div className="w-full md:w-80 shrink-0 space-y-3">
        {/* Selection summary */}
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 space-y-2">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
            Selection
          </div>
          {!pick ? (
            <p className="text-xs text-neutral-400 leading-relaxed">
              Click a lyric line to anchor the reference, then drag over a part
              of that line to capture it as the highlight.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono">
                  Line {pick.lineIndex}
                </span>
                {pick.section && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-mono">
                    {pick.section.label}
                  </span>
                )}
              </div>
              <div>
                <label className={labelCls}>Highlight</label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={pick.highlight}
                    onChange={(e) =>
                      setPick({ ...pick, highlight: e.target.value, range: undefined })
                    }
                    className={inputCls}
                    placeholder="selected part of the line"
                  />
                  {pick.highlight && (
                    <button
                      type="button"
                      onClick={() =>
                        setPick({ ...pick, highlight: "", range: undefined })
                      }
                      className="text-xs text-neutral-400 hover:text-neutral-600 px-1"
                      title="Clear"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
              {applied && (
                <p className="text-xs text-green-600 dark:text-green-400">{applied}</p>
              )}
            </>
          )}
        </div>

        {/* Action selector */}
        <div className="grid grid-cols-2 gap-1 p-1 border border-neutral-200 dark:border-neutral-800 rounded-lg">
          <button
            type="button"
            onClick={() => setAction("add")}
            className={`text-xs px-2 py-1.5 rounded transition-colors ${
              action === "add"
                ? "bg-blue-600 text-white font-semibold"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            Add to existing
          </button>
          <button
            type="button"
            onClick={() => setAction("create")}
            className={`text-xs px-2 py-1.5 rounded transition-colors ${
              action === "create"
                ? "bg-blue-600 text-white font-semibold"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            Create new
          </button>
        </div>

        {/* Add to existing */}
        {action === "add" && (
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 space-y-2">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
              Add to existing reference
            </div>
            <select
              value={targetIdx}
              onChange={(e) =>
                setTargetIdx(e.target.value ? Number(e.target.value) : -1)
              }
              className={selectCls}
            >
              <option value={-1}>&mdash; blank &mdash;</option>
              {refs.map((r, i) => (
                <option key={i} value={i}>
                  {`${r.type} \u2014 ${r.label || "(no label)"}`}
                  {langBadge(r)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!pick || targetIdx < 0}
              onClick={handleAddLocation}
              className="w-full text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              + Add location
            </button>
          </div>
        )}

        {/* Create new */}
        {action === "create" && (
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 space-y-2">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
              Create new reference
            </div>
            <div>
              <label className={labelCls}>Copy from</label>
              <select
                value={cloneIdx}
                onChange={(e) =>
                  handlePickClone(e.target.value ? Number(e.target.value) : -1)
                }
                className={selectCls}
              >
                <option value={-1}>&mdash; blank &mdash;</option>
                {refs.map((r, i) => (
                  <option key={i} value={i}>
                    {`${r.type} \u2014 ${r.label || "(no label)"}`}
                  </option>
                ))}
              </select>
            </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Type</label>
              <select
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                className={selectCls}
              >
                {REF_TYPES.map((rt) => (
                  <option key={rt} value={rt}>
                    {rt.charAt(0).toUpperCase() + rt.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Label</label>
              <input
                type="text"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Target</label>
            <input
              type="text"
              value={draft.target}
              onChange={(e) => setDraft({ ...draft, target: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Text (default)</label>
            <textarea
              rows={2}
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              className={`${inputCls} resize-none`}
            />
          </div>
          <button
            type="button"
            disabled={!pick}
            onClick={handleCreate}
            className="w-full text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            Create reference
          </button>
        </div>
        )}
      </div>
    </div>
  );
}