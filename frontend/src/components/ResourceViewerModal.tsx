import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookOpen, ExternalLink, FileText, Globe, X } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { api } from '../lib/api';

export interface ViewerItem {
  title: string;
  url: string;
  sourceLabel?: string;
  summary?: string | null;
  meta?: string | null;
  isPdf?: boolean;
}

interface ResourceViewerModalProps {
  item: ViewerItem | null;
  onClose: () => void;
}

interface ReaderData {
  title: string;
  description: string;
  host: string;
  blocks: Array<{ tag: string; text: string }>;
}

export function ResourceViewerModal({ item, onClose }: ResourceViewerModalProps) {
  const [loading, setLoading] = useState(false);
  const [readerData, setReaderData] = useState<ReaderData | null>(null);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [mobileMode, setMobileMode] = useState<'reader' | 'webview'>('webview');

  const isLocalPdf = Boolean(item?.isPdf);

  useEffect(() => {
    if (!item || isLocalPdf) {
      setReaderData(null);
      setReaderError(null);
      setLoading(false);
      return;
    }

    if (Platform.OS !== 'web' && mobileMode === 'webview') {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setReaderError(null);
    setReaderData(null);

    api
      .leerUrl(item.url)
      .then((res) => {
        if (cancelled) return;
        setReaderData({
          title: res.title || item.title,
          description: res.description || '',
          host: res.host,
          blocks: res.blocks ?? [],
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setReaderError(
          err instanceof Error
            ? err.message
            : 'No se pudo cargar la vista previa integrada de este sitio.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item, isLocalPdf, mobileMode]);

  if (!item) return null;

  const viewerUrl =
    Platform.OS === 'android' && isLocalPdf
      ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(item.url)}`
      : item.url;

  return (
    <Modal visible={Boolean(item)} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-stone-950/75 sm:p-4 items-center justify-center">
        <Pressable onPress={onClose} className="hidden sm:flex absolute inset-0" />

        <SafeAreaView
          edges={['top', 'bottom']}
          className="w-full h-full sm:h-[88%] sm:max-w-4xl sm:rounded-3xl bg-white dark:bg-slate-900 overflow-hidden shadow-2xl border border-stone-200 dark:border-slate-800"
        >
          {/* Barra superior */}
          <View className="flex-row items-center justify-between gap-2 border-b border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
            <View className="flex-1 flex-row items-center gap-2.5 min-w-0">
              <View className="h-8 w-8 rounded-xl bg-teal-50 dark:bg-teal-950/70 items-center justify-center shrink-0">
                {isLocalPdf ? (
                  <FileText size={16} color="#0d9488" />
                ) : (
                  <BookOpen size={16} color="#0284c7" />
                )}
              </View>
              <View className="flex-1 min-w-0">
                <Text numberOfLines={1} className="text-sm font-bold text-stone-900 dark:text-slate-100">
                  {item.title}
                </Text>
                {(item.sourceLabel || item.meta || readerData?.host) && (
                  <Text numberOfLines={1} className="text-[11px] text-stone-500 dark:text-slate-400">
                    {[item.sourceLabel, readerData?.host, item.meta].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
            </View>

            <View className="flex-row items-center gap-2 shrink-0">
              {Platform.OS !== 'web' && !isLocalPdf && (
                <Pressable
                  onPress={() =>
                    setMobileMode((m) => (m === 'webview' ? 'reader' : 'webview'))
                  }
                  className="rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-2.5 py-2 active:bg-stone-100"
                >
                  <Text className="text-[11px] font-semibold text-stone-700 dark:text-slate-200">
                    {mobileMode === 'webview' ? 'Modo lectura' : 'Web en vivo'}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => Linking.openURL(item.url)}
                className="flex-row items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-2 active:bg-teal-800"
              >
                <ExternalLink size={14} color="#ffffff" />
                <Text className="text-xs font-semibold text-white">
                  Ver fuera del sistema
                </Text>
              </Pressable>

              <Pressable
                onPress={onClose}
                className="rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 p-2 active:bg-stone-100"
              >
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>
          </View>

          {/* Contenido */}
          <View className="flex-1 bg-stone-50 dark:bg-slate-950 relative">
            {isLocalPdf ? (
              Platform.OS === 'web' ? (
                <iframe
                  src={item.url}
                  title={item.title}
                  style={{ width: '100%', height: '100%', border: 0, backgroundColor: '#ffffff' }}
                />
              ) : (
                <WebView source={{ uri: viewerUrl }} startInLoadingState style={{ flex: 1 }} />
              )
            ) : Platform.OS !== 'web' && mobileMode === 'webview' ? (
              <WebView source={{ uri: item.url }} startInLoadingState style={{ flex: 1 }} />
            ) : loading ? (
              <View className="flex-1 items-center justify-center p-6 gap-2.5">
                <ActivityIndicator size="large" color="#0f766e" />
                <Text className="text-xs text-stone-600">
                  Cargando contenido en modo lectura...
                </Text>
              </View>
            ) : (
              <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
                <View className="mx-auto w-full max-w-2xl rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-xs gap-4">
                  <View className="flex-row items-center gap-2">
                    <Globe size={14} color="#0284c7" />
                    <Text className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                      Vista integrada · {item.sourceLabel ?? readerData?.host ?? 'Web'}
                    </Text>
                  </View>

                  <Text className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-slate-100 leading-snug">
                    {readerData?.title || item.title}
                  </Text>

                  {(item.summary || readerData?.description) && (
                    <View className="rounded-xl border border-teal-100 dark:border-teal-800/50 bg-teal-50/60 dark:bg-teal-950/40 p-3.5">
                      <Text className="text-xs sm:text-sm text-teal-950 dark:text-teal-200 leading-relaxed">
                        {readerData?.description || item.summary}
                      </Text>
                    </View>
                  )}

                  {readerData && readerData.blocks.length > 0 ? (
                    <View className="gap-3 pt-2 border-t border-stone-100 dark:border-slate-800">
                      {readerData.blocks.map((b, idx) => {
                        if (b.tag === 'h1' || b.tag === 'h2') {
                          return (
                            <Text
                              key={idx}
                              className="mt-2 text-base sm:text-lg font-bold text-stone-900 dark:text-slate-100"
                            >
                              {b.text}
                            </Text>
                          );
                        }
                        if (b.tag === 'h3') {
                          return (
                            <Text key={idx} className="mt-1 text-sm font-bold text-teal-800 dark:text-teal-400">
                              {b.text}
                            </Text>
                          );
                        }
                        if (b.tag === 'pre') {
                          return (
                            <View key={idx} className="rounded-xl bg-stone-900 dark:bg-slate-950 p-3.5">
                              <Text selectable className="font-mono text-xs text-emerald-300">
                                {b.text}
                              </Text>
                            </View>
                          );
                        }
                        if (b.tag === 'li') {
                          return (
                            <View key={idx} className="flex-row items-start gap-2 pl-2">
                              <Text className="text-sm font-bold text-teal-700 dark:text-teal-400">•</Text>
                              <Text className="flex-1 text-sm text-stone-700 dark:text-slate-300 leading-relaxed">
                                {b.text}
                              </Text>
                            </View>
                          );
                        }
                        return (
                          <Text key={idx} className="text-sm text-stone-700 dark:text-slate-300 leading-relaxed">
                            {b.text}
                          </Text>
                        );
                      })}
                    </View>
                  ) : (
                    <View className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 p-4 gap-3">
                      <Text className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                        {readerError ||
                          'Este sitio no permitió extraer el texto completo automáticamente (o requiere JavaScript interactivo).'}
                      </Text>
                      <Pressable
                        onPress={() => Linking.openURL(item.url)}
                        className="self-start flex-row items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 active:bg-teal-800"
                      >
                        <ExternalLink size={14} color="#ffffff" />
                        <Text className="text-xs font-semibold text-white">
                          Ver fuera del sistema
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
