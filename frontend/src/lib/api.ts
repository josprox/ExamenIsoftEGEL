import type {
  AuthResponse,
  BibliotecaResumen,
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
} from '../types/egel';

const TOKEN_KEY = 'egel_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
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

  const res = await fetch(`/api${path}`, {
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
  // Auth
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

  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),

  // Catálogos y preguntas
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

  // Intentos y progreso (requiere login)
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
};
