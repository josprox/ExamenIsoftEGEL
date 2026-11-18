import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Eraser,
  Flag,
  Highlighter,
  Lightbulb,
  Lock,
  LogIn,
  PauseCircle,
  Play,
  RotateCcw,
  Trash2,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react-native';
import { api } from '../lib/api';
import type { Intento, Pregunta, Temario, User } from '../types/egel';
import {
  HighlightableText,
  type HighlightColor,
  type HighlightRange,
} from './HighlightableText';

interface SimulatorProps {
  temario: Temario | null;
  user: User | null;
  intentos?: Intento[];
  lastWsEvent?: {
    action: string;
    intento_id: number;
    pregunta_id?: string;
    seleccionada?: number;
    ts: number;
  } | null;
  lastSubrayadoSync?: {
    pregunta_id: string;
    subrayados: Record<string, HighlightRange[]>;
    ts: number;
  } | null;
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

function formatSeconds(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

export function Simulator({
  temario,
  user,
  intentos = [],
  lastWsEvent = null,
  lastSubrayadoSync = null,
  erroresRecientes = [],
  initialArea = 'todas',
  initialSubarea = 'todas',
  resumeIntentoId = null,
  onResumeHandled,
  onOpenGuia,
  onOpenAuth,
  onAttemptFinished,
}: SimulatorProps) {
  const [phase, setPhase] = useState<Phase>('config');
  const [modo, setModo] = useState<Modo>('inmediato');
  const [tipoSim, setTipoSim] = useState<TipoSimulacion>(() =>
    initialArea !== 'todas' || initialSubarea !== 'todas' ? 'por_modulo' : 'rapida'
  );
  const [area, setArea] = useState<string>(initialArea);
  const [subarea, setSubarea] = useState<string>(initialSubarea);
  const [banco, setBanco] = useState<string>('todos');
  const [cantidad, setCantidad] = useState<number>(20);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [indice, setIndice] = useState<number>(0);
  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
  const [intentoId, setIntentoId] = useState<number | null>(null);
  const [mostrarTodasExplicaciones, setMostrarTodasExplicaciones] = useState(false);
  const [mapaAbierto, setMapaAbierto] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [subrayarActivo, setSubrayarActivo] = useState(false);
  const [colorSubrayado, setColorSubrayado] = useState<HighlightColor>('amber');
  const [subrayados, setSubrayados] = useState<Record<string, Record<string, HighlightRange[]>>>({});
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>({});
  const finishingRef = useRef(false);

  // Simulación pausada derivada 100% de la Base de Datos (sin cookies/localStorage)
  const pendingIntento = useMemo(
    () =>
      user
        ? intentos.find(
            (i) => !i.completado && i.pregunta_ids && i.pregunta_ids.length > 0
          ) ?? null
        : null,
    [user, intentos]
  );

  useEffect(() => {
    if (initialArea !== 'todas' || initialSubarea !== 'todas') {
      setTipoSim('por_modulo');
      setArea(initialArea);
      setSubarea(initialSubarea);
    }
  }, [initialArea, initialSubarea]);

  // Si otro dispositivo responde, elimina o finaliza el intento actual vía WebSocket, sincronizamos al instante
  useEffect(() => {
    if (!lastWsEvent || !intentoId || phase !== 'running') return;
    if (lastWsEvent.intento_id !== intentoId) return;

    if (lastWsEvent.action === 'deleted') {
      setPhase('config');
      setIntentoId(null);
      setPreguntas([]);
      setRespuestas({});
      setIndice(0);
    } else if (lastWsEvent.action === 'finished' && !finishingRef.current) {
      setPhase('summary');
    } else if (
      lastWsEvent.action === 'updated' &&
      lastWsEvent.pregunta_id &&
      typeof lastWsEvent.seleccionada === 'number'
    ) {
      const pid = lastWsEvent.pregunta_id;
      const sel = lastWsEvent.seleccionada;
      setRespuestas((prev) => (prev[pid] === sel ? prev : { ...prev, [pid]: sel }));
    }
  }, [lastWsEvent, intentoId, phase]);

  // Sincronizar subrayados en vivo desde otro dispositivo vía WebSocket
  useEffect(() => {
    if (!lastSubrayadoSync || phase !== 'running') return;
    setSubrayados((prev) => ({
      ...prev,
      [lastSubrayadoSync.pregunta_id]: lastSubrayadoSync.subrayados,
    }));
  }, [lastSubrayadoSync, phase]);

  const cargarSubrayadosDePreguntas = useCallback(async (list: Pregunta[]) => {
    if (!user || list.length === 0) return;
    try {
      const res = await api.getSubrayados(list.map((p) => p.id));
      setSubrayados(res.subrayados ?? {});
    } catch {
      // ignore
    }
  }, [user]);

  const cargarIntentoDesdeBD = useCallback(async (id: number) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getIntento(id);
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
      setPhase('running');
      void cargarSubrayadosDePreguntas(res.preguntas);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo reanudar el intento.');
    } finally {
      setLoading(false);
    }
  }, [cargarSubrayadosDePreguntas]);

