import { useEffect, useMemo, useRef, useState } from 'react';
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
  Sparkles,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '../lib/api';
import type {
  BibliotecaResumen,
  ConceptoWeb,
  Recurso,
  Temario,
  WebFuenteId,
} from '../types/egel';

type AlcanceFiltro = 'todos' | 'catalogo' | 'web';
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

const SUGGESTIONS = [
  'ISO/IEC 25010',
  'Patrón Strategy',
  'Normalización',
  'PHP',
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
  const [alcance, setAlcance] = useState<AlcanceFiltro>(
    initialMode === 'web' ? 'web' : 'todos'
  );
  const [q, setQ] = useState(initialWebQuery);
  const [mostrarFiltrosLocales, setMostrarFiltrosLocales] = useState(false);

  // Catálogo local
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [resumen, setResumen] = useState<BibliotecaResumen | null>(null);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [area, setArea] = useState('todas');
  const [tipo, setTipo] = useState('todos');
  const [idioma, setIdioma] = useState('todos');
  const [orden, setOrden] = useState<'prioridad' | 'anio_desc' | 'titulo'>('prioridad');
  const [soloArchivo, setSoloArchivo] = useState(false);
  const [soloOficial, setSoloOficial] = useState(false);
  const [soloGratuito, setSoloGratuito] = useState(false);
  const [previewRecurso, setPreviewRecurso] = useState<Recurso | null>(null);

  // Web (carga progresiva por fuente + scroll infinito)
  const [webFuente, setWebFuente] = useState<WebFuente>('todos');
  const [webResults, setWebResults] = useState<ConceptoWeb[]>([]);
  const [pendingSources, setPendingSources] = useState<WebFuenteId[]>([]);
  const [visibleWebCount, setVisibleWebCount] = useState(12);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialMode === 'web') {
      setAlcance('web');
    }
    if (initialWebQuery) {
      setQ(initialWebQuery);
    }
  }, [initialMode, initialWebQuery]);

  // Infinite scroll automático para resultados web
  useEffect(() => {
    if (webResults.length <= visibleWebCount) return;
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleWebCount((v) => Math.min(webResults.length, v + 12));
        }
      },
      { rootMargin: '250px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [webResults.length, visibleWebCount]);

  // Carga del catálogo local unificado
  useEffect(() => {
    if (alcance === 'web') {
      setLoadingLocal(false);
      return;
    }
    let active = true;
    setLoadingLocal(true);
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
          if (active) setLoadingLocal(false);
        });
    }, 150);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [alcance, area, tipo, idioma, q, soloArchivo, soloOficial, soloGratuito, orden]);

  // Carga progresiva por fuente en la web cuando hay consulta (>= 2 caracteres)
  useEffect(() => {
    const trimmed = q.trim();
    if (alcance === 'catalogo' || trimmed.length < 2) {
      setWebResults([]);
      setPendingSources([]);
      return;
    }

    let active = true;
    setVisibleWebCount(12);

    const sourcesToFetch: WebFuenteId[] =
      webFuente === 'todos' ? WEB_SOURCES.map((s) => s.id) : [webFuente];

    const timer = setTimeout(() => {
      if (!active) return;
      setWebResults([]);
      setPendingSources(sourcesToFetch);

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
            // Ignorar fallo puntual de una fuente
          })
          .finally(() => {
            if (active) {
              setPendingSources((prev) => prev.filter((id) => id !== src));
            }
          });
      }
    }, 240);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q, webFuente, alcance]);

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
    setWebFuente('todos');
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
    soloGratuito ||
    webFuente !== 'todos';

  const wikiKnowledge = useMemo(
    () => webResults.find((r) => r.category === 'wikipedia'),
    [webResults]
  );

  const webBusy = pendingSources.length > 0;
  const tieneConsultaWeb = q.trim().length >= 2 && alcance !== 'catalogo';

  const cambiarAlcance = (nuevo: AlcanceFiltro) => {
    setAlcance(nuevo);
    onModeChange?.(nuevo === 'web' ? 'web' : 'catalogo', q.trim());
  };

  return (
    <div className="space-y-6">
      {/* Cabecera unificada responsiva */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 flex items-center gap-2.5">
              <FolderOpen className="h-6 w-6 text-teal-700 shrink-0" />
              Biblioteca y Explorador Web
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-stone-600">
              Busca en un solo lugar dentro de los {resumen?.total_catalogo ?? 140} recursos del portal y en 8 fuentes web confiables.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {resumen && (
              <span className="rounded-lg bg-teal-50 border border-teal-700/15 px-2.5 py-1 text-teal-800">
                {resumen.con_archivo} PDFs locales
              </span>
            )}
            <span className="rounded-lg bg-stone-100 border border-stone-200 px-2.5 py-1 text-stone-700">
              {recursos.length} locales
            </span>
          </div>
        </div>

        {/* Barra de búsqueda unificada */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-700" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Busca guías, libros, normas o conceptos web (ej. ISO 25010, PHP, Scrum)..."
              className="w-full rounded-xl border border-stone-300 bg-stone-50 pl-10 pr-20 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-teal-600 focus:bg-white focus:outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-stone-500 hover:bg-stone-200/70 cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>

          {alcance !== 'web' && (
            <button
              type="button"
              onClick={() => setMostrarFiltrosLocales((v) => !v)}
              className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition cursor-pointer shrink-0 ${
                mostrarFiltrosLocales
                  ? 'border-teal-600 bg-teal-50 text-teal-800'
                  : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtros locales
            </button>
          )}
        </div>

        {/* Selector de alcance + sugerencias */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(
              [
                { id: 'todos', label: 'Todo (Catálogo + Web)' },
                { id: 'catalogo', label: 'Solo Catálogo local' },
                { id: 'web', label: 'Solo Web (8 fuentes)' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => cambiarAlcance(opt.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer shrink-0 ${
                  alcance === opt.id
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                }`}
              >
                {opt.id === 'web' && <Globe className="h-3.5 w-3.5" />}
                {opt.label}
              </button>
            ))}
          </div>

          {hayFiltrosActivos && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="inline-flex items-center gap-1 self-start rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-200 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" /> Restablecer
            </button>
          )}
        </div>

        {/* Filtros locales desplegables */}
        {alcance !== 'web' && mostrarFiltrosLocales && (
          <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-3">
            <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-teal-600 focus:outline-none"
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
                className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-teal-600 focus:outline-none"
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

              <select
                value={idioma}
                onChange={(e) => setIdioma(e.target.value)}
                className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-teal-600 focus:outline-none"
              >
                <option value="todos">Idioma: Todos</option>
                <option value="es">Español</option>
                <option value="en">Inglés</option>
              </select>

              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value as 'prioridad' | 'anio_desc' | 'titulo')}
                className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-teal-600 focus:outline-none"
              >
                <option value="prioridad">Orden: Relevancia</option>
                <option value="anio_desc">Más recientes</option>
                <option value="titulo">Alfabético A–Z</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-700">
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
            </div>
          </div>
        )}

        {/* Sugerencias rápidas cuando no hay texto */}
        {!q && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:pb-0">
            <span className="text-[11px] font-medium text-stone-400 shrink-0 mr-1">
              Sugerencias:
            </span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQ(s)}
                className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-700 hover:border-teal-600 hover:bg-teal-50 hover:text-teal-800 transition cursor-pointer shrink-0"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ficha rápida de Wikipedia cuando hay búsqueda web */}
      {tieneConsultaWeb && wikiKnowledge && (
        <div className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50/70 to-white p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-700">
                <Sparkles className="h-3.5 w-3.5" />
                Ficha rápida · Wikipedia
              </div>
              <h2 className="text-base font-bold text-stone-900">{wikiKnowledge.title}</h2>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                {wikiKnowledge.extract}
              </p>
            </div>
            <a
              href={wikiKnowledge.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 self-start shrink-0 rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-50"
            >
              Leer más <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Sección 1: Catálogo local EGEL */}
      {alcance !== 'web' && (
        <section className="space-y-3">
          {q.trim().length >= 2 && (
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-teal-700" />
                En el Catálogo EGEL ({recursos.length})
              </h2>
            </div>
          )}

          {loadingLocal ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-40 animate-pulse rounded-2xl border border-stone-200 bg-white p-5 space-y-3"
                >
                  <div className="h-3 w-24 rounded bg-stone-200" />
                  <div className="h-4 w-3/4 rounded bg-stone-200" />
                  <div className="h-3 w-full rounded bg-stone-100" />
                </div>
              ))}
            </div>
          ) : recursos.length === 0 ? (
            alcance === 'catalogo' || !tieneConsultaWeb ? (
              <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
                <p className="text-sm text-stone-600">
                  No se encontraron recursos locales con esos filtros.
                </p>
                {hayFiltrosActivos && (
                  <button
                    type="button"
                    onClick={limpiarFiltros}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restablecer filtros
                  </button>
                )}
              </div>
            ) : null
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {recursos.map((r) => {
                const esPdf = Boolean(r.archivo && r.archivo.toLowerCase().endsWith('.pdf'));
                return (
                  <div
                    key={r.id}
                    className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 hover:border-teal-600/50 hover:shadow-md transition"
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
        </section>
      )}

      {/* Sección 2: Resultados Web progresivos con scroll infinito */}
      {tieneConsultaWeb && (
        <section className="space-y-3">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between px-1">
            <h2 className="text-sm font-bold text-stone-800 flex items-center gap-2">
              <Globe className="h-4 w-4 text-sky-600" />
              Resultados en la web ({webResults.length})
            </h2>

            {webBusy && (
              <span className="inline-flex items-center gap-1.5 text-xs text-sky-700 font-medium">
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

          {/* Chips de filtro por fuente web */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:pb-0">
            <button
              type="button"
              onClick={() => setWebFuente('todos')}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer shrink-0 ${
                webFuente === 'todos'
                  ? 'bg-sky-700 text-white shadow-sm'
                  : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-100'
              }`}
            >
              Todas (8)
            </button>
            {WEB_SOURCES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setWebFuente(f.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer shrink-0 ${
                  webFuente === f.id
                    ? 'bg-sky-700 text-white shadow-sm'
                    : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {webResults.slice(0, visibleWebCount).map((item) => {
              const badge = item.category ? SOURCE_BADGES[item.category] : null;
              return (
                <a
                  key={`${item.source}-${item.url}`}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 hover:border-sky-400 hover:shadow-sm transition group"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mb-1">
                    {badge && (
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    )}
                    <span className="truncate max-w-full text-[11px] text-emerald-700">
                      {item.url}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-sky-800 group-hover:underline flex items-center gap-1.5">
                    <span className="break-words">{item.title}</span>
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
                </div>
              ))}

            {!webBusy && webResults.length === 0 && (
              <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
                No se encontraron resultados web para «{q.trim()}».
              </div>
            )}

            {webResults.length > visibleWebCount && (
              <div
                ref={loadMoreRef}
                className="flex items-center justify-center gap-2 py-4 text-xs font-medium text-sky-700"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando más resultados ({webResults.length - visibleWebCount} restantes)...
              </div>
            )}
          </div>
        </section>
      )}

      {/* Modal de vista previa PDF */}
      {previewRecurso && previewRecurso.archivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-sm p-2 sm:p-6">
          <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-stone-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 sm:px-5 py-3">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-bold text-stone-900">
                  {previewRecurso.titulo}
                </h4>
                <p className="truncate text-xs text-stone-500">
                  {previewRecurso.autores || 'Documento de biblioteca EGEL'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={fileUrl(previewRecurso.archivo)}
                  download
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Descargar</span>
                </a>
                <a
                  href={fileUrl(previewRecurso.archivo)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
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
