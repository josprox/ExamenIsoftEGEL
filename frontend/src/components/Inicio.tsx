import {
  ArrowRight,
  BookOpen,
  Clock3,
  Highlighter,
  Play,
  Sparkles,
  Target,
  Terminal,
} from 'lucide-react';
import type { Temario } from '../types/egel';

interface InicioProps {
  temario: Temario | null;
  onNavigate: (
    tab: 'inicio' | 'simulador' | 'guias' | 'biblioteca' | 'comandos' | 'progreso',
    opts?: { area?: string; subarea?: string; guiaClave?: string }
  ) => void;
}

export function Inicio({ temario, onNavigate }: InicioProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-stone-200 bg-gradient-to-br from-white via-white to-teal-50/60 p-6 sm:p-10 shadow-sm">
        <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-700/20 bg-teal-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-800">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Guía del sustentante · Julio 2026
            </div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-5xl">
              Prepárate para el{' '}
              <span className="text-teal-700">EGEL Plus ISOFT</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-stone-600 max-w-2xl">
              Simulador alineado a las 19 subáreas oficiales, método DCPDV con herramienta
              de <strong>subrayado de pistas</strong>, guías por tema y seguimiento real de tu
              avance.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigate('simulador')}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 transition cursor-pointer"
              >
                <Play className="h-4 w-4" /> Comenzar práctica
              </button>
              <button
                type="button"
                onClick={() => onNavigate('progreso')}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-800 hover:bg-stone-50 transition cursor-pointer"
              >
                <Target className="h-4 w-4 text-teal-700" /> Ver mi avance
              </button>
              <button
                type="button"
                onClick={() => onNavigate('guias', { guiaClave: 'estrategias' })}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-100 transition cursor-pointer"
              >
                <BookOpen className="h-4 w-4 text-amber-600" /> Método DCPDV
              </button>
            </div>
          </div>

          <div className="hidden lg:flex flex-col gap-3 rounded-2xl border border-teal-900/10 bg-white/95 p-3 shadow-sm">
            <img
              src="/og-cover.svg"
              alt="Portada oficial EGEL Plus ISOFT 2026"
              className="w-full rounded-xl border border-stone-200 object-cover shadow-xs"
            />
            <div className="flex flex-wrap justify-center gap-1.5 text-[11px] font-semibold pb-1">
              <span className="rounded-lg bg-teal-50 px-2.5 py-1 text-teal-800">382 reactivos</span>
              <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-800">Subrayado DCPDV</span>
              <span className="rounded-lg bg-stone-100 px-2.5 py-1 text-stone-700">19 subáreas</span>
            </div>
          </div>
        </div>
      </section>

      {/* Estructura del examen + accesos rápidos */}
      <section aria-label="Estructura del examen" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="text-3xl font-bold text-stone-900">203</div>
          <div className="mt-1 text-sm font-semibold text-stone-800">Reactivos en el examen</div>
          <p className="mt-1 text-xs text-stone-600">143 disciplinares y 60 de Lenguaje y Comunicación.</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2 text-3xl font-bold text-stone-900">
            <Clock3 className="h-6 w-6 text-teal-700" />9 h
          </div>
          <div className="mt-1 text-sm font-semibold text-stone-800">Dos sesiones</div>
          <p className="mt-1 text-xs text-stone-600">Temporizador integrado en Modo Examen Real.</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2 text-3xl font-bold text-stone-900">
            <Highlighter className="h-6 w-6 text-amber-500" />DCPDV
          </div>
          <div className="mt-1 text-sm font-semibold text-stone-800">Subrayar y marcar</div>
          <p className="mt-1 text-xs text-stone-600">Resalta pistas clave y marca reactivos para revisar.</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('comandos')}
          className="rounded-2xl border border-stone-200 bg-white p-5 text-left hover:border-teal-600 hover:bg-teal-50/30 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-3xl font-bold text-stone-900">
              <Terminal className="h-6 w-6 text-teal-700" />130
            </div>
            <ArrowRight className="h-4 w-4 text-stone-400" />
          </div>
          <div className="mt-1 text-sm font-semibold text-stone-800">Comandos rápidos</div>
          <p className="mt-1 text-xs text-stone-600">Git, SQL, MongoDB, Docker, Linux y más.</p>
        </button>
      </section>

      {/* Mapa de estudio */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Mapa de estudio</p>
            <h2 className="mt-1 text-2xl font-bold text-stone-900">Elige qué practicar</h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('guias')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-800 hover:underline cursor-pointer"
          >
            <BookOpen className="h-4 w-4" /> Abrir guías <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {temario?.secciones.map((seccion) => (
          <div key={seccion.id} className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-4">
              <h3 className="text-lg font-bold text-stone-900">{seccion.nombre}</h3>
              <span className="text-sm font-medium text-stone-500">{seccion.reactivos} reactivos</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {seccion.areas.map((area) => (
                <div key={area.id} className="rounded-xl bg-stone-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-teal-700">{area.id}</div>
                      <h4 className="mt-1 text-sm font-bold text-stone-900">{area.nombre}</h4>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-stone-500">
                      {area.reactivos}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1">
                    {area.subareas.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => onNavigate('simulador', { area: area.id, subarea: sub.id })}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-stone-700 hover:bg-white hover:text-teal-800 transition cursor-pointer"
                      >
                        <span>
                          <strong>{sub.id}</strong> · {sub.nombre}
                        </span>
                        <span className="shrink-0 font-semibold">
                          {sub.reactivos} <ArrowRight className="ml-1 inline h-3 w-3" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!temario && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No se pudo cargar el temario. Revisa que la API de Laravel esté iniciada.
          </p>
        )}
      </section>

      <p className="text-xs leading-relaxed text-stone-500">
        La guía incluye 15 % de reactivos piloto. La puntuación de esta plataforma es un resultado
        de práctica; Ceneval determina el ICNE oficial mediante su propio proceso de calificación.
      </p>
    </div>
  );
}