  useEffect(() => {
    if (!resumeIntentoId || !user) return;
    cargarIntentoDesdeBD(resumeIntentoId).finally(() => {
      onResumeHandled?.();
    });
  }, [resumeIntentoId, user, cargarIntentoDesdeBD, onResumeHandled]);

  useEffect(() => {
    if (phase !== 'running') return;
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

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

      const intentoRes = await api.crearIntento({
        modo,
        area_filtro: soloErrores ? 'errores' : subarea !== 'todas' ? subarea : area,
        banco_filtro: banco,
        total_preguntas: res.preguntas.length,
        pregunta_ids: res.preguntas.map((p) => p.id),
      });

      setPreguntas(res.preguntas);
      setIntentoId(intentoRes.intento.id);
      setRespuestas({});
      setIndice(0);
      setElapsedSeconds(0);
      setSubrayados({});
      setMarcadas({});
      setMostrarTodasExplicaciones(false);
      setPhase('running');
      void cargarSubrayadosDePreguntas(res.preguntas);
      onAttemptFinished();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudieron cargar las preguntas.'
      );
    } finally {
      setLoading(false);
    }
  };

  const pausarYSalirAlMenu = () => {
    setPhase('config');
    onAttemptFinished();
  };

  const descartarSimulacion = async (targetId?: number) => {
    const idToDelete = targetId ?? intentoId ?? pendingIntento?.id ?? null;
    if (user && idToDelete) {
      setLoading(true);
      try {
        await api.eliminarIntento(idToDelete);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
      onAttemptFinished();
    }
    if (idToDelete === intentoId) {
      setIntentoId(null);
      setPreguntas([]);
      setRespuestas({});
      setIndice(0);
      setElapsedSeconds(0);
      setSubrayados({});
      setMarcadas({});
    }
  };

  const preguntaActual = preguntas[indice];

  // Agrupación por Módulos (A1..L2) igual al diseño original
  const modulos = useMemo(() => {
    const order: string[] = [];
    const byArea = new Map<string, Array<{ pregunta: Pregunta; globalIndex: number }>>();
    preguntas.forEach((p, idx) => {
      if (!byArea.has(p.area)) {
        order.push(p.area);
        byArea.set(p.area, []);
      }
      byArea.get(p.area)!.push({ pregunta: p, globalIndex: idx });
    });
    return order.map((areaId) => {
      const items = byArea.get(areaId)!;
      const answeredCount = items.filter((it) => respuestas[it.pregunta.id] !== undefined).length;
      return {
        areaId,
        nombre: areaNombres[areaId] ?? `Área ${areaId}`,
        items,
        answeredCount,
        totalCount: items.length,
      };
    });
  }, [preguntas, respuestas, areaNombres]);

  const moduloActual = useMemo(
    () => modulos.find((m) => m.areaId === preguntaActual?.area) ?? modulos[0],
    [modulos, preguntaActual]
  );

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
          // ignore
        }
      }
    },
    [preguntaActual, modo, respuestas, user, intentoId]
  );

  const finalizarSimulacion = async () => {
    finishingRef.current = true;
    setLoading(true);
    try {
      if (user && intentoId) {
        const res = await api.finalizarIntento(intentoId, elapsedSeconds);
        if (res.preguntas && res.preguntas.length > 0) {
          setPreguntas(res.preguntas);
        }
      }
      onAttemptFinished();
      setPhase('summary');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al finalizar intento');
    } finally {
      finishingRef.current = false;
      setLoading(false);
    }
  };

  const addHighlight = (field: string, range: HighlightRange) => {
    if (!preguntaActual) return;
    const pid = preguntaActual.id;
    setSubrayados((prev) => {
      const currentQ = prev[pid] ?? {};
      const list = currentQ[field] ?? [];
      const updatedQ = { ...currentQ, [field]: [...list, range] };
      if (user) void api.saveSubrayados(pid, updatedQ).catch(() => {});
      return { ...prev, [pid]: updatedQ };
    });
  };

  const removeHighlight = (field: string, idx: number) => {
    if (!preguntaActual) return;
    const pid = preguntaActual.id;
    setSubrayados((prev) => {
      const currentQ = prev[pid] ?? {};
      const list = currentQ[field] ?? [];
      const updatedQ = { ...currentQ, [field]: list.filter((_, i) => i !== idx) };
      if (user) void api.saveSubrayados(pid, updatedQ).catch(() => {});
      return { ...prev, [pid]: updatedQ };
    });
  };

  const clearCurrentHighlights = () => {
    if (!preguntaActual) return;
    const pid = preguntaActual.id;
    setSubrayados((prev) => {
      const copy = { ...prev };
      delete copy[pid];
      return copy;
    });
    if (user) void api.saveSubrayados(pid, {}).catch(() => {});
  };

  // ==================== FASE 1: CONFIGURACIÓN ====================
  if (phase === 'config') {
    return (
      <View className="mx-auto w-full max-w-4xl gap-5">
        {!user && (
          <View className="flex-row flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 p-4 sm:p-5">
            <View className="flex-1 flex-row items-start gap-3 min-w-[220px]">
              <Lock size={20} color="#d97706" />
              <View className="flex-1">
                <Text className="text-sm font-bold text-amber-950 dark:text-amber-200">
                  Inicia sesión para practicar en el simulador
                </Text>
                <Text className="mt-0.5 text-xs text-amber-900 dark:text-amber-300/90">
                  Tu cuenta guarda en la base de datos tu historial, métricas por subárea y simulaciones pausadas entre dispositivos.
                </Text>
              </View>
            </View>
            <Pressable
              onPress={onOpenAuth}
              className="flex-row items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2.5 active:bg-teal-800"
            >
              <LogIn size={15} color="#ffffff" />
              <Text className="text-xs font-semibold text-white">Iniciar sesión / Registro</Text>
            </Pressable>
          </View>
        )}

        {pendingIntento && (
          <View className="flex-row flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-700/25 dark:border-teal-600/40 bg-teal-50 dark:bg-teal-950/50 p-4">
            <View className="flex-1 min-w-[200px]">
              <Text className="text-sm font-bold text-teal-900 dark:text-teal-200">
                Tienes una simulación pausada ({pendingIntento.aciertos + pendingIntento.errores}/
                {pendingIntento.total_preguntas} respondidas)
              </Text>
              <Text className="text-xs text-teal-800 dark:text-teal-300 mt-0.5 capitalize">
                Modo {pendingIntento.modo} · {pendingIntento.area_filtro || 'Todas'} · Sincronizado en la nube
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => cargarIntentoDesdeBD(pendingIntento.id)}
                disabled={loading}
                className="flex-row items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 active:bg-teal-800"
              >
                <Play size={14} color="#ffffff" />
                <Text className="text-xs font-semibold text-white">Reanudar</Text>
              </Pressable>
              <Pressable
                onPress={() => descartarSimulacion(pendingIntento.id)}
                disabled={loading}
                className="flex-row items-center gap-1 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 active:bg-stone-50"
              >
                <Trash2 size={14} color="#dc2626" />
                <Text className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  Descartar
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <View className="overflow-hidden rounded-3xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <View className="h-1.5 w-full bg-teal-600" />
          <View className="p-5 sm:p-7 gap-6">
            <View>
              <Text className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-slate-100">
                Configurar Simulador EGEL
              </Text>
              <Text className="mt-1 text-sm text-stone-600 dark:text-slate-400">
                Elige entre práctica rápida, un módulo específico o el simulacro completo oficial.
              </Text>
            </View>

            {/* Tipo de simulación */}
            <View className="gap-2.5">
              <Text className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400">
                1. Tipo de práctica
              </Text>
              <View className="flex-col sm:flex-row gap-3">
                {(
                  [
                    {
                      id: 'rapida',
                      title: 'Práctica rápida',
                      desc: '20 reactivos mixtos ideales para sesión corta',
                      icon: Zap,
                    },
                    {
                      id: 'por_modulo',
                      title: 'Por área / subárea',
                      desc: 'Enfócate en un tema o banco específico',
                      icon: BookOpen,
                    },
                    {
                      id: 'egel_completo',
                      title: 'EGEL Completo (203)',
                      desc: '143 disciplinares + 60 de Lenguaje en orden',
                      icon: Trophy,
                    },
                  ] as const
                ).map((item) => {
                  const active = tipoSim === item.id;
                  const Icon = item.icon;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setTipoSim(item.id)}
                      className={`flex-1 rounded-2xl border-2 p-4 ${
                        active
                          ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/50'
                          : 'border-stone-200 dark:border-slate-800 bg-stone-50/60 dark:bg-slate-800/40'
                      }`}
                    >
                      <View className="flex-row items-center gap-2.5 mb-2">
                        <View
                          className={`h-8 w-8 rounded-xl items-center justify-center ${
                            active
                              ? 'bg-teal-700'
                              : 'bg-stone-200/70 dark:bg-slate-700'
                          }`}
                        >
                          <Icon size={16} color={active ? '#ffffff' : '#64748b'} />
                        </View>
                        <Text
                          className={`flex-1 text-sm font-bold ${
                            active
                              ? 'text-teal-900 dark:text-teal-200'
                              : 'text-stone-900 dark:text-slate-100'
                          }`}
                        >
                          {item.title}
                        </Text>
                      </View>
                      <Text className="text-xs text-stone-600 dark:text-slate-400 leading-relaxed">
                        {item.desc}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Filtros de módulo */}
            {tipoSim === 'por_modulo' && (
              <View className="gap-3.5 rounded-2xl border border-stone-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-800/50 p-4">
                <View>
                  <Text className="text-xs font-semibold text-stone-700 dark:text-slate-300 mb-1.5">
                    Área
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row gap-1.5">
                      <Pressable
                        onPress={() => {
                          setArea('todas');
                          setSubarea('todas');
                        }}
                        className={`rounded-lg px-3 py-1.5 ${
                          area === 'todas'
                            ? 'bg-teal-700'
                            : 'bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            area === 'todas'
                              ? 'text-white'
                              : 'text-stone-700 dark:text-slate-300'
                          }`}
                        >
                          Todas
                        </Text>
                      </Pressable>
                      {areasDisponibles.map((a) => (
                        <Pressable
                          key={a.id}
                          onPress={() => {
                            setArea(a.id);
                            setSubarea('todas');
                          }}
                          className={`rounded-lg px-3 py-1.5 ${
                            area === a.id
                              ? 'bg-teal-700'
                              : 'bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700'
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              area === a.id
                                ? 'text-white'
                                : 'text-stone-700 dark:text-slate-300'
                            }`}
                          >
                            {a.id} · {a.nombre}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View>
                  <Text className="text-xs font-semibold text-stone-700 dark:text-slate-300 mb-1.5">
                    Subárea
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row gap-1.5">
                      <Pressable
                        onPress={() => setSubarea('todas')}
                        className={`rounded-lg px-3 py-1.5 ${
                          subarea === 'todas'
                            ? 'bg-teal-700'
                            : 'bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            subarea === 'todas'
                              ? 'text-white'
                              : 'text-stone-700 dark:text-slate-300'
                          }`}
                        >
                          Todas
                        </Text>
                      </Pressable>
                      {subareasDisponibles.map((s) => (
                        <Pressable
                          key={s.id}
                          onPress={() => setSubarea(s.id)}
                          className={`rounded-lg px-3 py-1.5 ${
                            subarea === s.id
                              ? 'bg-teal-700'
                              : 'bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700'
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              subarea === s.id
                                ? 'text-white'
                                : 'text-stone-700 dark:text-slate-300'
                            }`}
                          >
                            {s.id} · {s.nombre}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View className="flex-row flex-wrap gap-4">
                  <View>
                    <Text className="text-xs font-semibold text-stone-700 dark:text-slate-300 mb-1.5">
                      Banco
                    </Text>
                    <View className="flex-row gap-1.5">
                      {[
                        { id: 'todos', label: 'Todos' },
                        { id: 'base', label: 'Base' },
                        { id: 'extra', label: 'Extra' },
                      ].map((b) => (
                        <Pressable
                          key={b.id}
                          onPress={() => setBanco(b.id)}
                          className={`rounded-lg px-3 py-1.5 ${
                            banco === b.id
                              ? 'bg-teal-700'
                              : 'bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700'
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              banco === b.id
                                ? 'text-white'
                                : 'text-stone-700 dark:text-slate-300'
                            }`}
                          >
                            {b.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Text className="text-xs font-semibold text-stone-700 dark:text-slate-300 mb-1.5">
                      Cantidad
                    </Text>
                    <View className="flex-row gap-1.5">
                      {[10, 20, 40, 0].map((c) => (
                        <Pressable
                          key={c}
                          onPress={() => setCantidad(c)}
                          className={`rounded-lg px-3 py-1.5 ${
                            cantidad === c
                              ? 'bg-teal-700'
                              : 'bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700'
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              cantidad === c
                                ? 'text-white'
                                : 'text-stone-700 dark:text-slate-300'
                            }`}
                          >
                            {c === 0 ? 'Todas' : c}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Modo de retroalimentación */}
            <View className="gap-2.5">
              <Text className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400">
                2. Modo de retroalimentación
              </Text>
              <View className="flex-col sm:flex-row gap-3">
                <Pressable
                  onPress={() => setModo('inmediato')}
                  className={`flex-1 rounded-2xl border-2 p-4 ${
                    modo === 'inmediato'
                      ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/50'
                      : 'border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <Text className="text-sm font-bold text-stone-900 dark:text-slate-100">
                    Estudio (inmediato)
                  </Text>
                  <Text className="mt-1 text-xs text-stone-600 dark:text-slate-400">
                    Muestra al instante la explicación, estrategia DCPDV y trampa común.
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setModo('examen')}
                  className={`flex-1 rounded-2xl border-2 p-4 ${
                    modo === 'examen'
                      ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/50'
                      : 'border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <Text className="text-sm font-bold text-stone-900 dark:text-slate-100">
                    Examen real (oculto)
                  </Text>
                  <Text className="mt-1 text-xs text-stone-600 dark:text-slate-400">
                    No revela respuestas ni explicaciones hasta que finalices el intento.
                  </Text>
                </Pressable>
              </View>
            </View>

            {errorMsg && (
              <View className="flex-row items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3">
                <AlertCircle size={16} color="#e11d48" />
                <Text className="flex-1 text-xs text-rose-700 dark:text-rose-300">
                  {errorMsg}
                </Text>
              </View>
            )}

            <View className="flex-row flex-wrap items-center gap-3 pt-1">
              <Pressable
                onPress={() => iniciarSimulacion(false)}
                disabled={loading}
                className="flex-row items-center gap-2 rounded-xl bg-teal-700 px-6 py-3.5 active:bg-teal-800 disabled:opacity-60 shadow-sm"
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Play size={16} color="#ffffff" />
                )}
                <Text className="text-sm font-bold text-white">Comenzar simulación</Text>
              </Pressable>

              {erroresRecientes.length > 0 && (
                <Pressable
                  onPress={() => iniciarSimulacion(true)}
                  disabled={loading}
                  className="flex-row items-center gap-2 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 px-5 py-3.5 active:bg-amber-100"
                >
                  <RotateCcw size={15} color="#d97706" />
                  <Text className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Repasar errores ({erroresRecientes.length})
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ==================== FASE 3: RESUMEN FINAL ====================
  if (phase === 'summary') {
    return (
      <View className="mx-auto w-full max-w-4xl gap-5">
        <View className="rounded-3xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm items-center gap-3">
          <View className="h-14 w-14 rounded-2xl bg-teal-50 dark:bg-teal-950/70 items-center justify-center">
            <Trophy size={28} color="#0d9488" />
          </View>
          <Text className="text-2xl font-extrabold text-stone-900 dark:text-slate-100">
            Simulación finalizada
          </Text>
          <Text className="text-sm text-stone-600 dark:text-slate-300 text-center">
            Obtuviste {stats.aciertos} aciertos de {preguntas.length} reactivos ({stats.porcentaje}%)
            en {formatSeconds(elapsedSeconds)}.
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-3">
            <Pressable
              onPress={() => setPhase('config')}
              className="flex-row items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 active:bg-teal-800"
            >
              <RotateCcw size={15} color="#ffffff" />
              <Text className="text-sm font-semibold text-white">Nueva simulación</Text>
            </Pressable>
          </View>
        </View>

        <View className="gap-3">
          {preguntas.map((p, idx) => {
            const sel = respuestas[p.id];
            const ok = sel !== undefined && sel === p.correcta;
            return (
              <View
                key={p.id}
                className={`rounded-2xl border p-4 ${
                  ok
                    ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                    : 'border-rose-200 dark:border-rose-800/60 bg-rose-50/40 dark:bg-rose-950/20'
                }`}
              >
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="text-xs font-bold text-stone-600 dark:text-slate-400">
                    #{idx + 1} · {p.id} ({p.subarea})
                  </Text>
                  <Text
                    className={`text-xs font-bold ${
                      ok
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {ok ? 'Correcta' : sel === undefined ? 'Sin responder' : 'Incorrecta'}
                  </Text>
                </View>
                <Text className="text-sm font-semibold text-stone-900 dark:text-slate-100">
                  {p.pregunta}
                </Text>
                {p.correcta !== undefined && (
                  <Text className="mt-2 text-xs text-emerald-800 dark:text-emerald-300">
                    <Text className="font-bold">Correcta ({LETTERS[p.correcta]}): </Text>
                    {p.opciones[p.correcta]?.texto}
                  </Text>
                )}
                {p.correcta !== undefined && p.opciones[p.correcta]?.explicacion && (
                  <View className="mt-2 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 p-3">
                    <Text className="text-xs text-stone-700 dark:text-slate-300 leading-relaxed">
                      {p.opciones[p.correcta]?.explicacion}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  // ==================== FASE 2: EN EJECUCIÓN ====================
  if (!preguntaActual) return null;

  const seleccionada = respuestas[preguntaActual.id];
  const yaRespondida = seleccionada !== undefined;
  const mostrarFeedback = modo === 'inmediato' && yaRespondida;
  const qSubrayados = subrayados[preguntaActual.id] ?? {};
  const isMarcada = Boolean(marcadas[preguntaActual.id]);

  return (
    <View className="mx-auto w-full max-w-4xl gap-4">
      {/* Barra superior de progreso */}
      <View className="rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm gap-3">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <View className="flex-row flex-wrap items-center gap-2">
            <View className="rounded-lg bg-teal-50 dark:bg-teal-950/70 px-2.5 py-1 border border-teal-700/15 dark:border-teal-500/30">
              <Text className="text-xs font-extrabold text-teal-800 dark:text-teal-300">
                {indice + 1} / {preguntas.length}
              </Text>
            </View>
            <View className="flex-row items-center gap-1 rounded-lg bg-stone-100 dark:bg-slate-800 px-2.5 py-1">
              <Clock size={13} color="#64748b" />
              <Text className="text-xs font-mono font-semibold text-stone-700 dark:text-slate-300">
                {formatSeconds(elapsedSeconds)}
              </Text>
            </View>
            {modo === 'inmediato' && (
              <View className="flex-row items-center gap-2 rounded-lg bg-stone-50 dark:bg-slate-800/70 px-2.5 py-1">
                <Text className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {stats.aciertos} ✓
                </Text>
                <Text className="text-xs font-bold text-rose-600 dark:text-rose-400">
                  {stats.errores} ✗
                </Text>
                {stats.contestadas > 0 && (
                  <Text className="text-xs font-semibold text-stone-500 dark:text-slate-400">
                    ({stats.porcentaje}%)
                  </Text>
                )}
              </View>
            )}
          </View>

          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={pausarYSalirAlMenu}
              className="flex-row items-center gap-1 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-3 py-1.5 active:bg-stone-100"
            >
              <PauseCircle size={14} color="#64748b" />
              <Text className="text-xs font-semibold text-stone-700 dark:text-slate-200">
                Pausar
              </Text>
            </Pressable>
            <Pressable
              onPress={finalizarSimulacion}
              disabled={loading}
              className="rounded-lg bg-teal-700 px-3.5 py-1.5 active:bg-teal-800"
            >
              <Text className="text-xs font-semibold text-white">Finalizar</Text>
            </Pressable>
          </View>
        </View>

        {/* Barra visual de avance */}
        <View className="h-2 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-slate-800">
          <View
            className="h-full rounded-full bg-teal-600"
            style={{
              width: `${Math.round(((indice + 1) / Math.max(1, preguntas.length)) * 100)}%`,
            }}
          />
        </View>

        {/* Herramientas DCPDV */}
        <View className="flex-row flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 dark:border-slate-800">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Pressable
              onPress={() => setSubrayarActivo((v) => !v)}
              className={`flex-row items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${
                subrayarActivo
                  ? 'bg-amber-100 dark:bg-amber-950/60 border border-amber-400 dark:border-amber-600'
                  : 'bg-stone-100 dark:bg-slate-800'
              }`}
            >
              <Highlighter size={14} color={subrayarActivo ? '#d97706' : '#64748b'} />
              <Text
                className={`text-xs font-semibold ${
                  subrayarActivo
                    ? 'text-amber-900 dark:text-amber-200'
                    : 'text-stone-700 dark:text-slate-300'
                }`}
              >
                {subrayarActivo ? 'Subrayado activo' : 'Subrayar pistas'}
              </Text>
            </Pressable>

            {subrayarActivo && (
              <>
                {(
                  [
                    { id: 'amber', dot: 'bg-amber-400' },
                    { id: 'emerald', dot: 'bg-emerald-400' },
                    { id: 'rose', dot: 'bg-rose-400' },
                  ] as const
                ).map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setColorSubrayado(c.id)}
                    className={`h-6 w-6 rounded-full items-center justify-center border ${
                      colorSubrayado === c.id
                        ? 'border-stone-900 dark:border-white'
                        : 'border-transparent'
                    }`}
                  >
                    <View className={`h-4 w-4 rounded-full ${c.dot}`} />
                  </Pressable>
                ))}
                <Pressable
                  onPress={clearCurrentHighlights}
                  className="rounded-lg bg-stone-100 dark:bg-slate-800 p-1.5 active:bg-stone-200"
                >
                  <Eraser size={14} color="#64748b" />
                </Pressable>
              </>
            )}
          </View>

          <Pressable
            onPress={() =>
              setMarcadas((prev) => ({ ...prev, [preguntaActual.id]: !prev[preguntaActual.id] }))
            }
            className={`flex-row items-center gap-1 rounded-lg px-2.5 py-1.5 ${
              isMarcada
                ? 'bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-600'
                : 'bg-stone-100 dark:bg-slate-800'
            }`}
          >
            <Flag size={13} color={isMarcada ? '#d97706' : '#64748b'} />
            <Text
              className={`text-xs font-semibold ${
                isMarcada
                  ? 'text-amber-900 dark:text-amber-200'
                  : 'text-stone-600 dark:text-slate-300'
              }`}
            >
              {isMarcada ? 'Marcada' : 'Marcar'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Tabs de Módulos + Mapa colapsable (igual que antes) */}
      {modulos.length > 0 && (
        <View className="gap-2.5">
          {modulos.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row items-center gap-2 pb-1">
                {modulos.map((m) => {
                  const active = moduloActual?.areaId === m.areaId;
                  return (
                    <Pressable
                      key={m.areaId}
                      onPress={() => {
                        const firstPending = m.items.find(
                          (it) => respuestas[it.pregunta.id] === undefined
                        );
                        setIndice((firstPending ?? m.items[0]).globalIndex);
                      }}
                      className={`rounded-full border px-3.5 py-2 ${
                        active
                          ? 'border-teal-700 bg-teal-700'
                          : 'border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          active ? 'text-white' : 'text-stone-700 dark:text-slate-300'
                        }`}
                      >
                        Módulo {m.areaId}{' '}
                        <Text
                          className={`font-medium ${
                            active ? 'text-teal-100' : 'text-stone-400 dark:text-slate-500'
                          }`}
                        >
                          ({m.answeredCount}/{m.totalCount})
                        </Text>
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {moduloActual && (
            <Text className="text-xs font-semibold text-stone-600 dark:text-slate-400 px-1">
              Módulo {moduloActual.areaId} · {moduloActual.nombre}
            </Text>
          )}

          <View className="rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
            <Pressable
              onPress={() => setMapaAbierto((v) => !v)}
              className="flex-row items-center gap-1.5"
            >
              {mapaAbierto ? (
                <ChevronDown size={15} color="#64748b" />
              ) : (
                <ChevronRight size={15} color="#64748b" />
              )}
              <Text className="text-xs font-bold text-stone-700 dark:text-slate-200">
                Mapa de preguntas · abrir para saltar a otra
              </Text>
            </Pressable>

            {mapaAbierto && moduloActual && (
              <View className="mt-3 flex-row flex-wrap gap-1.5">
                {moduloActual.items.map(({ pregunta: p, globalIndex }) => {
                  const sel = respuestas[p.id];
                  const answered = sel !== undefined;
                  const current = globalIndex === indice;
                  const marked = Boolean(marcadas[p.id]);
                  const isOk =
                    modo === 'inmediato' && answered && p.correcta !== undefined && sel === p.correcta;
                  const isBad =
                    modo === 'inmediato' && answered && p.correcta !== undefined && sel !== p.correcta;

                  let boxCls =
                    'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800';
                  let txtCls = 'text-stone-700 dark:text-slate-300';

                  if (current) {
                    boxCls = 'border-teal-700 bg-teal-700';
                    txtCls = 'text-white';
                  } else if (isOk) {
                    boxCls =
                      'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50';
                    txtCls = 'text-emerald-800 dark:text-emerald-300';
                  } else if (isBad) {
                    boxCls =
                      'border-rose-400 dark:border-rose-600 bg-rose-50 dark:bg-rose-950/50';
                    txtCls = 'text-rose-800 dark:text-rose-300';
                  } else if (marked) {
                    boxCls =
                      'border-amber-400 dark:border-amber-600 bg-amber-100 dark:bg-amber-950/60';
                    txtCls = 'text-amber-900 dark:text-amber-200';
                  } else if (answered) {
                    boxCls =
                      'border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/50';
                    txtCls = 'text-teal-800 dark:text-teal-300';
                  }

                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setIndice(globalIndex)}
                      className={`h-8 w-9 rounded-lg items-center justify-center border ${boxCls}`}
                    >
                      <Text className={`text-xs font-bold ${txtCls}`}>{globalIndex + 1}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Tarjeta de pregunta */}
      <View className="overflow-hidden rounded-3xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <View className="h-1 w-full bg-teal-600" />
        <View className="p-5 sm:p-7 gap-4">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <View className="flex-row flex-wrap items-center gap-1.5">
              <View className="rounded-md bg-teal-50 dark:bg-teal-950/70 px-2.5 py-0.5 border border-teal-700/15 dark:border-teal-500/30">
                <Text className="text-[11px] font-bold text-teal-800 dark:text-teal-300">
                  {preguntaActual.id}
                </Text>
              </View>
              <View className="rounded-md bg-stone-100 dark:bg-slate-800 px-2.5 py-0.5">
                <Text className="text-[11px] font-medium text-stone-700 dark:text-slate-300">
                  {preguntaActual.subarea} ·{' '}
                  {subareaNombres[preguntaActual.subarea] ?? preguntaActual.area}
                </Text>
              </View>
            </View>
            {onOpenGuia && (
              <Pressable
                onPress={() => onOpenGuia(preguntaActual.subarea)}
                className="flex-row items-center gap-1 rounded-lg bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 px-2.5 py-1"
              >
                <BookOpen size={12} color="#0d9488" />
                <Text className="text-[11px] font-semibold text-teal-800 dark:text-teal-300">
                  Ver guía
                </Text>
              </Pressable>
            )}
          </View>

          {preguntaActual.estimulo && (
            <View className="rounded-2xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800/60 p-4">
              <Text className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400 mb-1">
                Caso / Estímulo
              </Text>
              <HighlightableText
                text={preguntaActual.estimulo}
                ranges={qSubrayados.estimulo ?? []}
                enabled={subrayarActivo}
                activeColor={colorSubrayado}
                onAddRange={(r) => addHighlight('estimulo', r)}
                onRemoveRange={(i) => removeHighlight('estimulo', i)}
                textClassName="text-sm text-stone-800 dark:text-slate-200 leading-relaxed"
              />
            </View>
          )}

          {preguntaActual.base && (
            <HighlightableText
              text={preguntaActual.base}
              ranges={qSubrayados.base ?? []}
              enabled={subrayarActivo}
              activeColor={colorSubrayado}
              onAddRange={(r) => addHighlight('base', r)}
              onRemoveRange={(i) => removeHighlight('base', i)}
              textClassName="text-sm sm:text-base text-stone-800 dark:text-slate-200 leading-relaxed"
            />
          )}

          {preguntaActual.lista && preguntaActual.lista.length > 0 && (
            <View className="rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800/60 p-3.5 gap-1.5">
              {preguntaActual.lista.map((item, idx) => (
                <Text key={idx} className="text-sm text-stone-800 dark:text-slate-200 leading-relaxed">
                  {item}
                </Text>
              ))}
            </View>
          )}

          {preguntaActual.codigo && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="rounded-xl bg-stone-900 dark:bg-slate-950 border border-stone-800 p-4"
            >
              <Text selectable className="font-mono text-xs text-emerald-300 leading-relaxed">
                {preguntaActual.codigo}
              </Text>
            </ScrollView>
          )}

          <HighlightableText
            text={preguntaActual.pregunta}
            ranges={qSubrayados.pregunta ?? []}
            enabled={subrayarActivo}
            activeColor={colorSubrayado}
            onAddRange={(r) => addHighlight('pregunta', r)}
            onRemoveRange={(i) => removeHighlight('pregunta', i)}
            textClassName="text-base sm:text-lg font-bold text-stone-900 dark:text-slate-100 leading-snug"
          />

          {/* Opciones */}
          <View className="gap-2.5 pt-1">
            {preguntaActual.opciones.map((op, idx) => {
              const isSel = seleccionada === idx;
              const isCorrect = mostrarFeedback && preguntaActual.correcta === idx;
              const isWrong = mostrarFeedback && isSel && preguntaActual.correcta !== idx;

              let cardCls =
                'border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800/40';
              if (isCorrect)
                cardCls =
                  'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40';
              else if (isWrong)
                cardCls =
                  'border-rose-500 bg-rose-50 dark:bg-rose-950/40';
              else if (isSel)
                cardCls =
                  'border-teal-600 bg-teal-50/70 dark:bg-teal-950/50';

              return (
                <Pressable
                  key={idx}
                  onPress={() => seleccionarOpcion(idx)}
                  className={`rounded-2xl border-2 p-4 ${cardCls}`}
                >
                  <View className="flex-row items-start gap-3">
                    <View
                      className={`h-7 w-7 rounded-lg items-center justify-center ${
                        isCorrect
                          ? 'bg-emerald-600'
                          : isWrong
                            ? 'bg-rose-600'
                            : isSel
                              ? 'bg-teal-700'
                              : 'bg-stone-100 dark:bg-slate-800'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isCorrect || isWrong || isSel
                            ? 'text-white'
                            : 'text-stone-700 dark:text-slate-300'
                        }`}
                      >
                        {LETTERS[idx]}
                      </Text>
                    </View>

                    <View className="flex-1 gap-1.5">
                      <Text className="text-sm text-stone-900 dark:text-slate-100 leading-relaxed">
                        {op.texto}
                      </Text>
                      {mostrarFeedback && (isSel || isCorrect || mostrarTodasExplicaciones) && (
                        <Text
                          className={`text-xs leading-relaxed ${
                            isCorrect
                              ? 'text-emerald-800 dark:text-emerald-300'
                              : isWrong
                                ? 'text-rose-800 dark:text-rose-300'
                                : 'text-stone-600 dark:text-slate-400'
                          }`}
                        >
                          {op.explicacion}
                        </Text>
                      )}
                    </View>

                    {isCorrect && <CheckCircle2 size={18} color="#059669" />}
                    {isWrong && <XCircle size={18} color="#e11d48" />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Retroalimentación DCPDV */}
          {mostrarFeedback && (
            <View className="gap-2.5 pt-2 border-t border-stone-100 dark:border-slate-800">
              <Pressable
                onPress={() => setMostrarTodasExplicaciones((v) => !v)}
                className="self-start"
              >
                <Text className="text-xs font-semibold text-teal-800 dark:text-teal-400">
                  {mostrarTodasExplicaciones
                    ? 'Ocultar explicaciones de distractores'
                    : 'Ver explicación de todas las opciones'}
                </Text>
              </Pressable>

              {preguntaActual.estrategia && (
                <View className="flex-row items-start gap-2 rounded-xl border border-teal-200 dark:border-teal-800/60 bg-teal-50/70 dark:bg-teal-950/40 p-3.5">
                  <Lightbulb size={16} color="#0d9488" />
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-teal-900 dark:text-teal-200">
                      Estrategia DCPDV
                    </Text>
                    <Text className="mt-0.5 text-xs text-teal-900 dark:text-teal-300 leading-relaxed">
                      {preguntaActual.estrategia}
                    </Text>
                  </View>
                </View>
              )}

              {preguntaActual.trampa && (
                <View className="flex-row items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/40 p-3.5">
                  <AlertCircle size={16} color="#d97706" />
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Trampa frecuente
                    </Text>
                    <Text className="mt-0.5 text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
                      {preguntaActual.trampa}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Navegación anterior / siguiente */}
          <View className="flex-row items-center justify-between pt-2 border-t border-stone-100 dark:border-slate-800">
            <Pressable
              onPress={() => setIndice((i) => Math.max(0, i - 1))}
              disabled={indice === 0}
              className="flex-row items-center gap-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 disabled:opacity-40 active:bg-stone-50"
            >
              <ArrowLeft size={15} color="#64748b" />
              <Text className="text-xs font-semibold text-stone-700 dark:text-slate-200">
                Anterior
              </Text>
            </Pressable>

            {indice < preguntas.length - 1 ? (
              <Pressable
                onPress={() => setIndice((i) => Math.min(preguntas.length - 1, i + 1))}
                className="flex-row items-center gap-1.5 rounded-xl bg-teal-700 px-5 py-2.5 active:bg-teal-800"
              >
                <Text className="text-xs font-semibold text-white">Siguiente</Text>
                <ArrowRight size={15} color="#ffffff" />
              </Pressable>
            ) : (
              <Pressable
                onPress={finalizarSimulacion}
                disabled={loading}
                className="flex-row items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2.5 active:bg-emerald-800"
              >
                <Trophy size={15} color="#ffffff" />
                <Text className="text-xs font-semibold text-white">Ver resultados</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
