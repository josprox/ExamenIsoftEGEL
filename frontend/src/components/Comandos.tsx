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
    <View className="gap-5">
      <View className="rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
        <View className="flex-row items-center gap-2.5">
          <Terminal size={22} color="#0d9488" />
          <Text className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-slate-100">
            Chuletario de Comandos Técnicos
          </Text>
        </View>
        <Text className="mt-1.5 text-sm text-stone-600 dark:text-slate-400">
          Comandos esenciales de SQL, Git, HTTP/REST, Pruebas/CI, Docker, Linux, MongoDB, Python, Java y Node para repaso rápido.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
          <View className="flex-row gap-2 pb-1">
            <Pressable
              onPress={() => setRamaActiva('todas')}
              className={`rounded-xl px-3.5 py-2 ${
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
                className={`rounded-xl px-3.5 py-2 ${
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

        <View className="mt-4 flex-row items-center rounded-xl border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-3.5 py-2 gap-2.5 max-w-md">
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

      {loading ? (
        <View className="h-44 items-center justify-center rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <ActivityIndicator size="large" color="#0d9488" />
        </View>
      ) : (
        <View className="gap-5">
          {ramasVisibles.map((r) => (
            <View
              key={r.id}
              className="rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm"
            >
              <View className="flex-row flex-wrap items-center justify-between gap-2 mb-4">
                <View className="flex-1">
                  <Text className="text-lg font-bold text-stone-900 dark:text-slate-100">
                    {r.icono} {r.nombre}
                  </Text>
                  <Text className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                    {r.descripcion}
                  </Text>
                </View>
                {r.subareas && r.subareas.length > 0 && (
                  <View className="rounded-lg bg-stone-100 dark:bg-slate-800 px-2.5 py-1">
                    <Text className="text-xs font-medium text-stone-600 dark:text-slate-300">
                      Subáreas: {r.subareas.join(', ')}
                    </Text>
                  </View>
                )}
              </View>

              <View className="divide-y divide-stone-100 dark:divide-slate-800">
                {r.comandos.map((c, idx) => (
                  <View key={idx} className="py-3 gap-2">
                    <View className="flex-row items-center justify-between gap-2">
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="flex-1 rounded-lg bg-stone-900 dark:bg-slate-950 border border-stone-800 px-3 py-2"
                      >
                        <Text selectable className="font-mono text-xs text-emerald-300">
                          {c.comando}
                        </Text>
                      </ScrollView>
                      <Pressable
                        onPress={() => copiar(c.comando)}
                        className="flex-row items-center gap-1 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-2.5 py-2 active:bg-stone-100"
                      >
                        {copiado === c.comando ? (
                          <>
                            <Check size={14} color="#059669" />
                            <Text className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                              Copiado
                            </Text>
                          </>
                        ) : (
                          <>
                            <Copy size={14} color="#64748b" />
                            <Text className="text-xs font-medium text-stone-700 dark:text-slate-200">
                              Copiar
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                    <Text className="text-xs text-stone-600 dark:text-slate-400">
                      {c.descripcion}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
