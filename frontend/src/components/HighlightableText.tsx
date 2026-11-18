import { useRef } from 'react';
import { Platform, Text } from 'react-native';

export type HighlightColor = 'amber' | 'emerald' | 'rose';

export interface HighlightRange {
  start: number;
  end: number;
  color: HighlightColor;
}

const COLOR_CLASSES: Record<HighlightColor, string> = {
  amber: 'bg-amber-200 text-stone-900 rounded',
  emerald: 'bg-emerald-200 text-stone-900 rounded',
  rose: 'bg-rose-200 text-stone-900 rounded',
};

interface HighlightableTextProps {
  text: string;
  ranges: HighlightRange[];
  enabled: boolean;
  activeColor: HighlightColor;
  onAddRange: (range: HighlightRange) => void;
  onRemoveRange: (index: number) => void;
  textClassName?: string;
}

export function HighlightableText({
  text,
  ranges,
  enabled,
  activeColor,
  onAddRange,
  onRemoveRange,
  textClassName = 'text-stone-900 dark:text-slate-100',
}: HighlightableTextProps) {
  const containerRef = useRef<HTMLSpanElement | null>(null);

  // En Web soporta selección de texto con mouse igual que la versión original
  if (Platform.OS === 'web') {
    const handleMouseUp = () => {
      if (!enabled || !containerRef.current || typeof window === 'undefined') return;
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
      if (start > cursor) parts.push(text.slice(cursor, start));

      parts.push(
        <mark
          key={`${r.originalIndex}-${start}-${end}`}
          onClick={(e) => {
            if (!enabled) return;
            e.stopPropagation();
            onRemoveRange(r.originalIndex);
          }}
          title={enabled ? 'Clic para quitar subrayado' : undefined}
          className={`${COLOR_CLASSES[r.color]} px-0.5 ${
            enabled ? 'cursor-pointer hover:opacity-75 transition-opacity' : ''
          }`}
        >
          {text.slice(start, end)}
        </mark>
      );
      cursor = end;
    }

    if (cursor < text.length) parts.push(text.slice(cursor));

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

  // En Android/iOS: cuando está activo el subrayador, cada palabra se puede tocar para subrayar o quitar
  if (!enabled && ranges.length === 0) {
    return <Text className={textClassName}>{text}</Text>;
  }

  const tokens = text.split(/(\s+)/);
  let offset = 0;

  return (
    <Text className={textClassName}>
      {tokens.map((tok, idx) => {
        const start = offset;
        const end = start + tok.length;
        offset = end;

        if (!tok.trim()) {
          return tok;
        }

        const matchedIdx = ranges.findIndex(
          (r) => start < r.end && end > r.start
        );
        const matched = matchedIdx >= 0 ? ranges[matchedIdx] : null;

        return (
          <Text
            key={`${idx}-${start}`}
            onPress={
              enabled
                ? () => {
                    if (matchedIdx >= 0) {
                      onRemoveRange(matchedIdx);
                    } else {
                      onAddRange({ start, end, color: activeColor });
                    }
                  }
                : undefined
            }
            className={matched ? COLOR_CLASSES[matched.color] : undefined}
          >
            {tok}
          </Text>
        );
      })}
    </Text>
  );
}
