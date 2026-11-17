import type { EstadisticasUsuario, Intento, Pregunta } from '../types/egel';

const STORAGE_KEY = 'egel_local_progress_v1';

interface LocalStore {
  intentos: Intento[];
  por_area: Record<string, { total: number; aciertos: number }>;
  errores_recientes: string[];
  total_respuestas: number;
  total_aciertos: number;
}

function readStore(): LocalStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        intentos: [],
        por_area: {},
        errores_recientes: [],
        total_respuestas: 0,
        total_aciertos: 0,
      };
    }
    return JSON.parse(raw) as LocalStore;
  } catch {
    return {
      intentos: [],
      por_area: {},
      errores_recientes: [],
      total_respuestas: 0,
      total_aciertos: 0,
    };
  }
}

export function saveLocalAttempt(params: {
  modo: 'inmediato' | 'examen';
  area_filtro: string | null;
  banco_filtro: string | null;
  preguntas: Pregunta[];
  respuestas: Record<string, number>;
}): void {
  const store = readStore();
  let aciertos = 0;
  let errores = 0;
  const nuevosErrores: string[] = [];

  for (const p of params.preguntas) {
    const sel = params.respuestas[p.id];
    if (sel === undefined) continue;
    store.total_respuestas++;
    if (!store.por_area[p.area]) {
      store.por_area[p.area] = { total: 0, aciertos: 0 };
    }
    store.por_area[p.area].total++;

    if (sel === p.correcta) {
      aciertos++;
      store.total_aciertos++;
      store.por_area[p.area].aciertos++;
    } else {
      errores++;
      nuevosErrores.push(p.id);
    }
  }

  const total = params.preguntas.length;
  const porcentaje = total > 0 ? Math.round((aciertos / total) * 100) : 0;
  const nuevoIntento: Intento = {
    id: Date.now(),
    modo: params.modo,
    area_filtro: params.area_filtro,
    banco_filtro: params.banco_filtro,
    total_preguntas: total,
    aciertos,
    errores,
    porcentaje,
    completado: true,
    created_at: new Date().toISOString(),
  };

  store.intentos = [nuevoIntento, ...store.intentos].slice(0, 30);
  store.errores_recientes = Array.from(
    new Set([...nuevosErrores, ...store.errores_recientes])
  ).slice(0, 30);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getLocalProgress(): {
  intentos: Intento[];
  estadisticas: EstadisticasUsuario;
} {
  const store = readStore();
  const por_area: Record<string, { total: number; aciertos: number; porcentaje: number }> = {};
  for (const [k, v] of Object.entries(store.por_area)) {
    por_area[k] = {
      total: v.total,
      aciertos: v.aciertos,
      porcentaje: v.total > 0 ? Math.round((v.aciertos / v.total) * 100) : 0,
    };
  }

  return {
    intentos: store.intentos,
    estadisticas: {
      total_intentos: store.intentos.length,
      total_respuestas: store.total_respuestas,
      total_aciertos: store.total_aciertos,
      precision_global:
        store.total_respuestas > 0
          ? Math.round((store.total_aciertos / store.total_respuestas) * 100)
          : 0,
      por_area,
      errores_recientes: store.errores_recientes,
    },
  };
}
