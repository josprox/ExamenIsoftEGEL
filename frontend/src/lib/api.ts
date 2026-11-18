import { Platform } from 'react-native';
import { getSyncItem, setSyncItem } from './storage';
import type {
  AuthResponse,
  BibliotecaResumen,
  ConceptoWeb,
  EstadisticasUsuario,
  Guia,
  Intento,
  Pregunta,
  RamaComandos,
  Recurso,
  RespuestaGuardada,
  ResultadoBusqueda,
  Temario,
  User,
  WebFuenteId,
} from '../types/egel';

export const TOKEN_KEY = 'egel_auth_token';
const DEFAULT_BACKEND_URL = 'https://egelsoft.astriom.org';

export function getApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const port = window.location.port;
      if (port === '8081' || port === '19006') {
        return configured || 'http://localhost:8000';
      }
    }
    return '';
  }
  return configured || DEFAULT_BACKEND_URL;
}

export function resolveBackendUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const base = getApiBaseUrl();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${normalized}` : normalized;
}

export function getWebSocketUrl(token: string): string {
  const base = getApiBaseUrl();
  if (base) {
    const wsBase = base.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
    return `${wsBase}/api/ws?token=${encodeURIComponent(token)}`;
  }
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/api/ws?token=${encodeURIComponent(token)}`;
  }
  return `wss://egelsoftback.astriom.org/api/ws?token=${encodeURIComponent(token)}`;
}

export function getStoredToken(): string | null {
  return getSyncItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  setSyncItem(TOKEN_KEY, token);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const firstError =
      data?.errors && typeof data.errors === 'object'
        ? Object.values(data.errors).flat()[0]
        : null;
    throw new Error(
      (typeof firstError === 'string' && firstError) ||
        data?.message ||
        `Error HTTP ${res.status}`
    );
  }

  return data as T;
}

export const api = {
  register: (name: string, email: string, password: string, password_confirmation: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, password_confirmation }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ user: User }>('/auth/me'),

  updateProfile: (payload: {
    name: string;
    email: string;
    password?: string;
    password_confirmation?: string;
  }) =>
    request<{ user: User }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),

  getTemario: () => request<{ temario: Temario }>('/temario'),

  getPreguntas: (params: {
    area?: string;
    subarea?: string;
    banco?: string;
    limit?: number;
    ids?: string[];
    preset?: 'egel_completo' | 'practica_rapida';
    orden?: 'modular' | 'aleatorio';
    ocultarRespuestas?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params.preset) qs.set('preset', params.preset);
    if (params.orden) qs.set('orden', params.orden);
    if (params.area && params.area !== 'todas') qs.set('area', params.area);
    if (params.subarea && params.subarea !== 'todas') qs.set('subarea', params.subarea);
    if (params.banco && params.banco !== 'todos') qs.set('banco', params.banco);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.ids?.length) qs.set('ids', params.ids.join(','));
    if (params.ocultarRespuestas) qs.set('ocultar_respuestas', '1');
    const query = qs.toString();
    return request<{ preguntas: Pregunta[]; total: number }>(
      `/preguntas${query ? `?${query}` : ''}`
    );
  },

  getBiblioteca: (params?: {
    area?: string;
    tipo?: string;
    idioma?: string;
    q?: string;
    soloArchivo?: boolean;
    soloOficial?: boolean;
    soloGratuito?: boolean;
    orden?: 'prioridad' | 'anio_desc' | 'titulo';
  }) => {
    const qs = new URLSearchParams();
    if (params?.area && params.area !== 'todas') qs.set('area', params.area);
    if (params?.tipo && params.tipo !== 'todos') qs.set('tipo', params.tipo);
    if (params?.idioma && params.idioma !== 'todos') qs.set('idioma', params.idioma);
    if (params?.q) qs.set('q', params.q);
    if (params?.soloArchivo) qs.set('solo_archivo', '1');
    if (params?.soloOficial) qs.set('solo_oficial', '1');
    if (params?.soloGratuito) qs.set('solo_gratuito', '1');
    if (params?.orden) qs.set('orden', params.orden);
    const query = qs.toString();
    return request<{ recursos: Recurso[]; total: number; resumen?: BibliotecaResumen }>(
      `/biblioteca${query ? `?${query}` : ''}`
    );
  },

  getGuias: () => request<{ guias: Guia[] }>('/guias'),

  getComandos: () => request<{ ramas: RamaComandos[] }>('/comandos'),

  buscar: (q: string, tipo: 'todos' | 'guias' | 'preguntas' | 'comandos' | 'recursos' = 'todos') =>
    request<ResultadoBusqueda>(
      `/buscar?q=${encodeURIComponent(q)}&tipo=${encodeURIComponent(tipo)}`
    ),

  buscarWeb: (q: string, fuente: 'todos' | 'rapidas' | 'academicas' | WebFuenteId = 'todos') =>
    request<{ conceptos: ConceptoWeb[] }>(
      `/buscar-web?q=${encodeURIComponent(q)}&fuente=${encodeURIComponent(fuente)}`
    ),

  leerUrl: (url: string) =>
    request<{
      url: string;
      host: string;
      status: number;
      title: string;
      description: string;
      markdown?: string;
      is_readme?: boolean;
      blocks: Array<{ tag: string; text: string }>;
    }>(`/leer?url=${encodeURIComponent(url)}`),

  getIntentos: () =>
    request<{ intentos: Intento[]; estadisticas: EstadisticasUsuario }>('/intentos'),

  crearIntento: (payload: {
    modo: 'inmediato' | 'examen';
    area_filtro?: string | null;
    banco_filtro?: string | null;
    total_preguntas: number;
    pregunta_ids?: string[];
  }) =>
    request<{ intento: Intento }>('/intentos', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getIntento: (intentoId: number) =>
    request<{
      intento: Intento;
      preguntas: Pregunta[];
      respuestas: Array<{ pregunta_id: string; seleccionada: number; es_correcta: boolean | null }>;
    }>(`/intentos/${intentoId}`),

  guardarRespuesta: (intentoId: number, respuesta: RespuestaGuardada) =>
    request<{ intento: Intento }>(`/intentos/${intentoId}/respuestas`, {
      method: 'POST',
      body: JSON.stringify(respuesta),
    }),

  finalizarIntento: (intentoId: number, duracion_segundos?: number) =>
    request<{ intento: Intento; preguntas?: Pregunta[] }>(`/intentos/${intentoId}/finalizar`, {
      method: 'POST',
      body: JSON.stringify(
        duracion_segundos !== undefined ? { duracion_segundos } : {}
      ),
    }),

  eliminarIntento: (intentoId: number) =>
    request<{ message: string }>(`/intentos/${intentoId}`, {
      method: 'DELETE',
    }),

  getSubrayados: (ids?: string[]) =>
    request<{
      subrayados: Record<
        string,
        Record<string, Array<{ start: number; end: number; color: 'amber' | 'emerald' | 'rose' }>>
      >;
    }>(`/subrayados${ids?.length ? `?ids=${encodeURIComponent(ids.join(','))}` : ''}`),

  saveSubrayados: (
    preguntaId: string,
    subrayados: Record<string, Array<{ start: number; end: number; color: 'amber' | 'emerald' | 'rose' }>>
  ) =>
    request<{ pregunta_id: string }>(`/subrayados/${encodeURIComponent(preguntaId)}`, {
      method: 'PUT',
      body: JSON.stringify({ subrayados }),
    }),
};
