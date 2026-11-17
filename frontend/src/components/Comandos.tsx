import { useEffect, useState } from 'react';
import { Terminal, Search, Copy, Check } from 'lucide-react';
import { api } from '../lib/api';
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

  const copiar = (texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(texto);
    setTimeout(() => setCopiado(null), 1500);
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
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2.5">
              <Terminal className="h-6 w-6 text-teal-700" />
              Chuletario de Comandos Técnicos
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              Comandos esenciales de SQL, Git, HTTP/REST, Pruebas/CI, Docker, Linux, MongoDB, Python, Java y Node para repaso rápido.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRamaActiva('todas')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              ramaActiva === 'todas'
                ? 'bg-teal-700 text-white'
                : 'border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
            }`}
          >
            Todas
          </button>
          {ramas.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRamaActiva(r.id)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                ramaActiva === r.id
                  ? 'bg-teal-700 text-white'
                  : 'border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
              }`}
            >
              {r.icono} {r.nombre}
            </button>
          ))}
        </div>

        <div className="relative mt-4 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar comando o descripción (ej. JOIN, rebase, compose)..."
            className="w-full rounded-xl border border-stone-300 bg-stone-50 pl-10 pr-4 py-2 text-sm text-stone-900 focus:border-teal-600 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl border border-stone-200 bg-white" />
      ) : (
        <div className="space-y-6">
          {ramasVisibles.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-stone-900">
                    {r.icono} {r.nombre}
                  </h2>
                  <p className="text-xs text-stone-500">{r.descripcion}</p>
                </div>
                {r.subareas && r.subareas.length > 0 && (
                  <span className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                    Subáreas: {r.subareas.join(', ')}
                  </span>
                )}
              </div>

              <div className="divide-y divide-stone-100">
                {r.comandos.map((c, idx) => (
                  <div
                    key={idx}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-1 min-w-0">
                      <code className="block overflow-x-auto rounded-lg bg-stone-900 px-3 py-1.5 font-mono text-xs text-emerald-300">
                        {c.comando}
                      </code>
                      <p className="text-xs text-stone-600">{c.descripcion}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copiar(c.comando)}
                      className="inline-flex items-center gap-1 self-start sm:self-center shrink-0 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                    >
                      {copiado === c.comando ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copiar
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
