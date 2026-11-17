import { ArrowRight, BookOpen, Clock3, Play, Target } from 'lucide-react';
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
      <section className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-10 shadow-sm">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Guía del sustentante · Julio 2026</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-stone-900 sm:text-5xl">Prepárate para el EGEL Plus ISOFT</h1>
          <p className="mt-4 text-base leading-relaxed text-stone-600">Practica con la distribución de la guía, revisa tus errores y vuelve al tema que necesitas reforzar.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button type="button" onClick={() => onNavigate('simulador')}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800">
              <Play className="h-4 w-4" /> Comenzar práctica
            </button>
            <button type="button" onClick={() => onNavigate('progreso')}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-800 hover:bg-stone-50">
              <Target className="h-4 w-4" /> Ver mi avance
            </button>
          </div>
        </div>
      </section>

      <section aria-label="Estructura del examen" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-5"><div className="text-3xl font-bold text-stone-900">203</div><div className="mt-1 text-sm font-semibold text-stone-800">Reactivos en el examen</div><p className="mt-1 text-xs text-stone-600">143 disciplinares y 60 de Lenguaje y Comunicación.</p></div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5"><div className="flex items-center gap-2 text-3xl font-bold text-stone-900"><Clock3 className="h-6 w-6 text-teal-700" />9 h</div><div className="mt-1 text-sm font-semibold text-stone-800">Dos sesiones</div><p className="mt-1 text-xs text-stone-600">4 h 30 min por sesión, según la guía.</p></div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5"><div className="text-3xl font-bold text-stone-900">3</div><div className="mt-1 text-sm font-semibold text-stone-800">Opciones por reactivo</div><p className="mt-1 text-xs text-stone-600">El simulador usa preguntas originales de práctica.</p></div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Mapa de estudio</p><h2 className="mt-1 text-2xl font-bold text-stone-900">Elige qué practicar</h2></div>
          <button type="button" onClick={() => onNavigate('guias')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-800 hover:underline"><BookOpen className="h-4 w-4" /> Abrir guías <ArrowRight className="h-4 w-4" /></button>
        </div>
        {temario?.secciones.map((seccion) => (
          <div key={seccion.id} className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-4"><h3 className="text-lg font-bold text-stone-900">{seccion.nombre}</h3><span className="text-sm font-medium text-stone-500">{seccion.reactivos} reactivos</span></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {seccion.areas.map((area) => (
                <div key={area.id} className="rounded-xl bg-stone-50 p-4">
                  <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold text-teal-700">{area.id}</div><h4 className="mt-1 text-sm font-bold text-stone-900">{area.nombre}</h4></div><span className="shrink-0 text-xs font-semibold text-stone-500">{area.reactivos}</span></div>
                  <div className="mt-3 space-y-1">
                    {area.subareas.map((sub) => (
                      <button key={sub.id} type="button" onClick={() => onNavigate('simulador', { area: area.id, subarea: sub.id })}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-stone-700 hover:bg-white hover:text-teal-800">
                        <span><strong>{sub.id}</strong> · {sub.nombre}</span><span className="shrink-0 font-semibold">{sub.reactivos} <ArrowRight className="ml-1 inline h-3 w-3" /></span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!temario && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No se pudo cargar el temario. Revisa que la API de Laravel esté iniciada.</p>}
      </section>
      <p className="text-xs leading-relaxed text-stone-500">La guía incluye 15 % de reactivos piloto. La puntuación de esta plataforma es un resultado de práctica; Ceneval determina el ICNE oficial mediante su propio proceso de calificación.</p>
    </div>
  );
}
