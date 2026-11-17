import { useRef } from 'react';

export type HighlightColor = 'amber' | 'emerald' | 'rose';

export interface HighlightRange {
  start: number;
  end: number;
  color: HighlightColor;
}

const COLOR_CLASSES: Record<HighlightColor, string> = {
  amber: 'bg-amber-200/85 text-stone-900 rounded px-0.5',
  emerald: 'bg-emerald-200/85 text-stone-900 rounded px-0.5',
  rose: 'bg-rose-200/85 text-stone-900 rounded px-0.5',
};

interface HighlightableTextProps {
  text: string;
  ranges: HighlightRange[];
  enabled: boolean;
  activeColor: HighlightColor;
  onAddRange: (range: HighlightRange) => void;
  onRemoveRange: (index: number) => void;
}

export function HighlightableText({
  text,
  ranges,
  enabled,
  activeColor,
  onAddRange,
  onRemoveRange,
}: HighlightableTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);

  const handleMouseUp = () => {
    if (!enabled || !containerRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    if (
      !containerRef.current.contains(range.startContainer) ||
      !containerRef.current.contains(range.endContainer)
    ) {
      return;
    }

    const preRange = document.createRange();
    preRange.selectNodeContents(containerRef.current);
    preRange.setEnd(range.startContainer, range.startOffset);
    const start = preRange.toString().length;
    const selectedText = range.toString();
    const end = start + selectedText.length;

    if (end > start && selectedText.trim().length > 0) {
      onAddRange({ start, end, color: activeColor });
      sel.removeAllRanges();
    }
  };

  // Ordenar rangos y evitar solapamientos al renderizar
  const indexed = ranges
    .map((r, originalIndex) => ({ ...r, originalIndex }))
    .filter((r) => r.start >= 0 && r.end > r.start && r.start < text.length)
    .sort((a, b) => a.start - b.start);

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const r of indexed) {
    const start = Math.max(cursor, r.start);
    const end = Math.min(text.length, r.end);
    if (end <= start) continue;

    if (start > cursor) {
      parts.push(text.slice(cursor, start));
    }

    parts.push(
      <mark
        key={`${r.originalIndex}-${start}-${end}`}
        onClick={(e) => {
          if (!enabled) return;
          e.stopPropagation();
          onRemoveRange(r.originalIndex);
        }}
        title={enabled ? 'Clic para quitar subrayado' : undefined}
        className={`${COLOR_CLASSES[r.color]} ${
          enabled ? 'cursor-pointer hover:opacity-75 transition-opacity' : ''
        }`}
      >
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return (
    <span
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className={enabled ? 'select-text cursor-text' : undefined}
    >
      {parts.length > 0 ? parts : text}
    </span>
  );
}
