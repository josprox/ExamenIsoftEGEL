import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { BookOpen, PlayCircle, Search } from 'lucide-react-native';
import { api } from '../lib/api';
import type { Guia } from '../types/egel';

interface GuiasProps {
  initialClave?: string;
  onPracticeSubarea: (subarea: string) => void;
  onSelectClave?: (clave: string) => void;
}

function renderInline(text: string): React.ReactNode[] {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
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

    // Bloque de código ```
    if (line.trim().startsWith('```')) {
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
          className="my-3 rounded-xl bg-stone-900 p-3.5"
        >
          <Text selectable className="font-mono text-xs text-emerald-300 leading-relaxed">
            {codeLines.join('\n')}
          </Text>
        </ScrollView>
      );
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
        <ScrollView
          key={`tbl-${i}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          className="my-3 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <View className="min-w-[520px]">
            <View className="flex-row bg-stone-100 dark:bg-slate-800 border-b border-stone-200 dark:border-slate-700">
              {headers.map((h, idx) => (
                <View key={idx} className="w-40 px-3 py-2.5">
                  <Text className="text-xs font-bold text-stone-800 dark:text-slate-200">
                    {renderInline(h)}
                  </Text>
                </View>
              ))}
            </View>
            {rows.map((r, rIdx) => (
              <View
                key={rIdx}
                className="flex-row border-b border-stone-100 dark:border-slate-800 bg-white dark:bg-slate-900"
              >
                {r.map((cell, cIdx) => (
                  <View key={cIdx} className="w-40 px-3 py-2.5">
                    <Text className="text-xs text-stone-700 dark:text-slate-300 leading-relaxed">
                      {renderInline(cell)}
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

    if (line.startsWith('# ')) {
      blocks.push(
        <Text key={i} className="text-2xl font-bold text-stone-900 dark:text-slate-100 mb-3">
          {renderInline(line.slice(2))}
        </Text>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <View key={i} className="mt-5 mb-2.5 border-b border-stone-200 dark:border-slate-700 pb-1.5">
          <Text className="text-lg font-bold text-teal-800 dark:text-teal-400">
            {renderInline(line.slice(3))}
          </Text>
        </View>
      );
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push(
        <Text key={i} className="mt-4 mb-2 text-base font-bold text-stone-900 dark:text-slate-100">
          {renderInline(line.slice(4))}
        </Text>
      );
      i++;
      continue;
    }
    if (line.startsWith('> ')) {
      blocks.push(
        <View
          key={i}
          className="my-3 rounded-r-xl border-l-4 border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 px-4 py-3"
        >
          <Text className="text-sm text-stone-800 dark:text-amber-100 leading-relaxed">
            {renderInline(line.slice(2))}
          </Text>
        </View>
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
        <View key={`ul-${i}`} className="my-2 gap-1.5 pl-2">
          {items.map((it, idx) => (
            <View key={idx} className="flex-row items-start gap-2">
              <Text className="text-sm font-bold text-teal-700 dark:text-teal-400">•</Text>
              <Text className="flex-1 text-sm text-stone-700 dark:text-slate-300 leading-relaxed">
                {renderInline(it)}
              </Text>
            </View>
          ))}
        </View>
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
        <View key={`ol-${i}`} className="my-2 gap-1.5 pl-2">
          {items.map((it, idx) => (
            <View key={idx} className="flex-row items-start gap-2">
              <Text className="text-sm font-bold text-teal-700 dark:text-teal-400">{idx + 1}.</Text>
              <Text className="flex-1 text-sm text-stone-700 dark:text-slate-300 leading-relaxed">
                {renderInline(it)}
              </Text>
            </View>
          ))}
        </View>
      );
      continue;
    }

    blocks.push(
      <Text key={i} className="my-1.5 text-sm text-stone-700 dark:text-slate-300 leading-relaxed">
        {renderInline(line)}
      </Text>
    );
    i++;
  }

  return <View>{blocks}</View>;
}

export function Guias({ initialClave, onPracticeSubarea, onSelectClave }: GuiasProps) {
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
  const esSubarea = Boolean(guiaActual && /^\d\.\d$/.test(guiaActual.clave));

  return (
    <View className="flex-col lg:flex-row gap-5">
      {/* Índice de guías */}
      <View className="w-full lg:w-[290px] rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm self-start">
        <View className="flex-row items-center gap-2 mb-3">
          <BookOpen size={16} color="#0d9488" />
          <Text className="text-sm font-bold text-stone-900 dark:text-slate-100">
            Guías de Estudio ({guias.length})
          </Text>
        </View>

        <View className="flex-row items-center rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-3 py-1.5 gap-2 mb-3">
          <Search size={14} color="#94a3b8" />
          <TextInput
            value={filtro}
            onChangeText={setFiltro}
            placeholder="Filtrar guía..."
            placeholderTextColor="#94a3b8"
            className="flex-1 text-xs text-stone-800 dark:text-slate-100"
          />
        </View>

        <ScrollView className="max-h-52 lg:max-h-[520px]" nestedScrollEnabled>
          <View className="gap-1">
            {filtradas.map((g) => {
              const selected = g.clave === guiaActual?.clave;
              return (
                <Pressable
                  key={g.clave}
                  onPress={() => {
                    setActiva(g.clave);
                    onSelectClave?.(g.clave);
                  }}
                  className={`rounded-xl px-3 py-2.5 ${
                    selected ? 'bg-teal-700' : 'active:bg-stone-100 dark:active:bg-slate-800'
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      selected
                        ? 'text-white font-semibold'
                        : 'text-stone-700 dark:text-slate-300'
                    }`}
                  >
                    {g.titulo}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Contenido */}
      <View className="flex-1 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-sm min-h-[420px]">
        {loading ? (
          <View className="py-16 items-center justify-center">
            <ActivityIndicator size="large" color="#0d9488" />
          </View>
        ) : guiaActual ? (
          <View>
            {esSubarea && (
              <View className="mb-5 flex-row flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-700/20 dark:border-teal-500/30 bg-teal-50/80 dark:bg-teal-950/50 px-4 py-3">
                <Text className="flex-1 text-xs font-medium text-teal-900 dark:text-teal-200">
                  ¿Ya repasaste esta subárea? Ponla a prueba con reactivos reales.
                </Text>
                <Pressable
                  onPress={() => onPracticeSubarea(guiaActual.clave)}
                  className="flex-row items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 active:bg-teal-800"
                >
                  <PlayCircle size={14} color="#ffffff" />
                  <Text className="text-xs font-semibold text-white">
                    Practicar subárea {guiaActual.clave}
                  </Text>
                </Pressable>
              </View>
            )}
            <MarkdownView content={guiaActual.contenido} />
          </View>
        ) : (
          <Text className="text-sm text-stone-500 dark:text-slate-400">
            Selecciona una guía del menú lateral.
          </Text>
        )}
      </View>
    </View>
  );
}
