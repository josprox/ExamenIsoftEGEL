import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BookOpen,
  ExternalLink,
  Eye,
  FolderOpen,
  Globe,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
} from 'lucide-react-native';
import { api, resolveBackendUrl } from '../lib/api';
import { ResourceViewerModal, type ViewerItem } from './ResourceViewerModal';
import type {
  BibliotecaResumen,
  ConceptoWeb,
  Recurso,
  Temario,
  WebFuenteId,
} from '../types/egel';

type AlcanceFiltro = 'todos' | 'catalogo' | 'web';
type WebFuente = 'todos' | WebFuenteId;

const WEB_SOURCES: Array<{
  id: WebFuenteId;
  label: string;
  bgCls: string;
  textCls: string;
  accentCls: string;
}> = [
  { id: 'wikipedia', label: 'Wikipedia', bgCls: 'bg-sky-50', textCls: 'text-sky-700', accentCls: 'border-l-sky-500' },
  { id: 'wikidata', label: 'Wikidata', bgCls: 'bg-cyan-50', textCls: 'text-cyan-800', accentCls: 'border-l-cyan-600' },
  { id: 'mdn', label: 'MDN Web Docs', bgCls: 'bg-indigo-50', textCls: 'text-indigo-700', accentCls: 'border-l-indigo-500' },
  { id: 'github', label: 'GitHub', bgCls: 'bg-stone-200', textCls: 'text-stone-800', accentCls: 'border-l-stone-700' },
  { id: 'stackoverflow', label: 'Stack Overflow', bgCls: 'bg-orange-50', textCls: 'text-orange-700', accentCls: 'border-l-orange-500' },
  { id: 'hackernews', label: 'Hacker News', bgCls: 'bg-amber-100', textCls: 'text-amber-900', accentCls: 'border-l-amber-600' },
  { id: 'reddit', label: 'Reddit', bgCls: 'bg-red-50', textCls: 'text-red-700', accentCls: 'border-l-red-500' },
  { id: 'semanticscholar', label: 'Semantic Scholar', bgCls: 'bg-blue-50', textCls: 'text-blue-800', accentCls: 'border-l-blue-600' },
  { id: 'openalex', label: 'OpenAlex', bgCls: 'bg-violet-50', textCls: 'text-violet-700', accentCls: 'border-l-violet-500' },
  { id: 'openlibrary', label: 'Open Library', bgCls: 'bg-emerald-50', textCls: 'text-emerald-700', accentCls: 'border-l-emerald-500' },
  { id: 'crossref', label: 'Crossref', bgCls: 'bg-amber-50', textCls: 'text-amber-800', accentCls: 'border-l-amber-500' },
  { id: 'arxiv', label: 'arXiv', bgCls: 'bg-rose-50', textCls: 'text-rose-700', accentCls: 'border-l-rose-500' },
];

const SOURCE_BADGES: Record<string, { label: string; bgCls: string; textCls: string; accentCls: string }> =
  Object.fromEntries(
    WEB_SOURCES.map((s) => [s.id, { label: s.label, bgCls: s.bgCls, textCls: s.textCls, accentCls: s.accentCls }])
  );

const SUGGESTIONS = ['ISO/IEC 25010', 'Patrón Strategy', 'Normalización', 'PHP', 'Scrum', 'Docker'];

interface BibliotecaProps {
  temario: Temario | null;
  initialMode?: 'catalogo' | 'web';
  initialWebQuery?: string;
  wsConnected?: boolean;
  onSubscribeReachBottom?: (fn: () => void) => () => void;
  onSendWsSearch?: (q: string, fuente: string, requestId: string) => boolean;
  onSubscribeWsSearch?: (
    fn: (msg: { type: string; request_id?: string; conceptos?: unknown[] }) => void
  ) => () => void;
  onModeChange?: (mode: 'catalogo' | 'web', webQuery?: string) => void;
}

