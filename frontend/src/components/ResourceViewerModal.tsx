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
import { BookOpen, ExternalLink, FileText, Globe, PlayCircle, X } from 'lucide-react-native';
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
  markdown?: string;
  isReadme?: boolean;
  blocks: Array<{ tag: string; text: string }>;
}

interface VideoEmbedInfo {
  kind: 'iframe' | 'video';
  provider: string;
  embedUrl: string;
}

function getVideoEmbedInfo(rawUrl: string): VideoEmbedInfo | null {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path = parsed.pathname;

    // YouTube (watch, youtu.be, shorts, embed, live)
    let ytId: string | null = null;
    if (host === 'youtu.be') {
      ytId = path.split('/').filter(Boolean)[0] ?? null;
    } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (path === '/watch') {
        ytId = parsed.searchParams.get('v');
      } else if (
        path.startsWith('/embed/') ||
        path.startsWith('/shorts/') ||
        path.startsWith('/live/')
      ) {
        ytId = path.split('/').filter(Boolean)[1] ?? null;
      }
    }

    if (ytId && /^[a-zA-Z0-9_-]{6,}$/.test(ytId)) {
      const start = parsed.searchParams.get('t') || parsed.searchParams.get('start');
      const startSeconds = start ? parseInt(start.replace(/s$/i, ''), 10) : NaN;
      const startParam = !Number.isNaN(startSeconds) && startSeconds > 0 ? `&start=${startSeconds}` : '';
      return {
        kind: 'iframe',
        provider: 'YouTube',
        embedUrl: `https://www.youtube.com/embed/${ytId}?rel=0&playsinline=1${startParam}`,
      };
    }

    // Vimeo
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const segments = path.split('/').filter(Boolean);
      const vimeoId = segments[segments.length - 1];
      if (vimeoId && /^\d+$/.test(vimeoId)) {
        return {
          kind: 'iframe',
          provider: 'Vimeo',
          embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
        };
      }
    }

    // Archivos de video directos (.mp4, .webm, .ogg, .m4v)
    if (/\.(mp4|webm|ogg|m4v)$/i.test(path)) {
      return {
        kind: 'video',
        provider: 'Video',
        embedUrl: rawUrl,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const cleaned = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  const tokens = cleaned.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith('`') && tok.endsWith('`')) {
      return (
        <Text
          key={i}
          className="rounded bg-stone-100 dark:bg-slate-800 px-1 font-mono text-[12px] text-teal-800 dark:text-teal-300"
        >
          {tok.slice(1, -1)}
        </Text>
      );
    }
    if (tok.startsWith('**') && tok.endsWith('**')) {
      return (
        <Text key={i} className="font-bold text-stone-900 dark:text-slate-100">
          {tok.slice(2, -2)}
        </Text>
      );
    }
    if (tok.startsWith('*') && tok.endsWith('*')) {
      return (
        <Text key={i} className="italic text-stone-700 dark:text-slate-300">
          {tok.slice(1, -1)}
        </Text>
      );
    }
    return tok;
  });
}

