import { useState } from 'react';
import { BarChart3, CheckCircle2, Target, Cloud, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import type { EstadisticasUsuario, Intento, User } from '../types/egel';

interface ProgresoProps {
  user: User | null;
  intentos: Intento[];
  estadisticas: EstadisticasUsuario | null;
  onOpenAuth: () => void;
  onAttemptDeleted?: () => void;
}

export function Progreso({ user, intentos, estadisticas, onOpenAuth, onAttemptDeleted }: ProgresoProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-stone-900 mb-4">Historial de simulaciones</h3>
        {intentos.length === 0 ? (
          <p className="text-sm text-stone-500">
            Aún no tienes simulaciones registradas. ¡Empieza una en el Simulador!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500">
                  <th className="py-2.5 pr-4">Fecha</th>
                  <th className="py-2.5 pr-4">Modo</th>
                  <th className="py-2.5 pr-4">Filtro</th>
                  <th className="py-2.5 pr-4">Estado</th>
                  <th className="py-2.5 pr-4">Aciertos</th>
                  {user && <th className="py-2.5 text-right">Acción</th>}
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
                    <td className="py-3 pr-4 font-semibold">
                      {i.aciertos}/{i.total_preguntas} ({i.porcentaje}%)
                    </td>
                    {user && (
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(i.id)}
                          disabled={deletingId === i.id}
                          title="Eliminar simulación"
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Eliminar</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
