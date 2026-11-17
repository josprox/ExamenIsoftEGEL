import { useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Target,
  Cloud,
  Trash2,
  Play,
  Eye,
  X,
  XCircle,
  Clock,
  Award,
} from 'lucide-react';
import { api } from '../lib/api';
import type { EstadisticasUsuario, Intento, Pregunta, User } from '../types/egel';

interface ProgresoProps {
  user: User | null;
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
      // Ignorar error si ya fue eliminado
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
      // Ignorar si falló
    } finally {
      setDetailLoading(false);
    }
  };

  const precision = estadisticas?.precision_global ?? 0;
  const nivelEstimado =
    (estadisticas?.total_respuestas ?? 0) === 0
      ? { label: 'Sin datos', cls: 'text-stone-500 bg-stone-100' }
      : precision >= 85
        ? { label: 'Sobresaliente (orientativo)', cls: 'text-emerald-800 bg-emerald-100' }
        : precision >= 65
          ? { label: 'Satisfactorio (orientativo)', cls: 'text-teal-800 bg-teal-100' }
          : { label: 'Aún No Satisfactorio (orientativo)', cls: 'text-amber-800 bg-amber-100' };
  return (
    <div className="space-y-6">
      {!user && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-3.5 shadow-sm">
          <div className="flex items-center gap-2.5 text-xs text-stone-600">
            <Cloud className="h-4 w-4 text-teal-700 shrink-0" />
            <span>
              Tu progreso se guarda automáticamente en este navegador. Si quieres sincronizarlo entre dispositivos, puedes iniciar sesión (opcional).
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenAuth}
            className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition cursor-pointer"
          >
            Sincronizar cuenta
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>Intentos realizados</span>
            <Target className="h-4 w-4 text-teal-700" />
          </div>
          <div className="mt-2 text-2xl font-bold text-stone-900">
            {estadisticas?.total_intentos ?? 0}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>Reactivos contestados</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-stone-900">
            {estadisticas?.total_respuestas ?? 0}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>Precisión global</span>
            <BarChart3 className="h-4 w-4 text-sky-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-stone-900">
            {estadisticas?.precision_global ?? 0}%
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>Aciertos acumulados</span>
            <Target className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">
            {estadisticas?.total_aciertos ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>Nivel estimado</span>
            <Award className="h-4 w-4 text-teal-600" />
          </div>
          <div className="mt-2">
            <span
              className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold ${nivelEstimado.cls}`}
            >
              {nivelEstimado.label}
            </span>
          </div>
        </div>
      </div>

      {estadisticas && Object.keys(estadisticas.por_area).length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-stone-900 mb-4">Rendimiento por área</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(estadisticas.por_area).map(([area, data]) => (
              <div key={area} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-stone-800">Área {area}</span>
                  <span className="text-stone-600">
                    {data.aciertos}/{data.total} ({data.porcentaje}%)
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
                  <div
                    className={`h-full rounded-full ${
                      data.porcentaje >= 75
                        ? 'bg-emerald-600'
                        : data.porcentaje >= 50
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                    }`}
                    style={{ width: `${data.porcentaje}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {estadisticas?.por_subarea && Object.keys(estadisticas.por_subarea).length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-stone-900 mb-1">Rendimiento por subárea</h3>
          <p className="text-xs text-stone-500 mb-4">
            Detecta los subtemas específicos donde conviene reforzar antes del examen.
          </p>
          <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {Object.entries(estadisticas.por_subarea).map(([sub, data]) => (
              <div key={sub} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-stone-800">{sub}</span>
                  <span
                    className={
                      data.porcentaje >= 75
                        ? 'text-emerald-700'
                        : data.porcentaje >= 50
                          ? 'text-amber-700'
                          : 'text-rose-700'
                    }
                  >
                    {data.porcentaje}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                  <div
                    className={`h-full rounded-full ${
                      data.porcentaje >= 75
                        ? 'bg-emerald-600'
                        : data.porcentaje >= 50
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                    }`}
                    style={{ width: `${data.porcentaje}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-stone-500">
                  {data.aciertos}/{data.total} aciertos
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-stone-900 mb-4">Historial de simulaciones</h3>
        {intentos.length === 0 ? (
          <p className="text-sm text-stone-500">
            Aún no tienes simulaciones registradas. ¡Empieza una en el Simulador!
          </p>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500">
                  <th className="py-2.5 pr-4">Fecha</th>
                  <th className="py-2.5 pr-4">Modo</th>
                  <th className="py-2.5 pr-4">Filtro</th>
                  <th className="py-2.5 pr-4">Estado</th>
                  <th className="py-2.5 pr-4">Duración</th>
                  <th className="py-2.5 pr-4">Aciertos</th>
                  {user && <th className="py-2.5 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {intentos.map((i) => (
                  <tr key={i.id} className="text-stone-800">
                    <td className="py-3 pr-4">
                      {new Date(i.created_at).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 pr-4 capitalize">{i.modo}</td>
                    <td className="py-3 pr-4">{i.area_filtro || 'Todas'}</td>
                    <td className="py-3 pr-4">
                      {i.completado ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                          Completado
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-stone-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuracion(i.duracion_segundos)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-semibold">
                      {i.aciertos}/{i.total_preguntas} ({i.porcentaje}%)
                    </td>
                    {user && (
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {!i.completado && i.pregunta_ids && i.pregunta_ids.length > 0 && onResumeAttempt && (
                            <button
                              type="button"
                              onClick={() => onResumeAttempt(i.id)}
                              title="Reanudar simulación"
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-teal-700 transition-colors hover:bg-teal-50 cursor-pointer"
                            >
                              <Play className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Reanudar</span>
                            </button>
                          )}
                          {i.completado && (
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(i.id)}
                              disabled={detailLoading}
                              title="Ver revisión del intento"
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-stone-600 transition-colors hover:bg-stone-100 cursor-pointer disabled:opacity-50"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Ver</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(i.id)}
                            disabled={deletingId === i.id}
                            title="Eliminar simulación"
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Eliminar</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de revisión de intento */}
      {detailData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 backdrop-blur-sm p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
              <div>
                <h4 className="text-base font-bold text-stone-900">
                  Revisión de intento · {detailData.intento.aciertos}/{detailData.intento.total_preguntas} ({detailData.intento.porcentaje}%)
                </h4>
                <p className="text-xs text-stone-500 capitalize">
                  Modo {detailData.intento.modo} · Duración {formatDuracion(detailData.intento.duracion_segundos)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailData(null)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4">
              {detailData.preguntas.length === 0 ? (
                <p className="text-sm text-stone-500">
                  Este intento no cuenta con preguntas registradas para revisar.
                </p>
              ) : (
                detailData.preguntas.map((p, idx) => {
                  const sel = detailData.respuestasMap[p.id];
                  const ok = sel !== undefined && sel === p.correcta;
                  return (
                    <div
                      key={p.id}
                      className={`rounded-2xl border p-4 ${
                        ok ? 'border-emerald-200 bg-emerald-50/30' : 'border-rose-200 bg-rose-50/30'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-stone-600">
                          #{idx + 1} · {p.id} (Subárea {p.subarea})
                        </span>
                        {ok ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Correcta
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                            <XCircle className="h-3.5 w-3.5" />{' '}
                            {sel === undefined ? 'Sin responder' : 'Incorrecta'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-stone-900">{p.pregunta}</p>
                      <div className="mt-2 space-y-1 text-xs">
                        {p.correcta !== undefined && (
                          <div className="text-emerald-800">
                            <strong>Correcta ({LETTERS[p.correcta]}):</strong>{' '}
                            {p.opciones[p.correcta]?.texto}
                          </div>
                        )}
                        {!ok && sel !== undefined && (
                          <div className="text-rose-700">
                            <strong>Tu respuesta ({LETTERS[sel]}):</strong> {p.opciones[sel]?.texto}
                          </div>
                        )}
                        {p.correcta !== undefined && p.opciones[p.correcta]?.explicacion && (
                          <p className="mt-1.5 rounded-xl bg-white border border-stone-200 p-2.5 text-stone-700">
                            {p.opciones[p.correcta]?.explicacion}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