function ReadmeMarkdownView({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Ignorar HTML puro (badges/centered divs de README)
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
      i++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <ScrollView
          key={`code-${i}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          className="my-2.5 rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-800 p-3.5"
        >
          <Text selectable className="font-mono text-xs text-emerald-300 leading-relaxed">
            {codeLines.join('\n')}
          </Text>
        </ScrollView>
      );
      continue;
    }

    if (trimmed.startsWith('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
      const headers = line.split('|').slice(1, -1).map((c) => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
        i++;
      }
      blocks.push(
        <ScrollView
          key={`tbl-${i}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          className="my-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <View className="min-w-[460px]">
            <View className="flex-row bg-stone-100 dark:bg-slate-800 border-b border-stone-200 dark:border-slate-700">
              {headers.map((h, idx) => (
                <View key={idx} className="w-40 px-3 py-2">
                  <Text className="text-xs font-bold text-stone-800 dark:text-slate-200">
                    {renderInlineMarkdown(h)}
                  </Text>
                </View>
              ))}
            </View>
            {rows.map((r, rIdx) => (
              <View key={rIdx} className="flex-row border-b border-stone-100 dark:border-slate-800">
                {r.map((cell, cIdx) => (
                  <View key={cIdx} className="w-40 px-3 py-2">
                    <Text className="text-xs text-stone-700 dark:text-slate-300">
                      {renderInlineMarkdown(cell)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
      continue;
    }

    if (trimmed.startsWith('# ')) {
      blocks.push(
        <Text key={i} className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-slate-100 mt-2 mb-1">
          {renderInlineMarkdown(trimmed.slice(2))}
        </Text>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push(
        <View key={i} className="mt-4 mb-1.5 border-b border-stone-200 dark:border-slate-700 pb-1">
          <Text className="text-base sm:text-lg font-bold text-teal-800 dark:text-teal-400">
            {renderInlineMarkdown(trimmed.slice(3))}
          </Text>
        </View>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      blocks.push(
        <Text key={i} className="mt-3 mb-1 text-sm sm:text-base font-bold text-stone-900 dark:text-slate-100">
          {renderInlineMarkdown(trimmed.slice(4))}
        </Text>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('> ')) {
      blocks.push(
        <View key={i} className="my-2 rounded-r-xl border-l-4 border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 px-3.5 py-2.5">
          <Text className="text-xs sm:text-sm text-stone-800 dark:text-amber-100 leading-relaxed">
            {renderInlineMarkdown(trimmed.slice(2))}
          </Text>
        </View>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push(
        <View key={`ul-${i}`} className="my-1.5 gap-1 pl-2">
          {items.map((it, idx) => (
            <View key={idx} className="flex-row items-start gap-2">
              <Text className="text-sm font-bold text-teal-700 dark:text-teal-400">•</Text>
              <Text className="flex-1 text-sm text-stone-700 dark:text-slate-300 leading-relaxed">
                {renderInlineMarkdown(it)}
              </Text>
            </View>
          ))}
        </View>
      );
      continue;
    }
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''));
        i++;
      }
      blocks.push(
        <View key={`ol-${i}`} className="my-1.5 gap-1 pl-2">
          {items.map((it, idx) => (
            <View key={idx} className="flex-row items-start gap-2">
              <Text className="text-sm font-bold text-teal-700 dark:text-teal-400">{idx + 1}.</Text>
              <Text className="flex-1 text-sm text-stone-700 dark:text-slate-300 leading-relaxed">
                {renderInlineMarkdown(it)}
              </Text>
            </View>
          ))}
        </View>
      );
      continue;
    }
    if (trimmed === '---' || trimmed === '***') {
      blocks.push(<View key={i} className="my-3 h-px bg-stone-200 dark:bg-slate-800" />);
      i++;
      continue;
    }

    blocks.push(
      <Text key={i} className="my-1 text-sm text-stone-700 dark:text-slate-300 leading-relaxed">
        {renderInlineMarkdown(trimmed)}
      </Text>
    );
    i++;
  }

  return <View>{blocks}</View>;
}

export function ResourceViewerModal({ item, onClose }: ResourceViewerModalProps) {
  const [loading, setLoading] = useState(false);
  const [readerData, setReaderData] = useState<ReaderData | null>(null);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [mobileMode, setMobileMode] = useState<'reader' | 'webview'>('webview');

  const isLocalPdf = Boolean(item?.isPdf);
  const videoInfo = item ? getVideoEmbedInfo(item.url) : null;

  useEffect(() => {
    if (!item || isLocalPdf || videoInfo) {
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
          markdown: res.markdown,
          isReadme: res.is_readme,
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
                ) : videoInfo ? (
                  <PlayCircle size={16} color="#dc2626" />
                ) : (
                  <BookOpen size={16} color="#0284c7" />
                )}
              </View>
              <View className="flex-1 min-w-0">
                <Text numberOfLines={1} className="text-sm font-bold text-stone-900 dark:text-slate-100">
                  {item.title}
                </Text>
                {(item.sourceLabel || item.meta || readerData?.host || videoInfo?.provider) && (
                  <Text numberOfLines={1} className="text-[11px] text-stone-500 dark:text-slate-400">
                    {[
                      item.sourceLabel,
                      videoInfo?.provider &&
                      item.sourceLabel?.toLowerCase() !== videoInfo.provider.toLowerCase()
                        ? videoInfo.provider
                        : null,
                      readerData?.host,
                      item.meta,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                )}
              </View>
            </View>

            <View className="flex-row items-center gap-2 shrink-0">
              {Platform.OS !== 'web' && !isLocalPdf && !videoInfo && (
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
            {videoInfo ? (
              Platform.OS === 'web' ? (
                <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
                  <View className="mx-auto w-full max-w-3xl gap-4">
                    <View
                      className="w-full rounded-2xl overflow-hidden bg-black border border-stone-200 dark:border-slate-800 shadow-lg"
                      style={{ aspectRatio: 16 / 9 }}
                    >
                      {videoInfo.kind === 'iframe' ? (
                        <iframe
                          src={videoInfo.embedUrl}
                          title={item.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          style={{ width: '100%', height: '100%', border: 0 }}
                        />
                      ) : (
                        <video
                          src={videoInfo.embedUrl}
                          controls
                          playsInline
                          style={{ width: '100%', height: '100%', backgroundColor: '#000000' }}
                        />
                      )}
                    </View>

                    <View className="rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 gap-2">
                      <View className="flex-row items-center gap-2">
                        <PlayCircle size={14} color="#dc2626" />
                        <Text className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                          Reproductor integrado · {videoInfo.provider}
                        </Text>
                      </View>
                      <Text className="text-base sm:text-lg font-bold text-stone-900 dark:text-slate-100">
                        {item.title}
                      </Text>
                      {item.summary ? (
                        <Text className="text-xs sm:text-sm text-stone-600 dark:text-slate-300 leading-relaxed">
                          {item.summary}
                        </Text>
                      ) : null}
                      <Text className="text-[11px] text-stone-500 dark:text-slate-400">
                        Si el video tiene deshabilitada la reproducción embebida por su autor, usa «Ver fuera del sistema».
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              ) : (
                <WebView
                  source={{ uri: videoInfo.embedUrl }}
                  allowsFullscreenVideo
                  mediaPlaybackRequiresUserAction={false}
                  javaScriptEnabled
                  domStorageEnabled
                  startInLoadingState
                  style={{ flex: 1, backgroundColor: '#000000' }}
                />
              )
            ) : isLocalPdf ? (
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

                  {readerData?.markdown ? (
                    <View className="pt-2 border-t border-stone-100 dark:border-slate-800">
                      <ReadmeMarkdownView content={readerData.markdown} />
                    </View>
                  ) : readerData && readerData.blocks.length > 0 ? (
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
