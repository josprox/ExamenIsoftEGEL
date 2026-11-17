import { useEffect, useState } from 'react';
import { Search, X, BookOpen, PlayCircle, Terminal, FileText, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';
import type { ResultadoBusqueda } from '../types/egel';

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
  const [resultados, setResultados] = useState<ResultadoBusqueda | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResultados(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || query.trim().length < 2) {
      setResultados(null);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      api
        .buscar(query.trim())
        .then((res) => setResultados(res))
        .catch(() => setResultados(null))
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(timer);
  }, [query, isOpen]);

  if (!isOpen) return null;

  const go = (
    tab: 'inicio' | 'simulador' | 'guias' | 'biblioteca' | 'comandos' | 'progreso',
    opts?: { area?: string; subarea?: string; guiaClave?: string }
  ) => {
    onNavigate(tab, opts);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-stone-950/50 backdrop-blur-sm p-4 pt-16">
      <div className="w-full max-w-2xl rounded-2xl border border-stone-200 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center border-b border-stone-200 px-4 py-3 gap-3">
          <Search className="h-5 w-5 text-stone-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en guías, preguntas, comandos o biblioteca..."
            className="flex-1 bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-4 space-y-4">
          {query.trim().length < 2 ? (
            <p className="text-xs text-stone-500 text-center py-6">
              Escribe al menos 2 caracteres para buscar en todo el contenido del portal.
            </p>
          ) : loading ? (
            <p className="text-xs text-stone-500 text-center py-6">Buscando...</p>
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
                    Guías de estudio
                  </div>
                  {resultados.guias.map((g) => (
                    <button
                      key={g.clave}
                      type="button"
                      onClick={() => go('guias', { guiaClave: g.clave })}
                      className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium text-stone-800 hover:bg-teal-50 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="h-3.5 w-3.5 text-teal-700" />
                        {g.titulo}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-stone-400" />
                    </button>
                  ))}
                </div>
              )}

              {resultados.preguntas.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1.5">
                    Preguntas
                  </div>
                  {resultados.preguntas.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => go('simulador', { area: p.area })}
                      className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs text-stone-700 hover:bg-amber-50 cursor-pointer"
                    >
                      <span className="flex items-center gap-2 line-clamp-1">
                        <PlayCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <strong>{p.id}</strong> · {p.pregunta}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {resultados.comandos.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                    Comandos
                  </div>
                  {resultados.comandos.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => go('comandos')}
                      className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-stone-700 hover:bg-stone-100 cursor-pointer"
                    >
                      <Terminal className="h-3.5 w-3.5 text-stone-500 shrink-0" />
                      <span className="line-clamp-1">
                        <code className="font-mono text-teal-800">{c.comando}</code> — {c.descripcion}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {resultados.recursos.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                    Biblioteca
                  </div>
                  {resultados.recursos.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => go('biblioteca')}
                      className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-stone-700 hover:bg-stone-100 cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5 text-stone-500 shrink-0" />
                      <span className="line-clamp-1">{r.titulo}</span>
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
