import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  PlayCircle,
  Search,
  Terminal,
  X,
} from 'lucide-react-native';
import { api } from '../lib/api';
import { copyText } from '../lib/clipboard';
import type { AppTab } from '../lib/router';
import type { ConceptoWeb, ResultadoBusqueda } from '../types/egel';
import { ResourceViewerModal, type ViewerItem } from './ResourceViewerModal';

type SearchTipo = 'todos' | 'guias' | 'preguntas' | 'comandos' | 'recursos' | 'web';

const SUGGESTED_QUERIES = ['ISO 25010', 'Scrum', 'REST', 'SQL', 'Docker', 'RACI', 'ATAM'];

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (
    tab: AppTab,
    opts?: { area?: string; subarea?: string; guiaClave?: string }
  ) => void;
  onOpenWebPortal?: (query: string) => void;
}

const CATEGORY_LABELS: Record<string, { label: string; cls: string; textCls: string }> = {
  wikipedia: { label: 'Wikipedia', cls: 'bg-sky-50', textCls: 'text-sky-700' },
  wikidata: { label: 'Wikidata', cls: 'bg-cyan-50', textCls: 'text-cyan-800' },
  mdn: { label: 'MDN Docs', cls: 'bg-indigo-50', textCls: 'text-indigo-700' },
  stackoverflow: { label: 'Stack Overflow', cls: 'bg-orange-50', textCls: 'text-orange-700' },
  hackernews: { label: 'Hacker News', cls: 'bg-amber-100', textCls: 'text-amber-900' },
  reddit: { label: 'Reddit', cls: 'bg-red-50', textCls: 'text-red-700' },
  semanticscholar: { label: 'Semantic Scholar', cls: 'bg-blue-50', textCls: 'text-blue-800' },
  openlibrary: { label: 'Open Library', cls: 'bg-emerald-50', textCls: 'text-emerald-700' },
  openalex: { label: 'OpenAlex', cls: 'bg-violet-50', textCls: 'text-violet-700' },
  crossref: { label: 'Crossref', cls: 'bg-amber-50', textCls: 'text-amber-800' },
  arxiv: { label: 'arXiv', cls: 'bg-rose-50', textCls: 'text-rose-700' },
  github: { label: 'GitHub', cls: 'bg-stone-200', textCls: 'text-stone-800' },
};

