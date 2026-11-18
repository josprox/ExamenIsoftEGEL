import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  Cloud,
  Eye,
  Play,
  Target,
  Trash2,
  X,
  XCircle,
} from 'lucide-react-native';
import { api } from '../lib/api';
import type { EstadisticasUsuario, Intento, Pregunta, User } from '../types/egel';

interface ProgresoProps {
  user: User | null;
  wsConnected?: boolean;
  intentos: Intento[];
  estadisticas: EstadisticasUsuario | null;
  onOpenAuth: () => void;
  onAttemptDeleted?: () => void;
  onResumeAttempt?: (intentoId: number) => void;
}

const LETTERS = ['A', 'B', 'C', 'D'];

function formatDuracion(seg?: number): string {
  if (!seg || seg <= 0) return '—';
  const mins = Math.floor(seg / 60);
  const secs = seg % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export function Progreso({
  user,
  wsConnected = false,
  intentos,
  estadisticas,
  onOpenAuth,
  onAttemptDeleted,
  onResumeAttempt,
}: ProgresoProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<{
    intento: Intento;
    preguntas: Pregunta[];
    respuestasMap: Record<string, number>;
  } | null>(null);

  const handleDelete = async (intentoId: number) => {
    setDeletingId(intentoId);
    try {
      await api.eliminarIntento(intentoId);
      onAttemptDeleted?.();
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenDetail = async (intentoId: number) => {
    setDetailLoading(true);
    try {
      const res = await api.getIntento(intentoId);
      const map: Record<string, number> = {};
      for (const r of res.respuestas) {
        map[r.pregunta_id] = r.seleccionada;
      }
      setDetailData({
        intento: res.intento,
        preguntas: res.preguntas,
        respuestasMap: map,
      });
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  };

  const precision = estadisticas?.precision_global ?? 0;
  const nivelEstimado =
    (estadisticas?.total_respuestas ?? 0) === 0
      ? { label: 'Sin datos', bg: 'bg-stone-100', text: 'text-stone-600' }
      : precision >= 85
        ? { label: 'Sobresaliente (orientativo)', bg: 'bg-emerald-100', text: 'text-emerald-800' }
        : precision >= 65
          ? { label: 'Satisfactorio (orientativo)', bg: 'bg-teal-100', text: 'text-teal-800' }
          : { label: 'Aún No Satisfactorio (orientativo)', bg: 'bg-amber-100', text: 'text-amber-800' };

  return (
    <View className="gap-5">
      {user && wsConnected && (
        <View className="self-end flex-row items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1">
          <View className="h-2 w-2 rounded-full bg-emerald-500" />
          <Text className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
            Sincronización en vivo activa
          </Text>
        </View>
      )}
      {!user && (
        <View className="flex-row flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3.5 shadow-sm">
          <View className="flex-1 flex-row items-center gap-2.5 min-w-[220px]">
            <Cloud size={18} color="#0d9488" />
            <Text className="flex-1 text-xs text-stone-600 dark:text-slate-300 leading-relaxed">
              Tu progreso se guarda automáticamente en este dispositivo. Inicia sesión si deseas sincronizarlo en la nube.
            </Text>
          </View>
          <Pressable
            onPress={onOpenAuth}
            className="rounded-lg border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-3 py-2 active:bg-stone-100"
          >
            <Text className="text-xs font-semibold text-stone-700 dark:text-slate-200">
              Sincronizar cuenta
            </Text>
          </Pressable>
        </View>
      )}

      {/* Métricas principales */}
      <View className="flex-row flex-wrap gap-3">
        <View className="min-w-[155px] flex-1 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-stone-500 dark:text-slate-400">Intentos realizados</Text>
            <Target size={16} color="#0d9488" />
          </View>
          <Text className="mt-2 text-2xl font-bold text-stone-900 dark:text-slate-100">
            {estadisticas?.total_intentos ?? 0}
          </Text>
        </View>

        <View className="min-w-[155px] flex-1 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-stone-500 dark:text-slate-400">Reactivos contestados</Text>
            <CheckCircle2 size={16} color="#059669" />
          </View>
          <Text className="mt-2 text-2xl font-bold text-stone-900 dark:text-slate-100">
            {estadisticas?.total_respuestas ?? 0}
          </Text>
        </View>

        <View className="min-w-[155px] flex-1 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-stone-500 dark:text-slate-400">Precisión global</Text>
            <BarChart3 size={16} color="#0284c7" />
          </View>
          <Text className="mt-2 text-2xl font-bold text-stone-900 dark:text-slate-100">
            {estadisticas?.precision_global ?? 0}%
          </Text>
        </View>

        <View className="min-w-[155px] flex-1 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-stone-500 dark:text-slate-400">Aciertos acumulados</Text>
            <Target size={16} color="#d97706" />
          </View>
          <Text className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {estadisticas?.total_aciertos ?? 0}
          </Text>
        </View>

        <View className="min-w-[200px] flex-1 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-stone-500 dark:text-slate-400">Nivel estimado</Text>
            <Award size={16} color="#0d9488" />
          </View>
          <View className={`mt-2 self-start rounded-lg px-2.5 py-1 ${nivelEstimado.bg}`}>
            <Text className={`text-xs font-bold ${nivelEstimado.text}`}>
              {nivelEstimado.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Rendimiento por área */}
      {estadisticas && Object.keys(estadisticas.por_area).length > 0 && (
        <View className="rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <Text className="text-base font-bold text-stone-900 dark:text-slate-100 mb-3.5">
            Rendimiento por área
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {Object.entries(estadisticas.por_area).map(([area, data]) => {
              const barColor =
                data.porcentaje >= 75
                  ? 'bg-emerald-600'
                  : data.porcentaje >= 50
                    ? 'bg-amber-500'
                    : 'bg-rose-500';
              return (
                <View
                  key={area}
                  className="w-full sm:w-[48.5%] rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800/60 p-4"
                >
                  <View className="flex-row justify-between">
                    <Text className="text-xs font-semibold text-stone-800 dark:text-slate-200">
                      Área {area}
                    </Text>
                    <Text className="text-xs font-semibold text-stone-600 dark:text-slate-400">
                      {data.aciertos}/{data.total} ({data.porcentaje}%)
                    </Text>
                  </View>
                  <View className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-slate-700">
                    <View
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${data.porcentaje}%` }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Rendimiento por subárea */}
      {estadisticas?.por_subarea && Object.keys(estadisticas.por_subarea).length > 0 && (
        <View className="rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <Text className="text-base font-bold text-stone-900 dark:text-slate-100 mb-1">
            Rendimiento por subárea
          </Text>
          <Text className="text-xs text-stone-500 dark:text-slate-400 mb-4">
            Detecta los subtemas específicos donde conviene reforzar antes del examen.
          </Text>
          <View className="flex-row flex-wrap gap-2.5">
            {Object.entries(estadisticas.por_subarea).map(([sub, data]) => {
              const barColor =
                data.porcentaje >= 75
                  ? 'bg-emerald-600'
                  : data.porcentaje >= 50
                    ? 'bg-amber-500'
                    : 'bg-rose-500';
              const textColor =
                data.porcentaje >= 75
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : data.porcentaje >= 50
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-rose-700 dark:text-rose-400';
              return (
                <View
                  key={sub}
                  className="min-w-[145px] flex-1 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800/60 p-3"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-semibold text-stone-800 dark:text-slate-200">
                      {sub}
                    </Text>
                    <Text className={`text-xs font-bold ${textColor}`}>{data.porcentaje}%</Text>
                  </View>
                  <View className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-slate-700">
                    <View
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${data.porcentaje}%` }}
                    />
                  </View>
                  <Text className="mt-1 text-[11px] text-stone-500 dark:text-slate-400">
                    {data.aciertos}/{data.total} aciertos
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Historial de simulaciones */}
      <View className="rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <Text className="text-base font-bold text-stone-900 dark:text-slate-100 mb-4">
          Historial de simulaciones
        </Text>
        {intentos.length === 0 ? (
          <Text className="text-sm text-stone-500 dark:text-slate-400">
            Aún no tienes simulaciones registradas. ¡Empieza una en el Simulador!
          </Text>
        ) : (
          <View className="gap-2.5">
            {intentos.map((i) => (
              <View
                key={i.id}
                className="flex-row flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50/70 dark:bg-slate-800/50 p-3.5"
              >
                <View className="gap-1 flex-1 min-w-[200px]">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-xs font-bold text-stone-900 dark:text-slate-100 capitalize">
                      Modo {i.modo}
                    </Text>
                    <View className="rounded bg-stone-200/80 dark:bg-slate-700 px-2 py-0.5">
                      <Text className="text-[11px] font-medium text-stone-700 dark:text-slate-300">
                        {i.area_filtro || 'Todas'}
                      </Text>
                    </View>
                    {i.completado ? (
                      <View className="rounded-full bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5">
                        <Text className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Completado
                        </Text>
                      </View>
                    ) : (
                      <View className="rounded-full bg-amber-100 dark:bg-amber-950/70 px-2 py-0.5">
                        <Text className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                          Pendiente
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="flex-row flex-wrap items-center gap-3">
                    <Text className="text-xs text-stone-500 dark:text-slate-400">
                      {new Date(i.created_at).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    <View className="flex-row items-center gap-1">
                      <Clock size={12} color="#94a3b8" />
                      <Text className="text-xs text-stone-500 dark:text-slate-400">
                        {formatDuracion(i.duracion_segundos)}
                      </Text>
                    </View>
                    <Text className="text-xs font-bold text-stone-800 dark:text-slate-200">
                      {i.aciertos}/{i.total_preguntas} ({i.porcentaje}%)
                    </Text>
                  </View>
                </View>

                {user && (
                  <View className="flex-row items-center gap-1.5">
                    {!i.completado && i.pregunta_ids && i.pregunta_ids.length > 0 && onResumeAttempt && (
                      <Pressable
                        onPress={() => onResumeAttempt(i.id)}
                        className="flex-row items-center gap-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1.5 active:bg-teal-100"
                      >
                        <Play size={13} color="#0d9488" />
                        <Text className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                          Reanudar
                        </Text>
                      </Pressable>
                    )}
                    {i.completado && (
                      <Pressable
                        onPress={() => handleOpenDetail(i.id)}
                        disabled={detailLoading}
                        className="flex-row items-center gap-1 rounded-lg bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 px-2.5 py-1.5 active:bg-stone-100"
                      >
                        {detailLoading ? (
                          <ActivityIndicator size="small" color="#94a3b8" />
                        ) : (
                          <Eye size={13} color="#94a3b8" />
                        )}
                        <Text className="text-xs font-semibold text-stone-700 dark:text-slate-200">
                          Ver
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => handleDelete(i.id)}
                      disabled={deletingId === i.id}
                      className="flex-row items-center gap-1 rounded-lg bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 px-2.5 py-1.5 active:bg-rose-50"
                    >
                      <Trash2 size={13} color="#e11d48" />
                      <Text className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                        Eliminar
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Modal de revisión */}
      <Modal
        visible={Boolean(detailData)}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailData(null)}
      >
        <View className="flex-1 items-center justify-center bg-stone-950/60 p-4">
          <Pressable onPress={() => setDetailData(null)} className="absolute inset-0" />
          {detailData && (
            <View className="max-h-[85%] w-full max-w-3xl rounded-3xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
              <View className="flex-row items-center justify-between border-b border-stone-200 dark:border-slate-800 px-5 py-4">
                <View className="flex-1 pr-3">
                  <Text className="text-base font-bold text-stone-900 dark:text-slate-100">
                    Revisión de intento · {detailData.intento.aciertos}/
                    {detailData.intento.total_preguntas} ({detailData.intento.porcentaje}%)
                  </Text>
                  <Text className="text-xs text-stone-500 dark:text-slate-400 capitalize">
                    Modo {detailData.intento.modo} · Duración{' '}
                    {formatDuracion(detailData.intento.duracion_segundos)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setDetailData(null)}
                  className="rounded-lg p-1.5 active:bg-stone-100 dark:active:bg-slate-800"
                >
                  <X size={20} color="#94a3b8" />
                </Pressable>
              </View>

              <ScrollView className="p-5">
                <View className="gap-3.5 pb-4">
                  {detailData.preguntas.length === 0 ? (
                    <Text className="text-sm text-stone-500 dark:text-slate-400">
                      Este intento no cuenta con preguntas registradas para revisar.
                    </Text>
                  ) : (
                    detailData.preguntas.map((p, idx) => {
                      const sel = detailData.respuestasMap[p.id];
                      const ok = sel !== undefined && sel === p.correcta;
                      return (
                        <View
                          key={p.id}
                          className={`rounded-2xl border p-4 ${
                            ok
                              ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/25'
                              : 'border-rose-200 dark:border-rose-800/60 bg-rose-50/40 dark:bg-rose-950/25'
                          }`}
                        >
                          <View className="flex-row items-center justify-between mb-1.5">
                            <Text className="text-xs font-semibold text-stone-600 dark:text-slate-400">
                              #{idx + 1} · {p.id} (Subárea {p.subarea})
                            </Text>
                            {ok ? (
                              <View className="flex-row items-center gap-1">
                                <CheckCircle2 size={14} color="#059669" />
                                <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                  Correcta
                                </Text>
                              </View>
                            ) : (
                              <View className="flex-row items-center gap-1">
                                <XCircle size={14} color="#e11d48" />
                                <Text className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                                  {sel === undefined ? 'Sin responder' : 'Incorrecta'}
                                </Text>
                              </View>
                            )}
                          </View>

                          <Text className="text-sm font-semibold text-stone-900 dark:text-slate-100">
                            {p.pregunta}
                          </Text>

                          <View className="mt-2 gap-1.5">
                            {p.correcta !== undefined && (
                              <Text className="text-xs text-emerald-800 dark:text-emerald-300">
                                <Text className="font-bold">
                                  Correcta ({LETTERS[p.correcta]}):{' '}
                                </Text>
                                {p.opciones[p.correcta]?.texto}
                              </Text>
                            )}
                            {!ok && sel !== undefined && (
                              <Text className="text-xs text-rose-700 dark:text-rose-300">
                                <Text className="font-bold">Tu respuesta ({LETTERS[sel]}): </Text>
                                {p.opciones[sel]?.texto}
                              </Text>
                            )}
                            {p.correcta !== undefined &&
                              p.opciones[p.correcta]?.explicacion && (
                                <View className="mt-1 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 p-2.5">
                                  <Text className="text-xs text-stone-700 dark:text-slate-300 leading-relaxed">
                                    {p.opciones[p.correcta]?.explicacion}
                                  </Text>
                                </View>
                              )}
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
