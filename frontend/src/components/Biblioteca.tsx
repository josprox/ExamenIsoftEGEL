import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  FileText,
  ExternalLink,
  BookOpen,
  Filter,
  FolderOpen,
  Star,
  Eye,
  X,
  Download,
  RotateCcw,
  Globe,
  ArrowRight,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { api } from '../lib/api';
import type {
  BibliotecaResumen,
  ConceptoWeb,
  Recurso,
  Temario,
  WebFuenteId,
} from '../types/egel';

type WebFuente = 'todos' | WebFuenteId;

const WEB_SOURCES: Array<{ id: WebFuenteId; label: string; badgeCls: string }> = [
  { id: 'wikipedia', label: 'Wikipedia', badgeCls: 'bg-sky-50 text-sky-700' },
  { id: 'mdn', label: 'MDN Web Docs', badgeCls: 'bg-indigo-50 text-indigo-700' },
  { id: 'github', label: 'GitHub', badgeCls: 'bg-stone-200 text-stone-800' },
  { id: 'stackoverflow', label: 'Stack Overflow', badgeCls: 'bg-orange-50 text-orange-700' },
  { id: 'openalex', label: 'OpenAlex', badgeCls: 'bg-violet-50 text-violet-700' },
  { id: 'openlibrary', label: 'Open Library', badgeCls: 'bg-emerald-50 text-emerald-700' },
  { id: 'crossref', label: 'Crossref', badgeCls: 'bg-amber-50 text-amber-800' },
  { id: 'arxiv', label: 'arXiv', badgeCls: 'bg-rose-50 text-rose-700' },
];

const SOURCE_BADGES: Record<string, { label: string; cls: string }> = Object.fromEntries(
  WEB_SOURCES.map((s) => [s.id, { label: s.label, cls: s.badgeCls }])
);

const WEB_SUGGESTIONS = [
  'ISO/IEC 25010',
  'Patrón Strategy',
  'Normalización 3FN',
  'PHP PDO',
  'CORS',
  'Teorema CAP',
  'Scrum',
  'Docker',
];

interface BibliotecaProps {
  temario: Temario | null;
  initialMode?: 'catalogo' | 'web';
  initialWebQuery?: string;
  onModeChange?: (mode: 'catalogo' | 'web', webQuery?: string) => void;
}