export function SearchModal({
  isOpen,
  onClose,
  onNavigate,
  onOpenWebPortal,
}: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [tipo, setTipo] = useState<SearchTipo>('todos');
  const [resultados, setResultados] = useState<ResultadoBusqueda | null>(null);
  const [webConceptos, setWebConceptos] = useState<ConceptoWeb[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingWeb, setLoadingWeb] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [viewerItem, setViewerItem] = useState<ViewerItem | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setTipo('todos');
      setResultados(null);
      setWebConceptos([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!isOpen || trimmed.length < 2) {
      setResultados(null);
      setWebConceptos([]);
      return;
    }

    const localTimer = setTimeout(() => {
      if (tipo === 'web') {
        setResultados({ guias: [], comandos: [], preguntas: [], recursos: [] });
        return;
      }
      setLoading(true);
      api
        .buscar(trimmed, tipo)
        .then((res) => setResultados(res))
        .catch(() => setResultados(null))
        .finally(() => setLoading(false));
    }, 180);

    const webTimer = setTimeout(() => {
      if (tipo !== 'todos' && tipo !== 'web') {
        setWebConceptos([]);
        return;
      }
      setLoadingWeb(true);
      api
        .buscarWeb(trimmed, 'rapidas')
        .then((res) => setWebConceptos(res.conceptos ?? []))
        .catch(() => setWebConceptos([]))
        .finally(() => setLoadingWeb(false));
    }, 320);

    return () => {
      clearTimeout(localTimer);
      clearTimeout(webTimer);
    };
  }, [query, tipo, isOpen]);

  const go = (
    tab: AppTab,
    opts?: { area?: string; subarea?: string; guiaClave?: string }
  ) => {
    onNavigate(tab, opts);
    onClose();
  };

  const copyCommand = async (cmd: string) => {
    try {
      await copyText(cmd);
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd(null), 1400);
    } catch {
      // ignore
    }
  };

  const tabs: Array<{ id: SearchTipo; label: string }> = [
    { id: 'todos', label: 'Todo' },
    { id: 'guias', label: 'Guías' },
    { id: 'preguntas', label: 'Preguntas' },
    { id: 'comandos', label: 'Comandos' },
    { id: 'recursos', label: 'Biblioteca' },
    { id: 'web', label: 'Conceptos Web' },
  ];

  const hayResultadosLocales =
    Boolean(resultados) &&
    (resultados!.guias.length > 0 ||
      resultados!.preguntas.length > 0 ||
      resultados!.comandos.length > 0 ||
      resultados!.recursos.length > 0);

  const sinResultados =
    !loading &&
    !loadingWeb &&
    !hayResultadosLocales &&
    webConceptos.length === 0;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-start bg-stone-950/60 p-4 pt-12 sm:pt-16">
        <Pressable onPress={onClose} className="absolute inset-0" />
        <View className="w-full max-w-2xl rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden max-h-[84%]">
          <View className="flex-row items-center border-b border-stone-200 dark:border-slate-800 px-4 py-3 gap-2.5">
            <Search size={19} color="#0d9488" />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar en guías, preguntas, comandos, biblioteca o web..."
              placeholderTextColor="#94a3b8"
              className="flex-1 text-sm text-stone-900 dark:text-slate-100"
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => setQuery('')}
                className="rounded-lg px-2 py-1 active:bg-stone-100 dark:active:bg-slate-800"
              >
                <Text className="text-[11px] font-medium text-stone-500 dark:text-slate-400">
                  Limpiar
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={onClose}
              className="rounded-lg p-1 active:bg-stone-100 dark:active:bg-slate-800"
            >
              <X size={20} color="#94a3b8" />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="border-b border-stone-100 dark:border-slate-800 bg-stone-50 dark:bg-slate-800/60 px-4 py-2 grow-0"
          >
            <View className="flex-row items-center gap-1.5">
              {tabs.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => setTipo(t.id)}
                  className={`flex-row items-center gap-1 rounded-lg px-2.5 py-1.5 ${
                    tipo === t.id ? 'bg-teal-700' : 'active:bg-stone-200 dark:active:bg-slate-700'
                  }`}
                >
                  {t.id === 'web' && (
                    <Globe size={12} color={tipo === t.id ? '#ffffff' : '#94a3b8'} />
                  )}
                  <Text
                    className={`text-xs font-semibold ${
                      tipo === t.id ? 'text-white' : 'text-stone-600 dark:text-slate-300'
                    }`}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <ScrollView className="p-4" keyboardShouldPersistTaps="handled">
            <View className="gap-4 pb-4">
              {query.trim().length < 2 ? (
                <View className="py-4 items-center gap-3">
                  <Text className="text-xs text-stone-500 text-center">
                    Escribe al menos 2 caracteres para buscar en el portal y conceptos web:
                  </Text>
                  <View className="flex-row flex-wrap justify-center gap-1.5">
                    {SUGGESTED_QUERIES.map((term) => (
                      <Pressable
                        key={term}
                        onPress={() => setQuery(term)}
                        className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 active:border-teal-600 active:bg-teal-50"
                      >
                        <Text className="text-xs font-medium text-stone-700">{term}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : loading && tipo !== 'web' ? (
                <View className="py-6 items-center gap-2">
                  <ActivityIndicator size="small" color="#0f766e" />
                  <Text className="text-xs text-stone-500">Buscando en el portal...</Text>
                </View>
              ) : sinResultados ? (
                <Text className="text-xs text-stone-500 text-center py-6">
                  Sin resultados para «{query}».
                </Text>
              ) : (
                <>
                  {resultados && resultados.guias.length > 0 && (
                    <View className="gap-1">
                      <Text className="text-[11px] font-bold uppercase tracking-wider text-teal-700 mb-1">
                        Guías de estudio ({resultados.guias.length})
                      </Text>
                      {resultados.guias.map((g) => (
                        <Pressable
                          key={g.clave}
                          onPress={() => go('guias', { guiaClave: g.clave })}
                          className="flex-row items-start justify-between gap-2 rounded-xl px-3 py-2 active:bg-teal-50"
                        >
                          <View className="flex-1">
                            <View className="flex-row items-center gap-2">
                              <BookOpen size={14} color="#0f766e" />
                              <Text className="flex-1 text-xs font-semibold text-stone-800">
                                {g.titulo}
                              </Text>
                            </View>
                            {g.snippet && (
                              <Text numberOfLines={1} className="mt-0.5 pl-5 text-[11px] text-stone-500">
                                …{g.snippet}…
                              </Text>
                            )}
                          </View>
                          <ArrowRight size={14} color="#a8a29e" />
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {resultados && resultados.preguntas.length > 0 && (
                    <View className="gap-1">
                      <Text className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                        Preguntas ({resultados.preguntas.length})
                      </Text>
                      {resultados.preguntas.map((p) => (
                        <Pressable
                          key={p.id}
                          onPress={() => go('simulador', { area: p.area, subarea: p.subarea })}
                          className="flex-row items-center gap-2 rounded-xl px-3 py-2 active:bg-amber-50"
                        >
                          <PlayCircle size={14} color="#d97706" />
                          <Text numberOfLines={1} className="flex-1 text-xs text-stone-700">
                            <Text className="font-bold">{p.id}</Text> ({p.subarea}) · {p.pregunta}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {resultados && resultados.comandos.length > 0 && (
                    <View className="gap-1">
                      <Text className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                        Comandos ({resultados.comandos.length})
                      </Text>
                      {resultados.comandos.map((c, i) => (
                        <Pressable
                          key={i}
                          onPress={() => go('comandos')}
                          className="flex-row items-center justify-between gap-2 rounded-xl px-3 py-2 active:bg-stone-100"
                        >
                          <View className="flex-1 flex-row items-center gap-2">
                            <Terminal size={14} color="#78716c" />
                            <Text numberOfLines={1} className="flex-1 text-xs text-stone-700">
                              <Text className="font-mono text-teal-800">{c.comando}</Text> —{' '}
                              {c.descripcion}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => copyCommand(c.comando)}
                            className="rounded-md p-1.5 active:bg-white"
                          >
                            {copiedCmd === c.comando ? (
                              <Check size={14} color="#059669" />
                            ) : (
                              <Copy size={14} color="#a8a29e" />
                            )}
                          </Pressable>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {resultados && resultados.recursos.length > 0 && (
                    <View className="gap-1">
                      <Text className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                        Biblioteca ({resultados.recursos.length})
                      </Text>
                      {resultados.recursos.map((r) => (
                        <Pressable
                          key={r.id}
                          onPress={() => go('biblioteca')}
                          className="flex-row items-center justify-between gap-2 rounded-xl px-3 py-2 active:bg-stone-100"
                        >
                          <View className="flex-1 flex-row items-center gap-2">
                            <FileText size={14} color="#78716c" />
                            <Text numberOfLines={1} className="flex-1 text-xs text-stone-700">
                              {r.titulo}
                            </Text>
                          </View>
                          <View className="rounded bg-stone-100 px-1.5 py-0.5">
                            <Text className="text-[10px] uppercase text-stone-500">{r.tipo}</Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {(tipo === 'todos' || tipo === 'web') && (
                    <View className="gap-1.5">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-1.5">
                          <Globe size={14} color="#0369a1" />
                          <Text className="text-[11px] font-bold uppercase tracking-wider text-sky-700">
                            Conceptos en la web (12 fuentes confiables)
                          </Text>
                        </View>
                        {loadingWeb && (
                          <Text className="text-[11px] text-stone-400">consultando...</Text>
                        )}
                      </View>

                      {webConceptos.slice(0, tipo === 'web' ? 12 : 5).map((c) => {
                        const badge = c.category ? CATEGORY_LABELS[c.category] : null;
                        return (
                          <Pressable
                            key={`${c.source}-${c.url}`}
                            onPress={() =>
                              setViewerItem({
                                title: c.title,
                                url: c.url,
                                sourceLabel: badge?.label ?? c.source,
                                summary: c.extract,
                              })
                            }
                            className="rounded-xl px-3 py-2 active:bg-sky-50"
                          >
                            <View className="flex-row items-center justify-between gap-2">
                              <Text numberOfLines={1} className="flex-1 text-xs font-semibold text-stone-900">
                                {c.title}
                              </Text>
                              <View className="flex-row items-center gap-1.5">
                                {badge && (
                                  <View className={`rounded px-1.5 py-0.5 ${badge.cls}`}>
                                    <Text className={`text-[10px] font-semibold ${badge.textCls}`}>
                                      {badge.label}
                                    </Text>
                                  </View>
                                )}
                                <ExternalLink size={12} color="#0369a1" />
                              </View>
                            </View>
                            {c.extract ? (
                              <Text numberOfLines={2} className="mt-0.5 text-[11px] text-stone-600 leading-relaxed">
                                {c.extract}
                              </Text>
                            ) : null}
                          </Pressable>
                        );
                      })}

                      {onOpenWebPortal && (
                        <Pressable
                          onPress={() => {
                            onOpenWebPortal(query.trim());
                            onClose();
                          }}
                          className="mt-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 active:bg-sky-100"
                        >
                          <Globe size={14} color="#075985" />
                          <Text className="text-xs font-semibold text-sky-800">
                            Ver más de «{query.trim()}» en Explorador Web
                          </Text>
                          <ArrowRight size={14} color="#075985" />
                        </Pressable>
                      )}
                    </View>
                  )}
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
      <ResourceViewerModal item={viewerItem} onClose={() => setViewerItem(null)} />
    </Modal>
  );
}