export function Biblioteca({
  temario,
  initialMode = 'catalogo',
  initialWebQuery = '',
  wsConnected = false,
  onSubscribeReachBottom,
  onSendWsSearch,
  onSubscribeWsSearch,
  onModeChange,
}: BibliotecaProps) {
  const [alcance, setAlcance] = useState<AlcanceFiltro>(initialMode === 'web' ? 'web' : 'todos');
  const [q, setQ] = useState(initialWebQuery);
  const [mostrarFiltrosLocales, setMostrarFiltrosLocales] = useState(false);

  const [catalogoCompleto, setCatalogoCompleto] = useState<Recurso[]>([]);
  const [resumen, setResumen] = useState<BibliotecaResumen | null>(null);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [area, setArea] = useState('todas');
  const [tipo, setTipo] = useState('todos');
  const [idioma, setIdioma] = useState('todos');
  const [orden, setOrden] = useState<'prioridad' | 'anio_desc' | 'titulo'>('prioridad');
  const [soloArchivo, setSoloArchivo] = useState(false);
  const [soloOficial, setSoloOficial] = useState(false);
  const [soloGratuito, setSoloGratuito] = useState(false);
  const [viewerItem, setViewerItem] = useState<ViewerItem | null>(null);
  const [visibleLocalCount, setVisibleLocalCount] = useState(24);

  const [webFuente, setWebFuente] = useState<WebFuente>('todos');
  const [webResults, setWebResults] = useState<ConceptoWeb[]>([]);
  const [webStatus, setWebStatus] = useState<'idle' | 'rapidas' | 'academicas'>('idle');
  const [visibleWebCount, setVisibleWebCount] = useState(12);

  const wsConnectedRef = useRef(wsConnected);
  wsConnectedRef.current = wsConnected;
  const sendWsRef = useRef(onSendWsSearch);
  sendWsRef.current = onSendWsSearch;
  const subWsRef = useRef(onSubscribeWsSearch);
  subWsRef.current = onSubscribeWsSearch;

  useEffect(() => {
    if (initialMode === 'web') setAlcance('web');
    if (initialWebQuery) setQ(initialWebQuery);
  }, [initialMode, initialWebQuery]);

  // Lazy loading automático al acercarse al final del scroll (sin re-disparar la búsqueda)
  useEffect(() => {
    if (!onSubscribeReachBottom) return;
    return onSubscribeReachBottom(() => {
      setVisibleLocalCount((v) => v + 24);
      setVisibleWebCount((v) => v + 12);
    });
  }, [onSubscribeReachBottom]);

  useEffect(() => {
    let active = true;
    setLoadingLocal(true);
    api
      .getBiblioteca()
      .then((res) => {
        if (active) {
          setCatalogoCompleto(res.recursos);
          if (res.resumen) setResumen(res.resumen);
        }
      })
      .catch(() => {
        if (active) setCatalogoCompleto([]);
      })
      .finally(() => {
        if (active) setLoadingLocal(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const recursos = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtrados = catalogoCompleto.filter((r) => {
      if (area !== 'todas' && !r.areas.includes(area)) return false;
      if (tipo !== 'todos' && r.tipo !== tipo) return false;
      if (idioma !== 'todos' && (r.idioma ?? '') !== idioma) return false;
      if (soloArchivo && !r.archivo) return false;
      if (soloOficial && !r.oficial) return false;
      if (soloGratuito && !r.gratuito) return false;
      if (needle !== '') {
        const hay = `${r.titulo} ${r.autores ?? ''} ${r.nota ?? ''} ${(r.subareas ?? []).join(' ')}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });

    if (orden === 'anio_desc') {
      return [...filtrados].sort((a, b) => (b.anio ?? 0) - (a.anio ?? 0));
    }
    if (orden === 'titulo') {
      return [...filtrados].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
    }
    return filtrados;
  }, [catalogoCompleto, area, tipo, idioma, q, soloArchivo, soloOficial, soloGratuito, orden]);

  // Streaming en tiempo real por WebSocket cuando está conectado, con fallback a 2 lotes HTTP
  useEffect(() => {
    const trimmed = q.trim();
    if (alcance === 'catalogo' || trimmed.length < 2) {
      setWebResults([]);
      setWebStatus('idle');
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | undefined;
    setVisibleWebCount(12);

    const timer = setTimeout(async () => {
      if (!active) return;
      setWebResults([]);

      if (wsConnectedRef.current && sendWsRef.current && subWsRef.current) {
        const reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setWebStatus('rapidas');

        unsubscribe = subWsRef.current((msg) => {
          if (!active || msg.request_id !== reqId) return;
          if (msg.type === 'web_search_chunk' && Array.isArray(msg.conceptos)) {
            const incoming = msg.conceptos as ConceptoWeb[];
            setWebResults((prev) => {
              const seen = new Set(prev.map((x) => x.url));
              return [...prev, ...incoming.filter((x) => !seen.has(x.url))];
            });
          } else if (msg.type === 'web_search_done') {
            setWebStatus('idle');
          }
        });

        const sent = sendWsRef.current(trimmed, webFuente, reqId);
        if (sent) return;
        unsubscribe();
        unsubscribe = undefined;
      }

      if (webFuente !== 'todos') {
        setWebStatus('rapidas');
        try {
          const res = await api.buscarWeb(trimmed, webFuente);
          if (active) setWebResults(res.conceptos ?? []);
        } catch {
          if (active) setWebResults([]);
        } finally {
          if (active) setWebStatus('idle');
        }
        return;
      }

      setWebStatus('rapidas');
      try {
        const res1 = await api.buscarWeb(trimmed, 'rapidas');
        if (!active) return;
        setWebResults(res1.conceptos ?? []);
      } catch {
        // continuar con el lote académico
      }

      if (!active) return;
      setWebStatus('academicas');
      try {
        const res2 = await api.buscarWeb(trimmed, 'academicas');
        if (!active) return;
        const extra = res2.conceptos ?? [];
        if (extra.length > 0) {
          setWebResults((prev) => {
            const seen = new Set(prev.map((x) => x.url));
            return [...prev, ...extra.filter((x) => !seen.has(x.url))];
          });
        }
      } catch {
        // ignore
      } finally {
        if (active) setWebStatus('idle');
      }
    }, 240);

    return () => {
      active = false;
      clearTimeout(timer);
      if (unsubscribe) unsubscribe();
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
    resolveBackendUrl(`/biblioteca-files/${archivo.replace(/^biblioteca\//, '')}`);

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

  const webBusy = webStatus !== 'idle';
  const tieneConsultaWeb = q.trim().length >= 2 && alcance !== 'catalogo';

  const cambiarAlcance = (nuevo: AlcanceFiltro) => {
    setAlcance(nuevo);
    onModeChange?.(nuevo === 'web' ? 'web' : 'catalogo', q.trim());
  };

  return (
    <View className="gap-5">
      {/* Cabecera */}
      <View className="rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm gap-4">
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="flex-1 min-w-[220px]">
            <View className="flex-row items-center gap-2">
              <FolderOpen size={22} color="#0d9488" />
              <Text className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-slate-100">
                Biblioteca y Explorador Web
              </Text>
            </View>
            <Text className="mt-1 text-xs sm:text-sm text-stone-600 dark:text-slate-400">
              Busca en un solo lugar dentro de los {resumen?.total_catalogo ?? 140} recursos del portal y en 12 fuentes web confiables.
            </Text>
          </View>

          <View className="flex-row flex-wrap items-center gap-2">
            {resumen && (
              <View className="rounded-lg bg-teal-50 dark:bg-teal-950/70 border border-teal-700/15 dark:border-teal-500/30 px-2.5 py-1">
                <Text className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                  {resumen.con_archivo} PDFs locales
                </Text>
              </View>
            )}
            <View className="rounded-lg bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 px-2.5 py-1">
              <Text className="text-xs font-semibold text-stone-700 dark:text-slate-300">
                {recursos.length} locales
              </Text>
            </View>
          </View>
        </View>

        {/* Barra de búsqueda */}
        <View className="flex-col sm:flex-row gap-2.5">
          <View className="flex-1 flex-row items-center rounded-xl border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-3.5 py-2 gap-2">
            <Search size={17} color="#0d9488" />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Busca guías, libros, normas o conceptos web (ej. ISO 25010, Scrum)..."
              placeholderTextColor="#94a3b8"
              className="flex-1 text-sm text-stone-900 dark:text-slate-100"
            />
            {q.length > 0 && (
              <Pressable onPress={() => setQ('')} className="rounded-lg px-2 py-1 active:bg-stone-200 dark:active:bg-slate-700">
                <Text className="text-xs font-medium text-stone-500 dark:text-slate-400">
                  Limpiar
                </Text>
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={() => setMostrarFiltrosLocales((v) => !v)}
            className={`flex-row items-center justify-center gap-2 rounded-xl border px-4 py-2.5 ${
              mostrarFiltrosLocales
                ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/60'
                : 'border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800'
            }`}
          >
            <SlidersHorizontal size={16} color={mostrarFiltrosLocales ? '#0d9488' : '#94a3b8'} />
            <Text
              className={`text-xs font-semibold ${
                mostrarFiltrosLocales
                  ? 'text-teal-800 dark:text-teal-300'
                  : 'text-stone-700 dark:text-slate-200'
              }`}
            >
              Filtros locales
            </Text>
          </Pressable>
        </View>

        {/* Alcance */}
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <View className="flex-row flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'todos', label: 'Todo (Catálogo + Web)', web: false },
                { id: 'catalogo', label: 'Solo Catálogo local', web: false },
                { id: 'web', label: 'Solo Web (12 fuentes)', web: true },
              ] as const
            ).map((opt) => {
              const active = alcance === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => cambiarAlcance(opt.id)}
                  className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-1.5 ${
                    active ? 'bg-teal-700' : 'bg-stone-100 dark:bg-slate-800'
                  }`}
                >
                  {opt.web && <Globe size={13} color={active ? '#ffffff' : '#94a3b8'} />}
                  <Text
                    className={`text-xs font-semibold ${
                      active ? 'text-white' : 'text-stone-600 dark:text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {hayFiltrosActivos && (
            <Pressable
              onPress={limpiarFiltros}
              className="flex-row items-center gap-1 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 active:bg-stone-50"
            >
              <RotateCcw size={13} color="#94a3b8" />
              <Text className="text-xs font-medium text-stone-600 dark:text-slate-300">
                Restablecer
              </Text>
            </Pressable>
          )}
        </View>

        {/* Sugerencias rápidas */}
        {q.trim().length === 0 && (
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Text className="text-[11px] font-medium text-stone-400 mr-1">Sugerencias:</Text>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => setQ(s)}
                className="rounded-full border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-2.5 py-1 active:border-teal-600"
              >
                <Text className="text-[11px] font-medium text-stone-700 dark:text-slate-300">
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Panel de filtros locales */}
        {mostrarFiltrosLocales && (
          <View className="border-t border-stone-100 pt-3.5 gap-3">
            <View className="flex-row flex-wrap gap-2">
              {[
                { label: 'Área:', value: area, options: ['todas', ...areas.map((a) => a.id)], onChange: setArea },
                {
                  label: 'Tipo:',
                  value: tipo,
                  options: ['todos', 'oficial', 'guia', 'libro', 'norma', 'documentacion', 'articulo', 'plataforma', 'video'],
                  onChange: setTipo,
                },
                { label: 'Idioma:', value: idioma, options: ['todos', 'es', 'en'], onChange: setIdioma },
              ].map((grp) => (
                <ScrollView
                  key={grp.label}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="w-full"
                >
                  <View className="flex-row items-center gap-1.5 py-0.5">
                    <Text className="text-xs font-semibold text-stone-500 mr-1">{grp.label}</Text>
                    {grp.options.map((opt) => (
                      <Pressable
                        key={opt}
                        onPress={() => grp.onChange(opt)}
                        className={`rounded-lg px-2.5 py-1 ${
                          grp.value === opt ? 'bg-teal-700' : 'bg-stone-100'
                        }`}
                      >
                        <Text
                          className={`text-xs font-medium ${
                            grp.value === opt ? 'text-white' : 'text-stone-700'
                          }`}
                        >
                          {opt}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              ))}
            </View>

            <View className="flex-row flex-wrap gap-2">
              {[
                { label: 'Solo con PDF local', val: soloArchivo, set: setSoloArchivo },
                { label: 'Solo oficiales Ceneval', val: soloOficial, set: setSoloOficial },
                { label: 'Solo acceso gratuito', val: soloGratuito, set: setSoloGratuito },
              ].map((chk) => (
                <Pressable
                  key={chk.label}
                  onPress={() => chk.set(!chk.val)}
                  className={`rounded-lg border px-3 py-1.5 ${
                    chk.val ? 'border-teal-600 bg-teal-50' : 'border-stone-200 bg-white'
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      chk.val ? 'text-teal-800' : 'text-stone-700'
                    }`}
                  >
                    {chk.val ? '✓ ' : ''}
                    {chk.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Resumen rápido Wikipedia arriba */}
      {alcance !== 'catalogo' && q.trim().length >= 2 && wikiKnowledge && webFuente === 'todos' && (
        <View className="rounded-2xl border border-sky-200 dark:border-sky-800/60 bg-sky-50/70 dark:bg-sky-950/40 p-5 shadow-sm">
          <View className="flex-row items-center gap-2 mb-2">
            <Sparkles size={16} color="#0284c7" />
            <Text className="text-[11px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
              Resumen rápido · Wikipedia
            </Text>
          </View>
          <Text className="text-lg font-bold text-stone-900 dark:text-slate-100">
            {wikiKnowledge.title}
          </Text>
          {wikiKnowledge.extract ? (
            <Text className="mt-2 text-sm leading-relaxed text-stone-700 dark:text-slate-300">
              {wikiKnowledge.extract}
            </Text>
          ) : null}
          <Pressable
            onPress={() =>
              setViewerItem({
                title: wikiKnowledge.title,
                url: wikiKnowledge.url,
                sourceLabel: 'Wikipedia',
                summary: wikiKnowledge.extract,
              })
            }
            className="mt-3 self-start flex-row items-center gap-1.5 rounded-xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-700 px-3.5 py-2 active:bg-sky-50"
          >
            <BookOpen size={14} color="#0284c7" />
            <Text className="text-xs font-semibold text-sky-700 dark:text-sky-300">
              Leer artículo completo
            </Text>
            <ExternalLink size={12} color="#0284c7" />
          </Pressable>
        </View>
      )}

      {/* Sección Catálogo Local */}
      {alcance !== 'web' && (
        <View className="gap-3">
          {tieneConsultaWeb && (
            <View className="flex-row items-center gap-2">
              <FolderOpen size={16} color="#0f766e" />
              <Text className="text-sm font-bold text-stone-800">
                En el Catálogo EGEL ({recursos.length})
              </Text>
            </View>
          )}

          {loadingLocal ? (
            <View className="py-12 items-center justify-center rounded-2xl border border-stone-200 bg-white">
              <ActivityIndicator size="large" color="#0f766e" />
            </View>
          ) : recursos.length === 0 ? (
            <View className="rounded-2xl border border-stone-200 bg-white p-6 items-center gap-2">
              <Text className="text-sm text-stone-500 text-center">
                No se encontraron recursos locales con esos filtros.
              </Text>
              {alcance === 'todos' && q.trim().length >= 2 && (
                <Text className="text-xs text-teal-700 text-center">
                  Revisa los resultados web de abajo para «{q.trim()}».
                </Text>
              )}
            </View>
          ) : (
            <View className="gap-3">
              <View className="flex-row flex-wrap gap-3">
                {recursos.slice(0, visibleLocalCount).map((r) => (
                  <View
                    key={r.id}
                    className="w-full md:w-[48.5%] lg:w-[32%] rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm justify-between"
                  >
                    <View>
                      <View className="flex-row flex-wrap items-center justify-between gap-2 mb-2">
                        <View className="flex-row flex-wrap items-center gap-1.5">
                          <View className="rounded bg-stone-100 dark:bg-slate-800 px-2 py-0.5">
                            <Text className="text-[10px] font-bold uppercase text-stone-600 dark:text-slate-300">
                              {r.tipo}
                            </Text>
                          </View>
                          {r.oficial && (
                            <View className="flex-row items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5">
                              <Star size={10} color="#d97706" />
                              <Text className="text-[10px] font-bold text-amber-800 dark:text-amber-300">
                                Oficial
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-xs text-stone-400">
                          {r.anio || ''} {r.idioma ? `· ${r.idioma.toUpperCase()}` : ''}
                        </Text>
                      </View>

                      <Text className="text-sm font-bold text-stone-900 dark:text-slate-100 leading-snug">
                        {r.titulo}
                      </Text>
                      {r.autores && (
                        <Text className="mt-1 text-xs text-stone-500 dark:text-slate-400">
                          {r.autores}
                        </Text>
                      )}
                      {r.nota && (
                        <Text numberOfLines={3} className="mt-2 text-xs text-stone-600 dark:text-slate-300 leading-relaxed">
                          {r.nota}
                        </Text>
                      )}
                    </View>

                    <View className="mt-4 pt-3 border-t border-stone-100 dark:border-slate-800 gap-2.5">
                      <View className="flex-row flex-wrap gap-1">
                        {r.areas.map((a) => (
                          <View key={a} className="rounded bg-teal-50 dark:bg-teal-950/70 px-1.5 py-0.5">
                            <Text className="text-[11px] font-semibold text-teal-800 dark:text-teal-300">
                              {a}
                            </Text>
                          </View>
                        ))}
                      </View>

                      <View className="flex-row flex-wrap gap-2">
                        {r.archivo && (
                          <Pressable
                            onPress={() =>
                              setViewerItem({
                                title: r.titulo,
                                url: fileUrl(r.archivo!),
                                sourceLabel: r.tipo.toUpperCase(),
                                summary: r.nota,
                                meta: [r.autores, r.anio].filter(Boolean).join(' · '),
                                isPdf: true,
                              })
                            }
                            className="flex-row items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 active:bg-teal-800"
                          >
                            <Eye size={13} color="#ffffff" />
                            <Text className="text-xs font-semibold text-white">Ver PDF</Text>
                          </Pressable>
                        )}
                        {r.url && (
                          <Pressable
                            onPress={() =>
                              setViewerItem({
                                title: r.titulo,
                                url: r.url!,
                                sourceLabel: r.tipo.toUpperCase(),
                                summary: r.nota,
                                meta: [r.autores, r.anio].filter(Boolean).join(' · '),
                              })
                            }
                            className="flex-row items-center gap-1 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-3 py-1.5 active:bg-stone-100"
                          >
                            <ExternalLink size={13} color="#94a3b8" />
                            <Text className="text-xs font-semibold text-stone-700 dark:text-slate-200">
                              Abrir recurso
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {recursos.length > visibleLocalCount && (
                <View className="py-3 flex-row items-center justify-center gap-2">
                  <ActivityIndicator size="small" color="#0f766e" />
                  <Text className="text-xs text-stone-500">
                    Cargando más recursos ({recursos.length - visibleLocalCount} restantes)...
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Sección Explorador Web */}
      {alcance !== 'catalogo' && (
        <View className="gap-4">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <View className="flex-row items-center gap-2">
              <Globe size={16} color="#0369a1" />
              <Text className="text-sm font-bold text-stone-800">
                Resultados en la web ({webResults.length})
              </Text>
            </View>

            {webBusy && (
              <View className="flex-row items-center gap-1.5">
                <ActivityIndicator size="small" color="#0369a1" />
                <Text className="text-xs font-medium text-sky-700">
                  {webStatus === 'rapidas'
                    ? 'Consultando fuentes rápidas...'
                    : 'Ampliando con fuentes académicas...'}
                </Text>
              </View>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row items-center gap-1.5 pb-1">
              <Pressable
                onPress={() => setWebFuente('todos')}
                className={`rounded-full px-3 py-1.5 ${
                  webFuente === 'todos' ? 'bg-sky-700' : 'border border-stone-200 bg-white'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    webFuente === 'todos' ? 'text-white' : 'text-stone-600'
                  }`}
                >
                  Todas (12)
                </Text>
              </Pressable>
              {WEB_SOURCES.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => setWebFuente(f.id)}
                  className={`rounded-full px-3 py-1.5 ${
                    webFuente === f.id ? 'bg-sky-700' : 'border border-stone-200 bg-white'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      webFuente === f.id ? 'text-white' : 'text-stone-600'
                    }`}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {q.trim().length < 2 ? (
            <View className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 p-6 items-center gap-2">
              <Globe size={28} color="#0284c7" />
              <Text className="text-sm font-semibold text-stone-800 text-center">
                Consulta conceptos en 12 fuentes abiertas y académicas
              </Text>
              <Text className="text-xs text-stone-600 text-center max-w-lg">
                Escribe un tema arriba (ej. <Text className="font-bold">ISO 25010</Text>,{' '}
                <Text className="font-bold">Docker</Text>, <Text className="font-bold">ATAM</Text>)
                para consultar Wikipedia, Wikidata, MDN, GitHub, Stack Overflow, Hacker News, Reddit y repositorios científicos.
              </Text>
            </View>
          ) : !webBusy && webResults.length === 0 ? (
            <View className="rounded-2xl border border-stone-200 bg-white p-6 items-center">
              <Text className="text-sm text-stone-500 text-center">
                No se encontraron resultados web para «{q.trim()}».
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              <View className="flex-row flex-wrap gap-3">
                {webResults.slice(0, visibleWebCount).map((item) => {
                  const badge = item.category ? SOURCE_BADGES[item.category] : null;
                  return (
                    <Pressable
                      key={`${item.source}-${item.url}`}
                      onPress={() =>
                        setViewerItem({
                          title: item.title,
                          url: item.url,
                          sourceLabel: badge?.label ?? item.source,
                          summary: item.extract,
                        })
                      }
                      className={`w-full md:w-[48.5%] rounded-2xl border border-stone-200 dark:border-slate-800 border-l-4 ${
                        badge?.accentCls ?? 'border-l-sky-500'
                      } bg-white dark:bg-slate-900 p-4 shadow-sm active:bg-sky-50/30`}
                    >
                      <View className="flex-row items-center justify-between gap-2 mb-1.5">
                        <View className={`rounded px-2 py-0.5 ${badge?.bgCls ?? 'bg-sky-50'}`}>
                          <Text className={`text-[10px] font-bold ${badge?.textCls ?? 'text-sky-700'}`}>
                            {badge?.label ?? item.source}
                          </Text>
                        </View>
                        <ExternalLink size={13} color="#0284c7" />
                      </View>
                      <Text className="text-sm font-bold text-stone-900 dark:text-slate-100">
                        {item.title}
                      </Text>
                      {item.extract ? (
                        <Text numberOfLines={3} className="mt-1.5 text-xs text-stone-600 dark:text-slate-300 leading-relaxed">
                          {item.extract}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {webResults.length > visibleWebCount && (
                <View className="py-3 flex-row items-center justify-center gap-2">
                  <ActivityIndicator size="small" color="#0369a1" />
                  <Text className="text-xs text-sky-700">
                    Cargando más resultados ({webResults.length - visibleWebCount} restantes)...
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Ventana integrada para ver contenido sin salir */}
      <ResourceViewerModal item={viewerItem} onClose={() => setViewerItem(null)} />
    </View>
  );
}