export function Biblioteca({
  temario,
  initialMode = 'catalogo',
  initialWebQuery = '',
  onModeChange,
}: BibliotecaProps) {
  const [mode, setMode] = useState<'catalogo' | 'web'>(initialMode);
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [resumen, setResumen] = useState<BibliotecaResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [area, setArea] = useState('todas');
  const [tipo, setTipo] = useState('todos');
  const [idioma, setIdioma] = useState('todos');
  const [orden, setOrden] = useState<'prioridad' | 'anio_desc' | 'titulo'>('prioridad');
  const [soloArchivo, setSoloArchivo] = useState(false);
  const [soloOficial, setSoloOficial] = useState(false);
  const [soloGratuito, setSoloGratuito] = useState(false);
  const [previewRecurso, setPreviewRecurso] = useState<Recurso | null>(null);

  // Estado del Explorador Web estilo Google con carga progresiva por fuente
  const [webQuery, setWebQuery] = useState(initialWebQuery);
  const [webFuente, setWebFuente] = useState<WebFuente>('todos');
  const [webResults, setWebResults] = useState<ConceptoWeb[]>([]);
  const [pendingSources, setPendingSources] = useState<WebFuenteId[]>([]);
  const [webLocalMatches, setWebLocalMatches] = useState<Recurso[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);

  // Resultados web relacionados cuando se busca en el catálogo local
  const [catalogoWebResults, setCatalogoWebResults] = useState<ConceptoWeb[]>([]);
  const [catalogoWebLoading, setCatalogoWebLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    if (initialWebQuery) {
      setWebQuery(initialWebQuery);
    }
  }, [initialMode, initialWebQuery]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .getBiblioteca({
          area,
          tipo,
          idioma,
          q,
          soloArchivo,
          soloOficial,
          soloGratuito,
          orden,
        })
        .then((res) => {
          if (active) {
            setRecursos(res.recursos);
            if (res.resumen) setResumen(res.resumen);
          }
        })
        .catch(() => {
          if (active) setRecursos([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 150);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [area, tipo, idioma, q, soloArchivo, soloOficial, soloGratuito, orden]);

  // Sugerencias web rápidas (Wikipedia + MDN) cuando se busca en el catálogo local
  useEffect(() => {
    const trimmed = q.trim();
    if (mode !== 'catalogo' || trimmed.length < 2) {
      setCatalogoWebResults([]);
      return;
    }
    let active = true;
    setCatalogoWebLoading(true);
    const timer = setTimeout(() => {
      Promise.allSettled([
        api.buscarWeb(trimmed, 'wikipedia'),
        api.buscarWeb(trimmed, 'mdn'),
      ])
        .then((settled) => {
          if (!active) return;
          const merged: ConceptoWeb[] = [];
          for (const res of settled) {
            if (res.status === 'fulfilled') {
              merged.push(...(res.value.conceptos ?? []));
            }
          }
          setCatalogoWebResults(merged);
        })
        .finally(() => {
          if (active) setCatalogoWebLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q, mode]);

  // Lazy loading progresivo por fuente en el Explorador Web
  useEffect(() => {
    const trimmed = webQuery.trim();
    if (mode !== 'web' || trimmed.length < 2) {
      setWebResults([]);
      setPendingSources([]);
      setWebLocalMatches([]);
      return;
    }

    let active = true;
    setVisibleCount(12);

    const sourcesToFetch: WebFuenteId[] =
      webFuente === 'todos'
        ? WEB_SOURCES.map((s) => s.id)
        : [webFuente];

    const timer = setTimeout(() => {
      if (!active) return;
      setWebResults([]);
      setPendingSources(sourcesToFetch);

      // Coincidencias locales para el Knowledge Panel
      api
        .getBiblioteca({ q: trimmed })
        .then((res) => {
          if (active) setWebLocalMatches(res.recursos.slice(0, 4));
        })
        .catch(() => {
          if (active) setWebLocalMatches([]);
        });

      // Dispara cada fuente por separado y las agrega apenas responden
      for (const src of sourcesToFetch) {
        api
          .buscarWeb(trimmed, src)
          .then((res) => {
            if (!active) return;
            const nuevos = res.conceptos ?? [];
            if (nuevos.length > 0) {
              setWebResults((prev) => {
                const seen = new Set(prev.map((x) => x.url));
                const filtered = nuevos.filter((x) => !seen.has(x.url));
                return [...prev, ...filtered];
              });
            }
          })
          .catch(() => {
            // Ignora fallo puntual de una fuente para no bloquear las demás
          })
          .finally(() => {
            if (active) {
              setPendingSources((prev) => prev.filter((id) => id !== src));
            }
          });
      }
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [webQuery, webFuente, mode]);

  const areas = temario?.secciones.flatMap((s) => s.areas) ?? [];

  const limpiarFiltros = () => {
    setQ('');
    setArea('todas');
    setTipo('todos');
    setIdioma('todos');
    setOrden('prioridad');
    setSoloArchivo(false);
    setSoloOficial(false);
    setSoloGratuito(false);
  };

  const fileUrl = (archivo: string) =>
    `/biblioteca-files/${archivo.replace(/^biblioteca\//, '')}`;

  const hayFiltrosActivos =
    q !== '' ||
    area !== 'todas' ||
    tipo !== 'todos' ||
    idioma !== 'todos' ||
    soloArchivo ||
    soloOficial ||
    soloGratuito;

  const abrirEnExploradorWeb = (termino: string) => {
    setWebQuery(termino);
    setWebFuente('todos');
    setMode('web');
    onModeChange?.('web', termino);
  };

  const wikiKnowledge = useMemo(
    () => webResults.find((r) => r.category === 'wikipedia'),
    [webResults]
  );

  const webBusy = pendingSources.length > 0;

  return (
    <div className="space-y-6">
      {/* Cabecera con selector de modo */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2.5">
              {mode === 'catalogo' ? (
                <FolderOpen className="h-6 w-6 text-teal-700" />
              ) : (
                <Globe className="h-6 w-6 text-sky-600" />
              )}
              {mode === 'catalogo' ? 'Biblioteca EGEL ISOFT' : 'Explorador Web EGEL'}
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              {mode === 'catalogo'
                ? 'Guías oficiales, libros recomendados, normas ISO y documentos con vista previa por área.'
                : 'Busca en 8 fuentes confiables en paralelo (Wikipedia, MDN, GitHub, Stack Overflow, OpenAlex, Open Library, Crossref y arXiv).'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-stone-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('catalogo');
                  onModeChange?.('catalogo');
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  mode === 'catalogo'
                    ? 'bg-white text-teal-800 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Catálogo ({resumen?.total_catalogo ?? recursos.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('web');
                  onModeChange?.('web', webQuery);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  mode === 'web'
                    ? 'bg-white text-sky-800 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                Explorador Web (8 fuentes)
              </button>
            </div>
          </div>
        </div>

        {mode === 'catalogo' ? (
          <>
            {/* Filtros principales del catálogo */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por título, autor, tema o subárea (ej. 2.2)..."
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 pl-10 pr-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-teal-600 focus:bg-white focus:outline-none"
                />
              </div>

              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-900 focus:border-teal-600 focus:bg-white focus:outline-none"
              >
                <option value="todas">Todas las áreas</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} · {a.nombre}
                  </option>
                ))}
              </select>

              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-900 focus:border-teal-600 focus:bg-white focus:outline-none"
              >
                <option value="todos">Todos los tipos</option>
                <option value="guia">Guías</option>
                <option value="libro">Libros</option>
                <option value="norma">Normas</option>
                <option value="articulo">Artículos</option>
                <option value="banco-preguntas">Bancos de preguntas</option>
                <option value="apuntes">Apuntes</option>
                <option value="web">Sitios web</option>
                <option value="video">Videos</option>
              </select>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={idioma}
                  onChange={(e) => setIdioma(e.target.value)}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-2.5 py-2.5 text-xs font-medium text-stone-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                >
                  <option value="todos">Idioma: Todos</option>
                  <option value="es">Español</option>
                  <option value="en">Inglés</option>
                </select>
                <select
                  value={orden}
                  onChange={(e) => setOrden(e.target.value as 'prioridad' | 'anio_desc' | 'titulo')}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-2.5 py-2.5 text-xs font-medium text-stone-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                >
                  <option value="prioridad">Relevancia</option>
                  <option value="anio_desc">Más recientes</option>
                  <option value="titulo">A–Z</option>
                </select>
              </div>
            </div>

            {/* Toggles rápidos */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-700">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soloArchivo}
                    onChange={(e) => setSoloArchivo(e.target.checked)}
                    className="rounded border-stone-300 text-teal-700 focus:ring-teal-600"
                  />
                  <Filter className="h-3.5 w-3.5 text-teal-700" />
                  Solo descargables locales
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soloOficial}
                    onChange={(e) => setSoloOficial(e.target.checked)}
                    className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                  />
                  <Star className="h-3.5 w-3.5 text-amber-500" />
                  Solo oficiales
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soloGratuito}
                    onChange={(e) => setSoloGratuito(e.target.checked)}
                    className="rounded border-stone-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  Solo gratuitos
                </label>
                {hayFiltrosActivos && (
                  <button
                    type="button"
                    onClick={limpiarFiltros}
                    className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-200 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" /> Limpiar filtros
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {resumen && (
                  <span className="rounded-lg bg-teal-50 px-2.5 py-1 font-semibold text-teal-800">
                    {resumen.con_archivo} PDFs locales
                  </span>
                )}
                <span className="rounded-lg bg-stone-100 px-2.5 py-1 font-semibold text-stone-700">
                  {recursos.length} mostrados
                </span>
              </div>
            </div>
          </>
        ) : (
          /* Barra estilo Google del Explorador Web */
          <div className="mt-6 space-y-4">
            <div className="relative mx-auto max-w-4xl">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-sky-600" />
              <input
                type="text"
                autoFocus
                value={webQuery}
                onChange={(e) => setWebQuery(e.target.value)}
                placeholder="Busca cualquier concepto técnico (ej. ISO 25010, PHP PDO, Patrón Strategy, Scrum)..."
                className="w-full rounded-full border border-stone-300 bg-white pl-12 pr-24 py-3.5 text-sm sm:text-base text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-600/15 focus:outline-none"
              />
              {webQuery && (
                <button
                  type="button"
                  onClick={() => setWebQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => setWebFuente('todos')}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  webFuente === 'todos'
                    ? 'bg-sky-700 text-white shadow-sm'
                    : 'border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                }`}
              >
                Todas (8)
              </button>
              {WEB_SOURCES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setWebFuente(f.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    webFuente === f.id
                      ? 'bg-sky-700 text-white shadow-sm'
                      : 'border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {mode === 'catalogo' ? (
        <>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="h-44 animate-pulse rounded-2xl border border-stone-200 bg-white p-5 space-y-3"
                >
                  <div className="h-3 w-24 rounded bg-stone-200" />
                  <div className="h-4 w-3/4 rounded bg-stone-200" />
                  <div className="h-3 w-full rounded bg-stone-100" />
                </div>
              ))}
            </div>
          ) : recursos.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
              <p className="text-sm text-stone-600">
                No se encontraron recursos locales con los filtros seleccionados.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {hayFiltrosActivos && (
                  <button
                    type="button"
                    onClick={limpiarFiltros}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restablecer filtros
                  </button>
                )}
                {q.trim().length >= 2 && (
                  <button
                    type="button"
                    onClick={() => abrirEnExploradorWeb(q.trim())}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 cursor-pointer"
                  >
                    <Globe className="h-3.5 w-3.5" /> Buscar «{q.trim()}» en Explorador Web
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recursos.map((r) => {
                const esPdf = Boolean(r.archivo && r.archivo.toLowerCase().endsWith('.pdf'));
                return (
                  <div
                    key={r.id}
                    className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 hover:border-teal-600/50 hover:shadow-md transition"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] mb-2.5">
                        <span className="rounded-md bg-teal-50 px-2 py-0.5 font-semibold text-teal-800 uppercase">
                          {r.tipo}
                        </span>
                        {r.oficial && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
                            <Star className="h-3 w-3" /> Oficial
                          </span>
                        )}
                        {r.gratuito && (
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                            Gratis
                          </span>
                        )}
                        {r.idioma && (
                          <span className="rounded-md bg-stone-100 px-1.5 py-0.5 uppercase text-stone-500">
                            {r.idioma}
                          </span>
                        )}
                        {r.areas.map((a) => (
                          <span
                            key={a}
                            className="rounded-md bg-stone-100 px-1.5 py-0.5 text-stone-600"
                          >
                            {a}
                          </span>
                        ))}
                      </div>

                      <h3 className="text-sm font-bold text-stone-900 leading-snug">{r.titulo}</h3>
                      {(r.autores || r.anio) && (
                        <p className="mt-1 text-xs text-stone-500">
                          {r.autores}
                          {r.anio ? ` (${r.anio})` : ''}
                        </p>
                      )}
                      {r.nota && (
                        <p className="mt-2 text-xs text-stone-600 line-clamp-3">{r.nota}</p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-stone-100">
                      {r.archivo && esPdf && (
                        <button
                          type="button"
                          onClick={() => setPreviewRecurso(r)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 transition cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Vista previa
                        </button>
                      )}
                      {r.archivo && (
                        <a
                          href={fileUrl(r.archivo)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {esPdf ? 'Abrir' : 'Descargar'}
                        </a>
                      )}
                      {r.url && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 transition"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Enlace
                        </a>
                      )}
                      {!r.archivo && !r.url && (
                        <span className="inline-flex items-center gap-1 text-xs text-stone-400">
                          <BookOpen className="h-3.5 w-3.5" />
                          Referencia bibliográfica
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Resultados web relacionados cuando se busca en el catálogo */}
          {q.trim().length >= 2 && (
            <div className="rounded-2xl border border-sky-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-sky-600" />
                  Resultados en la web para «{q.trim()}»
                </h2>
                <button
                  type="button"
                  onClick={() => abrirEnExploradorWeb(q.trim())}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline cursor-pointer"
                >
                  Ver más en Explorador Web <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
              {catalogoWebLoading ? (
                <p className="text-xs text-stone-500">Consultando Wikipedia y MDN Web Docs...</p>
              ) : catalogoWebResults.length === 0 ? (
                <p className="text-xs text-stone-500">Sin resultados web adicionales.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {catalogoWebResults.slice(0, 6).map((c) => {
                    const badge = c.category ? SOURCE_BADGES[c.category] : null;
                    return (
                      <a
                        key={`${c.source}-${c.url}`}
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-stone-200 bg-stone-50/60 p-3.5 hover:border-sky-400 hover:bg-sky-50/40 transition"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-stone-900 line-clamp-1">
                            {c.title}
                          </span>
                          {badge && (
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.cls}`}
                            >
                              {badge.label}
                            </span>
                          )}
                        </div>
                        {c.extract && (
                          <p className="mt-1 text-[11px] text-stone-600 line-clamp-2">
                            {c.extract}
                          </p>
                        )}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Portal Explorador Web estilo Google con carga progresiva + Panel de Conocimiento */
        <div className="mx-auto max-w-6xl">
          {webQuery.trim().length < 2 ? (
            <div className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-8 text-center space-y-4 shadow-sm">
              <p className="text-sm text-stone-600">
                Explora definiciones, documentación técnica, repositorios, papers científicos y libros en 8 fuentes confiables:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {WEB_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setWebQuery(s)}
                    className="rounded-full border border-stone-200 bg-stone-50 px-3.5 py-1.5 text-xs font-medium text-stone-700 hover:border-sky-500 hover:bg-sky-50 hover:text-sky-800 transition cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
              {/* Columna principal de resultados */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-stone-500">
                  <span>
                    {webResults.length > 0
                      ? `${webResults.length} resultados para «${webQuery.trim()}»`
                      : webBusy
                        ? `Buscando «${webQuery.trim()}»...`
                        : `Sin resultados para «${webQuery.trim()}»`}
                  </span>
                  {webBusy && (
                    <span className="inline-flex items-center gap-1.5 text-sky-700 font-medium">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Consultando:{' '}
                      {pendingSources
                        .slice(0, 3)
                        .map((id) => SOURCE_BADGES[id]?.label ?? id)
                        .join(', ')}
                      {pendingSources.length > 3 ? ` (+${pendingSources.length - 3})` : ''}
                    </span>
                  )}
                </div>

                {webResults.slice(0, visibleCount).map((item) => {
                  const badge = item.category ? SOURCE_BADGES[item.category] : null;
                  return (
                    <a
                      key={`${item.source}-${item.url}`}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl border border-stone-200 bg-white p-5 hover:border-sky-400 hover:shadow-sm transition group"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mb-1">
                        {badge && (
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        )}
                        <span className="truncate text-[11px] text-emerald-700">{item.url}</span>
                      </div>
                      <h3 className="text-base font-bold text-sky-800 group-hover:underline flex items-center gap-1.5">
                        {item.title}
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      </h3>
                      {item.extract && (
                        <p className="mt-1.5 text-xs sm:text-sm text-stone-600 leading-relaxed line-clamp-3">
                          {item.extract}
                        </p>
                      )}
                    </a>
                  );
                })}

                {/* Skeletons progresivos mientras aún llegan fuentes */}
                {webBusy &&
                  [1, 2].map((n) => (
                    <div
                      key={`skel-${n}`}
                      className="animate-pulse rounded-2xl border border-stone-200 bg-white p-5 space-y-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-20 rounded bg-sky-100" />
                        <div className="h-3 w-48 rounded bg-stone-100" />
                      </div>
                      <div className="h-5 w-2/3 rounded bg-stone-200" />
                      <div className="h-3.5 w-full rounded bg-stone-100" />
                      <div className="h-3.5 w-5/6 rounded bg-stone-100" />
                    </div>
                  ))}

                {!webBusy && webResults.length === 0 && (
                  <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
                    No se encontraron resultados web para «{webQuery}». Prueba otro término o cambia a «Todas (8)».
                  </div>
                )}

                {webResults.length > visibleCount && (
                  <button
                    type="button"
                    onClick={() => setVisibleCount((v) => v + 12)}
                    className="w-full rounded-2xl border border-stone-200 bg-white py-3 text-xs font-semibold text-sky-800 hover:bg-sky-50 transition cursor-pointer"
                  >
                    Mostrar más resultados ({webResults.length - visibleCount} restantes)
                  </button>
                )}
              </div>

              {/* Panel lateral estilo Google Knowledge Graph */}
              <aside className="space-y-4">
                {wikiKnowledge && (
                  <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-2.5">
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-700">
                      <Sparkles className="h-3.5 w-3.5" />
                      Ficha rápida
                    </div>
                    <h4 className="text-base font-bold text-stone-900">{wikiKnowledge.title}</h4>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      {wikiKnowledge.extract}
                    </p>
                    <a
                      href={wikiKnowledge.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline pt-1"
                    >
                      Leer artículo completo <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                {webLocalMatches.length > 0 && (
                  <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                        En tu Biblioteca EGEL
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setQ(webQuery);
                          setMode('catalogo');
                        }}
                        className="text-[11px] font-semibold text-teal-700 hover:underline cursor-pointer"
                      >
                        Ver catálogo
                      </button>
                    </div>
                    <div className="space-y-2">
                      {webLocalMatches.map((r) => (
                        <div
                          key={r.id}
                          className="rounded-xl border border-stone-200 bg-white p-3 text-xs"
                        >
                          <div className="font-bold text-stone-900 line-clamp-1">{r.titulo}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-teal-800">
                              {r.tipo}
                            </span>
                            {r.archivo && r.archivo.toLowerCase().endsWith('.pdf') ? (
                              <button
                                type="button"
                                onClick={() => setPreviewRecurso(r)}
                                className="text-[11px] font-semibold text-teal-700 hover:underline cursor-pointer"
                              >
                                Vista previa PDF
                              </button>
                            ) : r.url ? (
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-semibold text-sky-700 hover:underline"
                              >
                                Abrir enlace
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            </div>
          )}
        </div>
      )}

      {/* Modal de vista previa PDF */}
      {previewRecurso && previewRecurso.archivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-sm p-3 sm:p-6">
          <div className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-3.5">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-bold text-stone-900">
                  {previewRecurso.titulo}
                </h4>
                <p className="text-xs text-stone-500">
                  {previewRecurso.autores || 'Documento de biblioteca EGEL'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={fileUrl(previewRecurso.archivo)}
                  download
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Descargar</span>
                </a>
                <a
                  href={fileUrl(previewRecurso.archivo)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Nueva pestaña</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewRecurso(null)}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <iframe
              src={fileUrl(previewRecurso.archivo)}
              title={previewRecurso.titulo}
              className="h-full w-full flex-1 bg-stone-100"
            />
          </div>
        </div>
      )}
    </div>
  );
}
