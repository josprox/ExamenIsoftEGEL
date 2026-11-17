import { useEffect, useState } from 'react';
import {
  Search,
  FileText,
  ExternalLink,
  BookOpen,
  Filter,
  FolderOpen,
  Star,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Recurso, Temario } from '../types/egel';

interface BibliotecaProps {
  temario: Temario | null;
}

export function Biblioteca({ temario }: BibliotecaProps) {
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [area, setArea] = useState('todas');
  const [tipo, setTipo] = useState('todos');
  const [soloArchivo, setSoloArchivo] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getBiblioteca({ area, tipo, q, soloArchivo })
      .then((res) => {
        if (active) setRecursos(res.recursos);
      })
      .catch(() => {
        if (active) setRecursos([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [area, tipo, q, soloArchivo]);

  const areas = temario?.secciones.flatMap((s) => s.areas) ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2.5">
              <FolderOpen className="h-6 w-6 text-teal-700" />
              Biblioteca EGEL ISOFT
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              Guías oficiales, libros recomendados, normas ISO y documentos descargables organizados por área.
            </p>
          </div>
          <span className="rounded-xl bg-stone-100 border border-stone-200 px-3.5 py-2 text-xs font-semibold text-stone-700">
            {recursos.length} recursos encontrados
          </span>
        </div>

        {/* Filtros */}
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por título, autor o tema..."
              className="w-full rounded-xl border border-stone-300 bg-stone-50 pl-10 pr-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-900 focus:border-teal-600 focus:bg-white focus:outline-none"
          >
            <option value="todas">Todas las áreas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id} · {a.nombre}
              </option>
            ))}
          </select>

          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-900 focus:border-teal-600 focus:bg-white focus:outline-none"
          >
            <option value="todos">Todos los tipos</option>
            <option value="guia">Guías</option>
            <option value="libro">Libros</option>
            <option value="norma">Normas</option>
            <option value="articulo">Artículos</option>
            <option value="banco-preguntas">Bancos de preguntas</option>
            <option value="apuntes">Apuntes</option>
            <option value="web">Sitios web</option>
            <option value="video">Videos</option>
          </select>
        </div>

        <label className="mt-3 inline-flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
          <input
            type="checkbox"
            checked={soloArchivo}
            onChange={(e) => setSoloArchivo(e.target.checked)}
            className="rounded border-stone-300 text-teal-700 focus:ring-teal-600"
          />
          <Filter className="h-3.5 w-3.5 text-teal-700" />
          Mostrar solo documentos descargables en biblioteca/
        </label>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-44 animate-pulse rounded-2xl border border-stone-200 bg-white"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recursos.map((r) => (
            <div
              key={r.id}
              className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 hover:border-teal-600/50 hover:shadow-md transition"
            >
              <div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] mb-2.5">
                  <span className="rounded-md bg-teal-50 px-2 py-0.5 font-semibold text-teal-800 uppercase">
                    {r.tipo}
                  </span>
                  {r.oficial && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
                      <Star className="h-3 w-3" /> Oficial
                    </span>
                  )}
                  {r.gratuito && (
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                      Gratis
                    </span>
                  )}
                  {r.areas.map((a) => (
                    <span key={a} className="rounded-md bg-stone-100 px-1.5 py-0.5 text-stone-600">
                      {a}
                    </span>
                  ))}
                </div>

                <h3 className="text-sm font-bold text-stone-900 leading-snug">{r.titulo}</h3>
                {(r.autores || r.anio) && (
                  <p className="mt-1 text-xs text-stone-500">
                    {r.autores}
                    {r.anio ? ` (${r.anio})` : ''}
                  </p>
                )}
                {r.nota && (
                  <p className="mt-2 text-xs text-stone-600 line-clamp-3">{r.nota}</p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-stone-100">
                {r.archivo && (
                  <a
                    href={`/biblioteca-files/${r.archivo.replace(/^biblioteca\//, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 transition"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Abrir documento
                  </a>
                )}
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 transition"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Enlace externo
                  </a>
                )}
                {!r.archivo && !r.url && (
                  <span className="inline-flex items-center gap-1 text-xs text-stone-400">
                    <BookOpen className="h-3.5 w-3.5" />
                    Referencia bibliográfica
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
