import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Lightbulb,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Play,
  Trophy,
  AlertCircle,
  Clock,
  Zap,
  PauseCircle,
  Trash2,
  LogIn,
  Lock,
  Highlighter,
  Eraser,
  Flag,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Pregunta, Temario, User } from '../types/egel';
import {
  HighlightableText,
  type HighlightColor,
  type HighlightRange,
} from './HighlightableText';

interface SimulatorProps {
  temario: Temario | null;
  user: User | null;
  erroresRecientes?: string[];
  initialArea?: string;
  initialSubarea?: string;
  resumeIntentoId?: number | null;
  onResumeHandled?: () => void;
  onOpenGuia?: (clave: string) => void;
  onOpenAuth: () => void;
  onAttemptFinished: () => void;
}

type Phase = 'config' | 'running' | 'summary';
type Modo = 'inmediato' | 'examen';
type TipoSimulacion = 'rapida' | 'por_modulo' | 'egel_completo';

const LETTERS = ['A', 'B', 'C', 'D'];
const ACTIVE_SESSION_KEY = 'egel_active_session_v1';

function formatSeconds(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

interface SavedSession {
  modo: Modo;
  area: string;
  subarea: string;
  banco: string;
  preguntas: Pregunta[];
  indice: number;
  respuestas: Record<string, number>;
  intentoId: number | null;
  elapsedSeconds?: number;
  subrayados?: Record<string, Record<string, HighlightRange[]>>;
  marcadas?: Record<string, boolean>;
  paused?: boolean;
}

function readSavedSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSession;
    if (!parsed?.preguntas?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSavedSession(session: SavedSession | null): void {
  try {
    if (!session) {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    } else {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    }
  } catch {
    // ignore storage quota errors
  }
}

export function Simulator({
  temario,
  user,
  erroresRecientes = [],
  initialArea = 'todas',
  initialSubarea = 'todas',
  resumeIntentoId = null,
  onResumeHandled,
  onOpenGuia,
  onOpenAuth,
  onAttemptFinished,
}: SimulatorProps) {
  const initialSaved = useMemo(() => readSavedSession(), []);

  const [phase, setPhase] = useState<Phase>(() =>
    initialSaved && !initialSaved.paused ? 'running' : 'config'
  );
  const [modo, setModo] = useState<Modo>(() => initialSaved?.modo ?? 'inmediato');
  const [tipoSim, setTipoSim] = useState<TipoSimulacion>(() =>
    initialArea !== 'todas' || initialSubarea !== 'todas' ? 'por_modulo' : 'rapida'
  );
  const [area, setArea] = useState<string>(initialArea);
  const [subarea, setSubarea] = useState<string>(initialSubarea);
  const [banco, setBanco] = useState<string>('todos');
  const [cantidad, setCantidad] = useState<number>(20);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [preguntas, setPreguntas] = useState<Pregunta[]>(() => initialSaved?.preguntas ?? []);
  const [indice, setIndice] = useState<number>(() => initialSaved?.indice ?? 0);
  const [respuestas, setRespuestas] = useState<Record<string, number>>(
    () => initialSaved?.respuestas ?? {}
  );
  const [intentoId, setIntentoId] = useState<number | null>(
    () => initialSaved?.intentoId ?? null
  );
  const [mostrarTodasExplicaciones, setMostrarTodasExplicaciones] = useState(false);
  const [hasPausedSession, setHasPausedSession] = useState<boolean>(
    () => Boolean(initialSaved?.paused && initialSaved.preguntas.length > 0)
  );
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(
    () => initialSaved?.elapsedSeconds ?? 0
  );
  const [subrayarActivo, setSubrayarActivo] = useState(false);
  const [colorSubrayado, setColorSubrayado] = useState<HighlightColor>('amber');
  const [subrayados, setSubrayados] = useState<Record<string, Record<string, HighlightRange[]>>>(
    () => initialSaved?.subrayados ?? {}
  );
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>(
    () => initialSaved?.marcadas ?? {}
  );

  // Si el usuario navegó desde Inicio/Guías con un filtro específico, lo aplicamos
  useEffect(() => {
    if (initialArea !== 'todas' || initialSubarea !== 'todas') {
      setTipoSim('por_modulo');
      setArea(initialArea);
      setSubarea(initialSubarea);
    }
  }, [initialArea, initialSubarea]);

  // Reanudar un intento pendiente desde Progreso (BD)
  useEffect(() => {
    if (!resumeIntentoId || !user) return;
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    api
      .getIntento(resumeIntentoId)
      .then((res) => {
        if (cancelled) return;
        if (!res.preguntas.length) {
          setErrorMsg('Este intento no tiene preguntas registradas para reanudar.');
          return;
        }
        const respMap: Record<string, number> = {};
        for (const r of res.respuestas) {
          respMap[r.pregunta_id] = r.seleccionada;
        }
        const firstUnanswered = res.preguntas.findIndex((p) => respMap[p.id] === undefined);
        setModo(res.intento.modo);
        setPreguntas(res.preguntas);
        setRespuestas(respMap);
        setIntentoId(res.intento.id);
        setIndice(firstUnanswered >= 0 ? firstUnanswered : 0);
        setElapsedSeconds(res.intento.duracion_segundos ?? 0);
        setSubrayados({});
        setMarcadas({});
        setHasPausedSession(false);
        setPhase('running');
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'No se pudo reanudar el intento.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          onResumeHandled?.();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resumeIntentoId, user, onResumeHandled]);

  // Cronómetro en vivo durante la simulación
  useEffect(() => {
    if (phase !== 'running') return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  // Guardar sesión activa automáticamente mientras está en curso
  useEffect(() => {
    if (phase === 'running' && preguntas.length > 0) {
      writeSavedSession({
        modo,
        area,
        subarea,
        banco,
        preguntas,
        indice,
        respuestas,
        intentoId,
        elapsedSeconds,
        subrayados,
        marcadas,
        paused: false,
      });
      setHasPausedSession(false);
    }
  }, [
    phase,
    modo,
    area,
    subarea,
    banco,
    preguntas,
    indice,
    respuestas,
    intentoId,
    elapsedSeconds,
    subrayados,
    marcadas,
  ]);

  const areasDisponibles = useMemo(() => {
    if (!temario) return [];
    return temario.secciones.flatMap((s) => s.areas);
  }, [temario]);

  const subareasDisponibles = useMemo(() => {
    if (area === 'todas') {
      return areasDisponibles.flatMap((a) => a.subareas);
    }
    return areasDisponibles.find((a) => a.id === area)?.subareas ?? [];
  }, [areasDisponibles, area]);

  const subareaNombres = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of areasDisponibles) {
      for (const s of a.subareas) {
        map[s.id] = s.nombre;
      }
    }
    return map;
  }, [areasDisponibles]);

  const areaNombres = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of areasDisponibles) {
      map[a.id] = a.nombre;
    }
    return map;
  }, [areasDisponibles]);

  const iniciarSimulacion = async (soloErrores = false) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const reqParams =
        soloErrores && erroresRecientes.length > 0
          ? { ids: erroresRecientes, orden: 'modular' as const }
          : tipoSim === 'egel_completo'
            ? { preset: 'egel_completo' as const }
            : tipoSim === 'rapida'
              ? { preset: 'practica_rapida' as const }
              : {
                  area: subarea !== 'todas' ? 'todas' : area,
                  subarea,
                  banco,
                  limit: cantidad > 0 ? cantidad : undefined,
                  orden: 'modular' as const,
                };

      const res = await api.getPreguntas({
        ...reqParams,
        ocultarRespuestas: modo === 'examen',
      });

      if (!res.preguntas.length) {
        setErrorMsg('No se encontraron preguntas con esos filtros.');
        return;
      }

      let nuevoIntentoId: number | null = null;
      if (user) {
        const intentoRes = await api.crearIntento({
          modo,
          area_filtro: soloErrores ? 'errores' : subarea !== 'todas' ? subarea : area,
          banco_filtro: banco,
          total_preguntas: res.preguntas.length,
          pregunta_ids: res.preguntas.map((p) => p.id),
        });
        nuevoIntentoId = intentoRes.intento.id;
      }

      setPreguntas(res.preguntas);
      setIntentoId(nuevoIntentoId);
      setRespuestas({});
      setIndice(0);
      setElapsedSeconds(0);
      setSubrayados({});
      setMarcadas({});
      setMostrarTodasExplicaciones(false);
      setHasPausedSession(false);
      setPhase('running');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudieron cargar las preguntas.'
      );
    } finally {
      setLoading(false);
    }
  };

  const pausarYSalirAlMenu = () => {
    if (preguntas.length > 0) {
      writeSavedSession({
        modo,
        area,
        subarea,
        banco,
        preguntas,
        indice,
        respuestas,
        intentoId,
        elapsedSeconds,
        subrayados,
        marcadas,
        paused: true,
      });
      setHasPausedSession(true);
    }
    setPhase('config');
  };

  const reanudarSimulacion = () => {
    const saved = readSavedSession();
    if (!saved) return;
    setModo(saved.modo);
    setPreguntas(saved.preguntas);
    setIndice(saved.indice);
    setRespuestas(saved.respuestas);
    setIntentoId(saved.intentoId);
    setElapsedSeconds(saved.elapsedSeconds ?? 0);
    setSubrayados(saved.subrayados ?? {});
    setMarcadas(saved.marcadas ?? {});
    setHasPausedSession(false);
    setPhase('running');
  };

  const descartarSimulacion = async () => {
    const idToDelete = intentoId ?? readSavedSession()?.intentoId ?? null;
    writeSavedSession(null);
    setHasPausedSession(false);
    setIntentoId(null);
    setPreguntas([]);
    setRespuestas({});
    setIndice(0);
    setElapsedSeconds(0);
    setSubrayados({});
    setMarcadas({});

    if (user && idToDelete) {
      try {
        await api.eliminarIntento(idToDelete);
      } catch {
        // Ignorar errores de red al descartar
      }
      onAttemptFinished();
    }
  };

  const preguntaActual = preguntas[indice];

  const stats = useMemo(() => {
    let aciertos = 0;
    let errores = 0;
    let racha = 0;
    for (const p of preguntas) {
      const sel = respuestas[p.id];
      if (sel === undefined) continue;
      if (sel === p.correcta) {
        aciertos++;
        racha++;
      } else {
        errores++;
        racha = 0;
      }
    }
    const contestadas = aciertos + errores;
    const porcentaje = contestadas > 0 ? Math.round((aciertos / contestadas) * 100) : 0;
    return { aciertos, errores, racha, contestadas, porcentaje };
  }, [preguntas, respuestas]);

  const seleccionarOpcion = useCallback(
    async (opcionIdx: number) => {
      if (!preguntaActual) return;
      if (modo === 'inmediato' && respuestas[preguntaActual.id] !== undefined) {
        return;
      }

      setRespuestas((prev) => ({ ...prev, [preguntaActual.id]: opcionIdx }));
      setMostrarTodasExplicaciones(false);

      if (user && intentoId) {
        try {
          await api.guardarRespuesta(intentoId, {
            pregunta_id: preguntaActual.id,
            seleccionada: opcionIdx,
          });
        } catch {
          // Silencioso
        }
      }
    },
    [preguntaActual, modo, respuestas, user, intentoId]
  );

  const finalizar = useCallback(async () => {
    writeSavedSession(null);
    setHasPausedSession(false);
    if (user && intentoId) {
      try {
        const res = await api.finalizarIntento(intentoId, elapsedSeconds);
        if (res.preguntas && res.preguntas.length > 0) {
          setPreguntas(res.preguntas);
        }
      } catch {
        // ignore
      }
    }
    onAttemptFinished();
    setPhase('summary');
  }, [user, intentoId, elapsedSeconds, onAttemptFinished]);

  // Atajos de teclado amigables mientras estás respondiendo
  useEffect(() => {
    if (phase !== 'running' || !preguntaActual) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === '1' || key === 'a') {
        if (preguntaActual.opciones[0]) seleccionarOpcion(0);
      } else if (key === '2' || key === 'b') {
        if (preguntaActual.opciones[1]) seleccionarOpcion(1);
      } else if (key === '3' || key === 'c') {
        if (preguntaActual.opciones[2]) seleccionarOpcion(2);
      } else if (e.key === 'ArrowRight' || (e.key === 'Enter' && respuestas[preguntaActual.id] !== undefined)) {
        if (indice < preguntas.length - 1) {
          setIndice((i) => i + 1);
          setMostrarTodasExplicaciones(false);
        }
      } else if (e.key === 'ArrowLeft') {
        if (indice > 0) {
          setIndice((i) => i - 1);
          setMostrarTodasExplicaciones(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, preguntaActual, indice, preguntas.length, respuestas, seleccionarOpcion]);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-stone-200 bg-white p-8 sm:p-10 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 border border-teal-700/20">
          <Lock className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-2xl font-bold text-stone-900">
          Inicia sesión para usar el simulador
        </h2>
        <p className="mt-2.5 text-sm text-stone-600 max-w-md mx-auto leading-relaxed">
          Para realizar simulaciones del EGEL Plus ISOFT, guardar tus intentos y repasar tus errores necesitas entrar con tu cuenta (es gratis y toma un minuto).
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-teal-700/20 hover:bg-teal-800 transition cursor-pointer"
        >
          <LogIn className="h-4 w-4" />
          Iniciar sesión o crear cuenta
        </button>
      </div>
    );
  }

  if (phase === 'config') {
    const saved = hasPausedSession ? readSavedSession() : null;

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Tarjeta para reanudar simulación pausada */}
        {saved && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-600/30 bg-teal-50 p-5 shadow-sm">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-teal-800">
                Tienes una simulación en curso
              </div>
              <p className="mt-1 text-sm text-stone-800">
                Te quedaste en la pregunta <strong>{saved.indice + 1}</strong> de{' '}
                <strong>{saved.preguntas.length}</strong> ({Object.keys(saved.respuestas).length} respondidas).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={descartarSimulacion}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 transition cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Descartar
              </button>
              <button
                type="button"
                onClick={reanudarSimulacion}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 transition cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                Continuar simulación
              </button>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 shadow-sm">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700">Práctica EGEL · Guía julio 2026</span>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-stone-900">
              Configura tu práctica
            </h1>
            <p className="mt-1.5 text-sm text-stone-600 max-w-2xl">
              Practica con retroalimentación inmediata desde la primera pregunta: descubre al instante si acertaste o te equivocaste, por qué, y qué estrategia usar en el examen real.
            </p>
          </div>

          <div className="mt-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
              1. Elige el modo del simulador
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setModo('inmediato')}
                className={`flex flex-col items-start rounded-2xl border p-4 text-left transition cursor-pointer ${
                  modo === 'inmediato'
                    ? 'border-teal-600 bg-teal-50/70 ring-1 ring-teal-600/40'
                    : 'border-stone-200 bg-stone-50/60 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-bold text-stone-900">
                  <Zap className="h-4 w-4 text-amber-600" />
                  Retroalimentación inmediata
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    Recomendado
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-stone-600">
                  Desde la pregunta 1 te dice al instante si acertaste o te equivocaste, muestra la explicación y la estrategia EGEL.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setModo('examen')}
                className={`flex flex-col items-start rounded-2xl border p-4 text-left transition cursor-pointer ${
                  modo === 'examen'
                    ? 'border-teal-600 bg-teal-50/70 ring-1 ring-teal-600/40'
                    : 'border-stone-200 bg-stone-50/60 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-bold text-stone-900">
                  <Clock className="h-4 w-4 text-sky-600" />
                  Modo Examen Real
                </div>
                <p className="mt-1.5 text-xs text-stone-600">
                  Responde sin pistas y revisa tus aciertos y explicaciones al finalizar.
                </p>
              </button>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
              2. Elige el formato del examen
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setTipoSim('egel_completo')}
                className={`flex flex-col items-start rounded-2xl border p-4 text-left transition cursor-pointer ${
                  tipoSim === 'egel_completo'
                    ? 'border-teal-600 bg-teal-50/70 ring-1 ring-teal-600/40'
                    : 'border-stone-200 bg-stone-50/60 hover:border-stone-300'
                }`}
              >
                <div className="text-sm font-bold text-stone-900">
                  EGEL Completo (203)
                </div>
                <p className="mt-1 text-xs text-stone-600">
                  203 preguntas con la distribución por área y ámbito de la guía.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTipoSim('por_modulo')}
                className={`flex flex-col items-start rounded-2xl border p-4 text-left transition cursor-pointer ${
                  tipoSim === 'por_modulo'
                    ? 'border-teal-600 bg-teal-50/70 ring-1 ring-teal-600/40'
                    : 'border-stone-200 bg-stone-50/60 hover:border-stone-300'
                }`}
              >
                <div className="text-sm font-bold text-stone-900">
                  Por Área o Submódulo
                </div>
                <p className="mt-1 text-xs text-stone-600">
                  Elige un área o subárea específica (ej. 4.3 Metodologías) y cuántas preguntas hacer.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTipoSim('rapida')}
                className={`flex flex-col items-start rounded-2xl border p-4 text-left transition cursor-pointer ${
                  tipoSim === 'rapida'
                    ? 'border-teal-600 bg-teal-50/70 ring-1 ring-teal-600/40'
                    : 'border-stone-200 bg-stone-50/60 hover:border-stone-300'
                }`}
              >
                <div className="text-sm font-bold text-stone-900">
                  Práctica Rápida (20)
                </div>
                <p className="mt-1 text-xs text-stone-600">
                  20 reactivos con cupos proporcionales a las seis áreas del examen.
                </p>
              </button>
            </div>
          </div>

          {tipoSim === 'por_modulo' && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                  Área
                </label>
                <select
                  value={area}
                  onChange={(e) => {
                    setArea(e.target.value);
                    setSubarea('todas');
                  }}
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                >
                  <option value="todas">Todas las áreas</option>
                  {areasDisponibles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id} · {a.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                  Subárea
                </label>
                <select
                  value={subarea}
                  onChange={(e) => setSubarea(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                >
                  <option value="todas">Todas las subáreas</option>
                  {subareasDisponibles.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id} · {s.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                  Banco
                </label>
                <select
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                >
                  <option value="todos">Todos los bancos (268)</option>
                  <option value="base">Base (72)</option>
                  <option value="extendido">Extendido (131)</option>
                  <option value="refuerzo">Refuerzo (20)</option>
                  <option value="reto">Reto (45)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                  Cantidad
                </label>
                <select
                  value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value))}
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                >
                  <option value={10}>10 preguntas</option>
                  <option value={20}>20 preguntas</option>
                  <option value={40}>40 preguntas</option>
                  <option value={100}>100 preguntas</option>
                  <option value={0}>Todas las disponibles</option>
                </select>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => iniciarSimulacion(false)}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-teal-700/20 hover:bg-teal-800 disabled:opacity-60 transition cursor-pointer"
            >
              <Play className="h-4 w-4" />
              {loading ? 'Preparando reactivos...' : 'Comenzar nueva simulación'}
            </button>

            {erroresRecientes.length > 0 && (
              <button
                type="button"
                disabled={loading}
                onClick={() => iniciarSimulacion(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                Repasar mis {erroresRecientes.length} errores recientes
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'summary') {
    const total = preguntas.length;
    const pct = total > 0 ? Math.round((stats.aciertos / total) * 100) : 0;

    const porArea: Record<string, { total: number; aciertos: number }> = {};
    for (const p of preguntas) {
      if (!porArea[p.area]) porArea[p.area] = { total: 0, aciertos: 0 };
      porArea[p.area].total++;
      if (respuestas[p.id] === p.correcta) porArea[p.area].aciertos++;
    }

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
                Resumen del intento
              </span>
              <h2 className="mt-1 text-2xl font-bold text-stone-900 flex items-center gap-2">
                <Trophy className="h-6 w-6 text-amber-500" />
                Resultado: {pct}% ({stats.aciertos} / {total})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setPhase('config')}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              Nueva práctica
            </button>
          </div>

          <p className="mt-4 text-xs text-stone-600">Resultado de práctica. El porcentaje de aciertos no equivale al ICNE oficial de Ceneval.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="text-xs text-stone-500">Respondidas</div>
              <div className="mt-1 text-2xl font-bold text-stone-900">{stats.contestadas} / {total}</div>
              <div className="mt-1 text-xs text-stone-500">Sin responder: {total - stats.contestadas}</div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="text-xs text-stone-500">Aciertos / Errores</div>
              <div className="mt-1 text-2xl font-bold text-stone-900">
                <span className="text-emerald-600">{stats.aciertos}</span>
                {' / '}
                <span className="text-rose-600">{total - stats.aciertos}</span>
              </div>
              <div className="mt-1 text-xs text-stone-500">De {total} reactivos</div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-bold text-stone-800 mb-3">Desglose por área</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(porArea).map(([aId, data]) => {
                const aPct = Math.round((data.aciertos / data.total) * 100);
                return (
                  <div key={aId} className="rounded-xl border border-stone-200 bg-stone-50 p-3.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-stone-800">Área {aId}</span>
                      <span className="text-stone-600">
                        {data.aciertos}/{data.total} ({aPct}%)
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-200">
                      <div
                        className={`h-full rounded-full ${
                          aPct >= 75
                            ? 'bg-emerald-600'
                            : aPct >= 50
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                        }`}
                        style={{ width: `${aPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-stone-900">Revisión detallada</h3>
          {preguntas.map((p, idx) => {
            const sel = respuestas[p.id];
            const ok = sel === p.correcta;
            return (
              <div
                key={p.id}
                className={`rounded-2xl border p-5 bg-white ${
                  ok ? 'border-emerald-300' : 'border-rose-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-stone-600">
                    #{idx + 1} · {p.id} (Subárea {p.subarea})
                  </span>
                  {ok ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <CheckCircle2 className="h-4 w-4" /> Correcta
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                      <XCircle className="h-4 w-4" />{' '}
                      {sel === undefined ? 'Sin responder' : 'Incorrecta'}
                    </span>
                  )}
                </div>
                {p.base && (
                  <p className="mt-2 text-xs text-stone-600 leading-relaxed">{p.base}</p>
                )}
                {p.lista && p.lista.length > 0 && (
                  <ul className="mt-2 space-y-1 rounded-xl bg-stone-50 p-3 text-xs text-stone-700">
                    {p.lista.map((it, lIdx) => (
                      <li key={lIdx}>{it}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-sm font-semibold text-stone-900">{p.pregunta}</p>
                <div className="mt-3 space-y-1.5 text-xs">
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
                    <div className="mt-2 rounded-xl bg-stone-50 border border-stone-200 p-3 text-stone-700">
                      {p.opciones[p.correcta]?.explicacion}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const seleccionActual = preguntaActual ? respuestas[preguntaActual.id] : undefined;
  const yaRespondida = seleccionActual !== undefined;
  const mostrarFeedback = modo === 'inmediato' && yaRespondida;
  const esCorrecta = yaRespondida && seleccionActual === preguntaActual?.correcta;
  const progresoPct =
    preguntas.length > 0 ? Math.round((stats.contestadas / preguntas.length) * 100) : 0;

  const tiempoLimiteSeg = preguntas.length * 150;
  const tiempoRestante = Math.max(0, tiempoLimiteSeg - elapsedSeconds);
  const tiempoCritico = modo === 'examen' && tiempoRestante <= 300;

  const subrayadosActual = preguntaActual ? subrayados[preguntaActual.id] ?? {} : {};
  const tieneSubrayados = Object.values(subrayadosActual).some((arr) => arr.length > 0);
  const estaMarcada = preguntaActual ? Boolean(marcadas[preguntaActual.id]) : false;

  const addSubrayado = (campo: string, range: HighlightRange) => {
    if (!preguntaActual) return;
    setSubrayados((prev) => {
      const qMap = prev[preguntaActual.id] ?? {};
      const list = qMap[campo] ?? [];
      return {
        ...prev,
        [preguntaActual.id]: {
          ...qMap,
          [campo]: [...list, range],
        },
      };
    });
  };

  const removeSubrayado = (campo: string, index: number) => {
    if (!preguntaActual) return;
    setSubrayados((prev) => {
      const qMap = prev[preguntaActual.id] ?? {};
      const list = qMap[campo] ?? [];
      return {
        ...prev,
        [preguntaActual.id]: {
          ...qMap,
          [campo]: list.filter((_, idx) => idx !== index),
        },
      };
    });
  };

  const limpiarSubrayadosActual = () => {
    if (!preguntaActual) return;
    setSubrayados((prev) => {
      const next = { ...prev };
      delete next[preguntaActual.id];
      return next;
    });
  };

  const toggleMarcadaActual = () => {
    if (!preguntaActual) return;
    setMarcadas((prev) => ({
      ...prev,
      [preguntaActual.id]: !prev[preguntaActual.id],
    }));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Barra superior en vivo */}
      <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-bold text-stone-900">
              Pregunta {indice + 1}{' '}
              <span className="text-stone-400 font-normal">de {preguntas.length}</span>
            </span>
            <span className="hidden sm:inline-block rounded-md bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
              {modo === 'inmediato' ? 'Feedback inmediato' : 'Modo examen'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <span
              title={
                modo === 'examen'
                  ? 'Tiempo restante sugerido (2.5 min por reactivo)'
                  : 'Tiempo transcurrido'
              }
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono ${
                tiempoCritico
                  ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-300'
                  : 'bg-stone-100 text-stone-700'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              {modo === 'examen' ? formatSeconds(tiempoRestante) : formatSeconds(elapsedSeconds)}
            </span>
            {modo === 'inmediato' && (
              <>
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {stats.aciertos}
                </span>
                <span className="flex items-center gap-1 text-rose-600">
                  <XCircle className="h-4 w-4" />
                  {stats.errores}
                </span>
                <span className="flex items-center gap-1 text-amber-600">
                  {stats.contestadas}/{preguntas.length} respondidas
                </span>
              </>
            )}
            <button
              type="button"
              onClick={pausarYSalirAlMenu}
              title="Pausar y volver al menú sin perder tu avance"
              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 transition cursor-pointer"
            >
              <PauseCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Pausar</span>
            </button>
            <button
              type="button"
              onClick={finalizar}
              className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 transition cursor-pointer"
            >
              Finalizar
            </button>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-teal-600 transition-all duration-300"
            style={{ width: `${progresoPct}%` }}
          />
        </div>
      </div>

      {/* Módulos del examen + Navegador del módulo actual */}
      {(() => {
        const modulos: Array<{ area: string; startIdx: number; count: number; answered: number }> = [];
        const seen = new Map<string, number>();
        preguntas.forEach((p, i) => {
          if (!seen.has(p.area)) {
            seen.set(p.area, modulos.length);
            modulos.push({ area: p.area, startIdx: i, count: 0, answered: 0 });
          }
          const m = modulos[seen.get(p.area)!];
          m.count++;
          if (respuestas[p.id] !== undefined) m.answered++;
        });
        const areaActual = preguntaActual?.area;

        return (
          <div className="space-y-2.5">
            {modulos.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {modulos.map((m) => (
                  <button
                    key={m.area}
                    type="button"
                    onClick={() => {
                      setIndice(m.startIdx);
                      setMostrarTodasExplicaciones(false);
                    }}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      m.area === areaActual
                        ? 'bg-teal-700 text-white shadow-sm'
                        : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    Módulo {m.area}{' '}
                    <span className="opacity-75">
                      ({m.answered}/{m.count})
                    </span>
                  </button>
                ))}
              </div>
            )}

            {areaActual && (
              <div className="text-xs font-semibold text-stone-600 px-1">
                Módulo {areaActual}
                {areaNombres[areaActual] ? ` · ${areaNombres[areaActual]}` : ''}
              </div>
            )}

            <details className="rounded-xl border border-stone-200 bg-white px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold text-stone-700">Mapa de preguntas · abrir para saltar a otra</summary>
              <div className="mt-3 flex flex-wrap gap-1.5">
              {preguntas.map((p, idx) => {
                if (modulos.length > 1 && p.area !== areaActual) return null;
                const sel = respuestas[p.id];
                let cls = 'bg-white border-stone-200 text-stone-500 hover:border-stone-400';
                if (idx === indice) {
                  cls = 'bg-teal-700 border-teal-700 text-white font-bold';
                } else if (sel !== undefined) {
                  if (modo === 'inmediato') {
                    cls =
                      sel === p.correcta
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-800 font-semibold'
                        : 'bg-rose-50 border-rose-400 text-rose-800 font-semibold';
                  } else {
                    cls = 'bg-sky-50 border-sky-400 text-sky-800 font-semibold';
                  }
                }
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setIndice(idx);
                      setMostrarTodasExplicaciones(false);
                    }}
                    className={`relative h-7 min-w-[28px] rounded-lg border px-1.5 text-xs transition cursor-pointer ${cls}`}
                  >
                    {idx + 1}
                    {marcadas[p.id] && (
                      <span
                        title="Marcada para revisar"
                        className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-500 ring-1 ring-white"
                      />
                    )}
                  </button>
                );
              })}
              </div>
            </details>
          </div>
        );
      })()}

      {/* Tarjeta de la pregunta */}
      {preguntaActual && (
        <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-teal-50 border border-teal-700/20 px-2.5 py-0.5 font-semibold text-teal-800">
                {preguntaActual.id}
              </span>
              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-stone-700">
                {preguntaActual.subarea}
                {subareaNombres[preguntaActual.subarea]
                  ? ` · ${subareaNombres[preguntaActual.subarea]}`
                  : ''}
              </span>
              {preguntaActual.nivel && (
                <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-stone-700 capitalize">
                  {preguntaActual.nivel}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSubrayarActivo((v) => !v)}
                title="Activa para subrayar pistas y restricciones en el caso (Método DCPDV)"
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                  subrayarActivo
                    ? 'border-amber-400 bg-amber-100 text-amber-900 shadow-sm'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <Highlighter className="h-3.5 w-3.5" />
                Subrayar
              </button>

              {subrayarActivo && (
                <div className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50/70 px-2 py-1">
                  {(
                    [
                      { id: 'amber', cls: 'bg-amber-300', label: 'Pista' },
                      { id: 'emerald', cls: 'bg-emerald-300', label: 'Dato clave' },
                      { id: 'rose', cls: 'bg-rose-300', label: 'Trampa' },
                    ] as const
                  ).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      title={`Color: ${c.label}`}
                      onClick={() => setColorSubrayado(c.id)}
                      className={`h-4 w-4 rounded-full ${c.cls} transition cursor-pointer ${
                        colorSubrayado === c.id ? 'ring-2 ring-stone-800 scale-110' : 'opacity-70'
                      }`}
                    />
                  ))}
                  {tieneSubrayados && (
                    <button
                      type="button"
                      onClick={limpiarSubrayadosActual}
                      title="Quitar todos los subrayados de esta pregunta"
                      className="ml-1 inline-flex items-center gap-1 text-[11px] text-stone-600 hover:text-rose-700 cursor-pointer"
                    >
                      <Eraser className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={toggleMarcadaActual}
                title="Marcar pregunta para revisar después"
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                  estaMarcada
                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                    : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Flag className="h-3 w-3" />
                {estaMarcada ? 'Marcada' : 'Marcar'}
              </button>

              {onOpenGuia && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenGuia(
                      preguntaActual.subarea.startsWith('L1')
                        ? 'L1'
                        : preguntaActual.subarea.startsWith('L2')
                          ? 'L2'
                          : preguntaActual.subarea
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-50 transition cursor-pointer"
                >
                  <BookOpen className="h-3 w-3" />
                  Ver guía {preguntaActual.subarea}
                </button>
              )}
            </div>
          </div>

          {subrayarActivo && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-[11px] text-amber-900">
              Modo <strong>Subrayar</strong> activo: selecciona cualquier fragmento del caso o pregunta para resaltarlo, o haz clic sobre un subrayado para quitarlo.
            </div>
          )}

          {preguntaActual.estimulo && (
            <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-line">
              <HighlightableText
                text={preguntaActual.estimulo}
                ranges={subrayadosActual.estimulo ?? []}
                enabled={subrayarActivo}
                activeColor={colorSubrayado}
                onAddRange={(r) => addSubrayado('estimulo', r)}
                onRemoveRange={(idx) => removeSubrayado('estimulo', idx)}
              />
            </div>
          )}

          {preguntaActual.base && (
            <div className="mb-4 rounded-r-xl border-l-4 border-teal-600 bg-stone-50 p-4 text-sm text-stone-800 leading-relaxed whitespace-pre-line">
              <HighlightableText
                text={preguntaActual.base}
                ranges={subrayadosActual.base ?? []}
                enabled={subrayarActivo}
                activeColor={colorSubrayado}
                onAddRange={(r) => addSubrayado('base', r)}
                onRemoveRange={(idx) => removeSubrayado('base', idx)}
              />
            </div>
          )}

          {preguntaActual.lista && preguntaActual.lista.length > 0 && (
            <div className="mb-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2">
                Elementos a ordenar / relacionar
              </div>
              <ul className="space-y-1.5 text-sm text-stone-800">
                {preguntaActual.lista.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <HighlightableText
                      text={item}
                      ranges={subrayadosActual[`lista_${idx}`] ?? []}
                      enabled={subrayarActivo}
                      activeColor={colorSubrayado}
                      onAddRange={(r) => addSubrayado(`lista_${idx}`, r)}
                      onRemoveRange={(rIdx) => removeSubrayado(`lista_${idx}`, rIdx)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preguntaActual.codigo && (
            <pre className="mb-4 overflow-x-auto rounded-2xl bg-stone-900 p-4 font-mono text-xs sm:text-sm text-emerald-300 leading-relaxed">
              <code>{preguntaActual.codigo}</code>
            </pre>
          )}

          <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-snug mb-5">
            <HighlightableText
              text={preguntaActual.pregunta}
              ranges={subrayadosActual.pregunta ?? []}
              enabled={subrayarActivo}
              activeColor={colorSubrayado}
              onAddRange={(r) => addSubrayado('pregunta', r)}
              onRemoveRange={(idx) => removeSubrayado('pregunta', idx)}
            />
          </h2>

          {/* Opciones */}
          <div className="space-y-3">
            {preguntaActual.opciones.map((op, i) => {
              const isSelected = seleccionActual === i;
              const isCorrectOption = i === preguntaActual.correcta;

              let cardClass =
                'border-stone-200 bg-stone-50/70 hover:border-teal-600 hover:bg-teal-50/30 text-stone-800';

              if (mostrarFeedback) {
                if (isCorrectOption) {
                  cardClass =
                    'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500/40';
                } else if (isSelected && !isCorrectOption) {
                  cardClass =
                    'border-rose-500 bg-rose-50 text-rose-950 ring-1 ring-rose-500/40';
                } else {
                  cardClass = 'border-stone-200 bg-stone-50/40 text-stone-400';
                }
              } else if (isSelected) {
                cardClass =
                  'border-teal-600 bg-teal-50 text-teal-950 ring-1 ring-teal-600/40';
              }

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => seleccionarOpcion(i)}
                  disabled={mostrarFeedback}
                  className={`w-full flex items-start gap-3.5 rounded-2xl border p-4 text-left transition ${
                    mostrarFeedback ? 'cursor-default' : 'cursor-pointer'
                  } ${cardClass}`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      mostrarFeedback && isCorrectOption
                        ? 'bg-emerald-600 text-white'
                        : mostrarFeedback && isSelected && !isCorrectOption
                          ? 'bg-rose-600 text-white'
                          : isSelected
                            ? 'bg-teal-700 text-white'
                            : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {LETTERS[i]}
                  </span>
                  <span className="flex-1 text-sm leading-relaxed">{op.texto}</span>
                  {mostrarFeedback && isCorrectOption && (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                  )}
                  {mostrarFeedback && isSelected && !isCorrectOption && (
                    <XCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          {/* PANEL DE RETROALIMENTACIÓN INMEDIATA */}
          {mostrarFeedback && (
            <div
              className={`mt-6 rounded-2xl border p-5 space-y-4 ${
                esCorrecta
                  ? 'border-emerald-300 bg-emerald-50/60'
                  : 'border-rose-300 bg-rose-50/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {esCorrecta ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                    <div>
                      <h3 className="text-base font-bold text-emerald-900">
                        ¡Correcto! Excelente razonamiento
                      </h3>
                      <p className="text-xs text-emerald-700">
                        Llevas {stats.aciertos} acierto{stats.aciertos === 1 ? '' : 's'} de{' '}
                        {stats.contestadas} respondida{stats.contestadas === 1 ? '' : 's'}.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-6 w-6 text-rose-600 shrink-0" />
                    <div>
                      <h3 className="text-base font-bold text-rose-900">
                        Incorrecto
                        {preguntaActual.correcta !== undefined
                          ? ` — La respuesta correcta es la ${LETTERS[preguntaActual.correcta]}`
                          : ''}
                      </h3>
                      <p className="text-xs text-rose-700">
                        Revisa por qué descartar tu opción y qué distingue a la correcta.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {!esCorrecta && seleccionActual !== undefined && (
                <div className="rounded-xl border border-rose-200 bg-white p-3.5 text-xs sm:text-sm text-rose-900">
                  <span className="font-bold text-rose-700">
                    Por qué {LETTERS[seleccionActual]} es incorrecta:{' '}
                  </span>
                  {preguntaActual.opciones[seleccionActual]?.explicacion}
                </div>
              )}

              {preguntaActual.correcta !== undefined && (
                <div className="rounded-xl border border-emerald-200 bg-white p-3.5 text-xs sm:text-sm text-emerald-950">
                  <span className="font-bold text-emerald-700">
                    Por qué {LETTERS[preguntaActual.correcta]} es correcta:{' '}
                  </span>
                  {preguntaActual.opciones[preguntaActual.correcta]?.explicacion}
                </div>
              )}

              {preguntaActual.estrategia && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs sm:text-sm text-amber-950">
                  <Lightbulb className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-800">Estrategia EGEL: </span>
                    {preguntaActual.estrategia}
                  </div>
                </div>
              )}

              {preguntaActual.trampa && (
                <div className="flex items-start gap-2.5 rounded-xl border border-orange-200 bg-orange-50 p-3.5 text-xs sm:text-sm text-orange-950">
                  <AlertCircle className="h-4 w-4 shrink-0 text-orange-600 mt-0.5" />
                  <div>
                    <span className="font-bold text-orange-800">Trampa frecuente: </span>
                    {preguntaActual.trampa}
                  </div>
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setMostrarTodasExplicaciones((v) => !v)}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline cursor-pointer"
                >
                  {mostrarTodasExplicaciones
                    ? 'Ocultar explicación de todas las opciones'
                    : 'Ver explicación de las 3 opciones'}
                </button>
                {mostrarTodasExplicaciones && (
                  <div className="mt-2.5 space-y-2">
                    {preguntaActual.opciones.map((o, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-stone-200 bg-white p-3 text-xs text-stone-700"
                      >
                        <strong className="text-stone-900">
                          Opción {LETTERS[idx]} ({o.texto}):
                        </strong>{' '}
                        {o.explicacion}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(preguntaActual.conceptos?.length || preguntaActual.fuentes?.length) && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  {preguntaActual.conceptos?.map((c) => (
                    <span
                      key={c}
                      className="rounded-md bg-white border border-stone-200 px-2 py-0.5 text-stone-700"
                    >
                      {c}
                    </span>
                  ))}
                  {preguntaActual.fuentes?.map((f, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 text-stone-500"
                    >
                      <BookOpen className="h-3 w-3" />
                      {f.recurso}
                      {f.detalle ? ` (${f.detalle})` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Navegación inferior + pista de atajos */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-200">
            <button
              type="button"
              disabled={indice === 0}
              onClick={() => {
                setIndice((i) => Math.max(0, i - 1));
                setMostrarTodasExplicaciones(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40 transition cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Anterior
            </button>

            <span className="hidden sm:inline text-[11px] text-stone-400">
              Atajos: <kbd className="rounded bg-stone-100 px-1.5 py-0.5 border border-stone-200">A</kbd>{' '}
              <kbd className="rounded bg-stone-100 px-1.5 py-0.5 border border-stone-200">B</kbd>{' '}
              <kbd className="rounded bg-stone-100 px-1.5 py-0.5 border border-stone-200">C</kbd> para responder ·{' '}
              <kbd className="rounded bg-stone-100 px-1.5 py-0.5 border border-stone-200">←</kbd>{' '}
              <kbd className="rounded bg-stone-100 px-1.5 py-0.5 border border-stone-200">→</kbd> para navegar
            </span>

            {indice < preguntas.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  setIndice((i) => Math.min(preguntas.length - 1, i + 1));
                  setMostrarTodasExplicaciones(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 transition cursor-pointer"
              >
                Siguiente
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={finalizar}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition cursor-pointer"
              >
                Finalizar y ver resultado
                <Trophy className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
