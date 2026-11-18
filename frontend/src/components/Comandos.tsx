import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Check, Copy, Search, Terminal } from 'lucide-react-native';
import { api } from '../lib/api';
import { copyText } from '../lib/clipboard';
import type { RamaComandos } from '../types/egel';

export function Comandos() {
  const [ramas, setRamas] = useState<RamaComandos[]>([]);
  const [ramaActiva, setRamaActiva] = useState<string>('todas');
  const [q, setQ] = useState('');
  const [copiado, setCopiado] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getComandos()
      .then((res) => setRamas(res.ramas))
      .finally(() => setLoading(false));
  }, []);

  const copiar = async (texto: string) => {
    try {
      await copyText(texto);
      setCopiado(texto);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      // ignore
    }
  };

  const ramasVisibles = ramas
    .filter((r) => ramaActiva === 'todas' || r.id === ramaActiva)
    .map((r) => ({
      ...r,
      comandos: r.comandos.filter((c) => {
        if (!q.trim()) return true;
        const needle = q.toLowerCase();
        return (
          c.comando.toLowerCase().includes(needle) ||
          c.descripcion.toLowerCase().includes(needle)
        );
      }),
    }))
    .filter((r) => r.comandos.length > 0);

  return (
    <View className="mx-auto w-full max-w-6xl gap-5">
      {/* Cabecera */}
      <View className="overflow-hidden rounded-3xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <View className="h-1.5 w-full bg-teal-600" />
        <View className="p-5 sm:p-6 gap-4">
          <View className="flex-row flex-wrap items-center justify-between gap-3">
            <View className="flex-1 min-w-[220px]">
              <View className="flex-row items-center gap-2.5">
                <View className="h-9 w-9 rounded-xl bg-teal-50 dark:bg-teal-950/70 items-center justify-center">
                  <Terminal size={19} color="#0d9488" />
                </View>
                <View>
                  <Text className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-slate-100">
                    Chuletario de Comandos Técnicos
                  </Text>
                  <Text className="text-xs sm:text-sm text-stone-600 dark:text-slate-400">
                    SQL, Git, HTTP/REST, Pruebas/CI, Docker, Linux, MongoDB, Python, Java y Node.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2 pb-1">
              <Pressable
                onPress={() => setRamaActiva('todas')}
                className={`rounded-full px-3.5 py-2 ${
                  ramaActiva === 'todas'
                    ? 'bg-teal-700'
                    : 'border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    ramaActiva === 'todas' ? 'text-white' : 'text-stone-700 dark:text-slate-300'
                  }`}
                >
                  Todas
                </Text>
              </Pressable>
              {ramas.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => setRamaActiva(r.id)}
                  className={`rounded-full px-3.5 py-2 ${
                    ramaActiva === r.id
                      ? 'bg-teal-700'
                      : 'border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      ramaActiva === r.id ? 'text-white' : 'text-stone-700 dark:text-slate-300'
                    }`}
                  >
                    {r.icono} {r.nombre}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <View className="flex-row items-center rounded-xl border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-3.5 py-2 gap-2.5 max-w-md">
            <Search size={16} color="#94a3b8" />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Buscar comando o descripción (ej. JOIN, rebase, compose)..."
              placeholderTextColor="#94a3b8"
              className="flex-1 text-sm text-stone-900 dark:text-slate-100"
            />
          </View>
        </View>
      </View>

      {loading ? (
        <View className="h-44 items-center justify-center rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <ActivityIndicator size="large" color="#0d9488" />
        </View>
      ) : ramasVisibles.length === 0 ? (
        <View className="rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 items-center">
          <Text className="text-sm text-stone-500 dark:text-slate-400">
            No se encontraron comandos con «{q}».
          </Text>
        </View>
      ) : (
        <View className="gap-5">
          {ramasVisibles.map((r) => (
            <View
              key={r.id}
              className="rounded-3xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm gap-4"
            >
              <View className="flex-row flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100 dark:border-slate-800">
                <View className="flex-1 min-w-[200px]">
                  <Text className="text-lg font-extrabold text-stone-900 dark:text-slate-100">
                    {r.icono} {r.nombre}
                  </Text>
                  <Text className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                    {r.descripcion}
                  </Text>
                </View>
                <View className="flex-row flex-wrap items-center gap-1.5">
                  <View className="rounded-lg bg-teal-50 dark:bg-teal-950/70 px-2.5 py-1">
                    <Text className="text-[11px] font-bold text-teal-800 dark:text-teal-300">
                      {r.comandos.length} comandos
                    </Text>
                  </View>
                  {r.subareas && r.subareas.length > 0 && (
                    <View className="rounded-lg bg-stone-100 dark:bg-slate-800 px-2.5 py-1">
                      <Text className="text-[11px] font-medium text-stone-600 dark:text-slate-300">
                        {r.subareas.join(', ')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Grid 2 columnas de tarjetas compactas */}
              <View className="flex-row flex-wrap gap-3">
                {r.comandos.map((c, idx) => {
                  const isCopied = copiado === c.comando;
                  return (
                    <View
                      key={idx}
                      className="w-full md:w-[48.5%] rounded-2xl border border-stone-200/90 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-800/40 p-3.5 justify-between gap-2.5"
                    >
                      <View className="flex-row items-start justify-between gap-2">
                        <Text className="flex-1 text-xs font-medium text-stone-700 dark:text-slate-200 leading-relaxed">
                          {c.descripcion}
                        </Text>
                        <Pressable
                          onPress={() => copiar(c.comando)}
                          className={`flex-row items-center gap-1 rounded-lg border px-2.5 py-1 shrink-0 ${
                            isCopied
                              ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60'
                              : 'border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 active:bg-stone-100'
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <Check size={12} color="#059669" />
                              <Text className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                Copiado
                              </Text>
                            </>
                          ) : (
                            <>
                              <Copy size={12} color="#64748b" />
                              <Text className="text-[11px] font-semibold text-stone-600 dark:text-slate-300">
                                Copiar
                              </Text>
                            </>
                          )}
                        </Pressable>
                      </View>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-800 px-3 py-2"
                      >
                        <Text selectable className="font-mono text-xs text-emerald-300">
                          <Text className="text-teal-400 select-none">$ </Text>
                          {c.comando}
                        </Text>
                      </ScrollView>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
