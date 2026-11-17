import { useEffect, useState } from 'react';
import { BookOpen, PlayCircle, Search } from 'lucide-react';
import { api } from '../lib/api';
import type { Guia } from '../types/egel';

interface GuiasProps {
  initialClave?: string;
  onPracticeSubarea: (subarea: string) => void;
}

function renderInline(text: string): React.ReactNode[] {
  // Soporta `code`, **bold**, *italic*
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith('`') && tok.endsWith('`')) {
      return (
        <code
          key={i}
          className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[12px] text-teal-800 border border-stone-200"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    if (tok.startsWith('**') && tok.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-stone-900">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith('*') && tok.endsWith('*')) {
      return (
        <em key={i} className="italic text-stone-700">
          {tok.slice(1, -1)}
        </em>
      );
    }
    return tok;
  });
}

function MarkdownView({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Tabla Markdown
    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
      const headers = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(
          lines[i]
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim())
        );
        i++;
      }
      blocks.push(
        <div key={`tbl-${i}`} className="my-4 overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-stone-100 text-stone-800">
              <tr>
                {headers.map((h, idx) => (
                  <th key={idx} className="px-3.5 py-2.5 font-semibold border-b border-stone-200">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-white">
              {rows.map((r, rIdx) => (
                <tr key={rIdx} className="hover:bg-stone-50">
                  {r.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3.5 py-2.5 text-stone-700 align-top">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (line.startsWith('# ')) {
      blocks.push(
        <h1 key={i} className="text-2xl font-bold text-stone-900 mb-3">
          {renderInline(line.slice(2))}
        </h1>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <h2
          key={i}
          className="mt-6 mb-2.5 text-lg font-bold text-teal-800 border-b border-stone-200 pb-1"
        >
          {renderInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push(
        <h3 key={i} className="mt-4 mb-2 text-base font-bold text-stone-900">
          {renderInline(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith('> ')) {
      blocks.push(
        <blockquote
          key={i}
          className="my-3 rounded-r-xl border-l-4 border-amber-500 bg-amber-50/70 px-4 py-3 text-sm text-stone-800"
        >
          {renderInline(line.slice(2))}
        </blockquote>
      );
      i++;
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-2.5 list-disc pl-5 space-y-1.5 text-sm text-stone-700">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ul>
      );
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="my-2.5 list-decimal pl-5 space-y-1.5 text-sm text-stone-700">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ol>
      );
      continue;
    }

    blocks.push(
      <p key={i} className="my-2 text-sm text-stone-700 leading-relaxed">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div>{blocks}</div>;
}

export function Guias({ initialClave, onPracticeSubarea }: GuiasProps) {
  const [guias, setGuias] = useState<Guia[]>([]);
  const [activa, setActiva] = useState<string>(initialClave || 'estrategias');
  const [filtro, setFiltro] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getGuias()
      .then((res) => {
        setGuias(res.guias);
        if (!initialClave && res.guias.length > 0) {
          setActiva(res.guias[0].clave);
        }
      })
      .finally(() => setLoading(false));
  }, [initialClave]);

  useEffect(() => {
    if (initialClave) setActiva(initialClave);
  }, [initialClave]);

  const filtradas = guias.filter((g) =>
    (g.titulo + ' ' + g.clave).toLowerCase().includes(filtro.toLowerCase())
  );

  const guiaActual = guias.find((g) => g.clave === activa) ?? filtradas[0];
  const esSubarea = guiaActual && /^\d\.\d$/.test(guiaActual.clave);

  return (
    <div className="grid gap-6 lg:grid-cols-[290px_1fr]">
      {/* Índice lateral */}
      <aside className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm h-fit lg:sticky lg:top-20">
        <div className="flex items-center gap-2 text-sm font-bold text-stone-900 mb-3">
          <BookOpen className="h-4 w-4 text-teal-700" />
          Guías de Estudio ({guias.length})
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
          <input
            type="text"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar guía..."
            className="w-full rounded-xl border border-stone-200 bg-stone-50 pl-8 pr-3 py-1.5 text-xs text-stone-800 focus:border-teal-600 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="space-y-1 max-h-[65vh] overflow-y-auto pr-1">
          {filtradas.map((g) => (
            <button
              key={g.clave}
              type="button"
              onClick={() => setActiva(g.clave)}
              className={`w-full rounded-xl px-3 py-2 text-left text-xs transition cursor-pointer ${
                g.clave === guiaActual?.clave
                  ? 'bg-teal-700 text-white font-semibold shadow-sm'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              {g.titulo}
            </button>
          ))}
        </div>
      </aside>

      {/* Contenido de la guía */}
      <article className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 shadow-sm min-h-[500px]">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-7 w-2/3 rounded bg-stone-200" />
            <div className="h-4 w-full rounded bg-stone-100" />
            <div className="h-4 w-5/6 rounded bg-stone-100" />
          </div>
        ) : guiaActual ? (
          <>
            {esSubarea && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-700/20 bg-teal-50/70 px-4 py-3">
                <span className="text-xs font-medium text-teal-900">
                  ¿Ya repasaste esta subárea? Ponla a prueba con reactivos reales.
                </span>
                <button
                  type="button"
                  onClick={() => onPracticeSubarea(guiaActual.clave)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 transition cursor-pointer"
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  Practicar subárea {guiaActual.clave}
                </button>
              </div>
            )}
            <MarkdownView content={guiaActual.contenido} />
          </>
        ) : (
          <p className="text-sm text-stone-500">Selecciona una guía del menú lateral.</p>
        )}
      </article>
    </div>
  );
}
