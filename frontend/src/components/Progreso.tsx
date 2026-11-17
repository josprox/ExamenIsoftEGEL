import { BarChart3, CheckCircle2, Target, Cloud } from 'lucide-react';
import type { EstadisticasUsuario, Intento, User } from '../types/egel';

interface ProgresoProps {
  user: User | null;
  intentos: Intento[];
  estadisticas: EstadisticasUsuario | null;
  onOpenAuth: () => void;
}

export function Progreso({ user, intentos, estadisticas, onOpenAuth }: ProgresoProps) {
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
                  <th className="py-2.5 pr-4">Aciertos</th>
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
                    <td className="py-3 pr-4 font-semibold">
                      {i.aciertos}/{i.total_preguntas} ({i.porcentaje}%)
                    </td>
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
