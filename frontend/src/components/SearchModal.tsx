import { useEffect, useState } from 'react';
import {
  Search,
  X,
  BookOpen,
  PlayCircle,
  Terminal,
  FileText,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../lib/api';
import type { ResultadoBusqueda } from '../types/egel';

type SearchTipo = 'todos' | 'guias' | 'preguntas' | 'comandos' | 'recursos';

const SUGGESTED_QUERIES = ['ISO 25010', 'Scrum', 'REST', 'SQL', 'Docker', 'RACI', 'ATAM'];

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (
    tab: 'inicio' | 'simulador' | 'guias' | 'biblioteca' | 'comandos' | 'progreso',
    opts?: { area?: string; subarea?: string; guiaClave?: string }
  ) => void;
}

export function SearchModal({ isOpen, onClose, onNavigate }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [tipo, setTipo] = useState<SearchTipo>('todos');
  const [resultados, setResultados] = useState<ResultadoBusqueda | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setTipo('todos');
      setResultados(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || query.trim().length < 2) {
      setResultados(null);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      api
        .buscar(query.trim(), tipo)
        .then((res) => setResultados(res))
        .catch(() => setResultados(null))
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(timer);
  }, [query, tipo, isOpen]);

  if (!isOpen) return null;

  const go = (
    tab: 'inicio' | 'simulador' | 'guias' | 'biblioteca' | 'comandos' | 'progreso',
    opts?: { area?: string; subarea?: string; guiaClave?: string }
  ) => {
    onNavigate(tab, opts);
    onClose();
  };

  const copyCommand = (cmd: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 1400);
  };

  const tabs: Array<{ id: SearchTipo; label: string }> = [
    { id: 'todos', label: 'Todo' },
    { id: 'guias', label: 'Guías' },
    { id: 'preguntas', label: 'Preguntas' },
    { id: 'comandos', label: 'Comandos' },
    { id: 'recursos', label: 'Biblioteca' },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-stone-950/50 backdrop-blur-sm p-4 pt-12 sm:pt-16"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border border-stone-200 bg-white shadow-2xl overflow-hidden"
      >
        <div className="flex items-center border-b border-stone-200 px-4 py-3 gap-3">
          <Search className="h-5 w-5 text-teal-700 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en guías, preguntas, comandos o biblioteca..."
            className="flex-1 bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded-lg px-2 py-1 text-[11px] font-medium text-stone-500 hover:bg-stone-100 cursor-pointer"
            >
              Limpiar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Pestañas de filtro por categoría */}
        <div className="flex items-center gap-1.5 border-b border-stone-100 bg-stone-50/80 px-4 py-2 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTipo(t.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer shrink-0 ${
                tipo === t.id
                  ? 'bg-teal-700 text-white'
                  : 'text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-[62vh] overflow-y-auto p-4 space-y-4">
          {query.trim().length < 2 ? (
            <div className="py-4 text-center space-y-3">
              <p className="text-xs text-stone-500">
                Escribe al menos 2 caracteres o prueba con una búsqueda rápida:
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {SUGGESTED_QUERIES.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setQuery(term)}
                    className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-700 hover:border-teal-600 hover:bg-teal-50 hover:text-teal-800 transition cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          ) : loading ? (
            <p className="text-xs text-stone-500 text-center py-6">Buscando en el portal...</p>
          ) : !resultados ||
            (resultados.guias.length === 0 &&
              resultados.preguntas.length === 0 &&
              resultados.comandos.length === 0 &&
              resultados.recursos.length === 0) ? (
            <p className="text-xs text-stone-500 text-center py-6">
              Sin resultados para «{query}».
            </p>
          ) : (
            <>
              {resultados.guias.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-teal-700 mb-1.5">
                    Guías de estudio ({resultados.guias.length})
                  </div>
                  {resultados.guias.map((g) => (
                    <button
                      key={g.clave}
                      type="button"
                      onClick={() => go('guias', { guiaClave: g.clave })}
                      className="w-full flex items-start justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-stone-800 hover:bg-teal-50 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <span className="flex items-center gap-2 font-semibold">
                          <BookOpen className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                          {g.titulo}
                        </span>
                        {g.snippet && (
                          <p className="mt-0.5 pl-5 text-[11px] font-normal text-stone-500 line-clamp-1">
                            …{g.snippet}…
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-stone-400 shrink-0 mt-0.5" />
                    </button>
                  ))}
                </div>
              )}

              {resultados.preguntas.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1.5">
                    Preguntas ({resultados.preguntas.length})
                  </div>
                  {resultados.preguntas.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => go('simulador', { area: p.area, subarea: p.subarea })}
                      className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs text-stone-700 hover:bg-amber-50 cursor-pointer"
                    >
                      <span className="flex items-center gap-2 line-clamp-1">
                        <PlayCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <strong>{p.id}</strong> ({p.subarea}) · {p.pregunta}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {resultados.comandos.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                    Comandos ({resultados.comandos.length})
                  </div>
                  {resultados.comandos.map((c, i) => (
                    <div
                      key={i}
                      onClick={() => go('comandos')}
                      className="w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs text-stone-700 hover:bg-stone-100 cursor-pointer"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Terminal className="h-3.5 w-3.5 text-stone-500 shrink-0" />
                        <span className="truncate">
                          <code className="font-mono text-teal-800">{c.comando}</code> —{' '}
                          {c.descripcion}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => copyCommand(c.comando, e)}
                        title="Copiar comando"
                        className="shrink-0 rounded-md p-1 text-stone-400 hover:bg-white hover:text-teal-700 cursor-pointer"
                      >
                        {copiedCmd === c.comando ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {resultados.recursos.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                    Biblioteca ({resultados.recursos.length})
                  </div>
                  {resultados.recursos.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => go('biblioteca')}
                      className="w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs text-stone-700 hover:bg-stone-100 cursor-pointer"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <FileText className="h-3.5 w-3.5 text-stone-500 shrink-0" />
                        <span className="truncate">{r.titulo}</span>
                      </span>
                      <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] uppercase text-stone-500">
                        {r.tipo}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
