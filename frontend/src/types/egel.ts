export interface User {
  id: number;
  name: string;
  email: string;
  created_at?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Opcion {
  texto: string;
  explicacion: string;
}

export interface Fuente {
  recurso: string;
  detalle?: string;
}

export interface Pregunta {
  id: string;
  area: string;
  subarea: string;
  banco: string;
  formato: 'cuestionamiento-directo' | 'completamiento' | 'ordenamiento' | 'multirreactivo';
  nivel?: 'satisfactorio' | 'sobresaliente';
  estimulo?: string | null;
  base?: string | null;
  lista?: string[] | null;
  codigo?: string | null;
  pregunta: string;
  opciones: Opcion[];
  correcta?: number;
  estrategia?: string | null;
  trampa?: string | null;
  conceptos?: string[];
  fuentes?: Fuente[];
}

export interface Subarea {
  id: string;
  nombre: string;
  reactivos: number;
}

export interface Area {
  id: string;
  nombre: string;
  reactivos: number;
  subareas: Subarea[];
}

export interface Seccion {
  id: string;
  nombre: string;
  reactivos: number;
  areas: Area[];
}

export interface Temario {
  id: string;
  nombre: string;
  secciones: Seccion[];
}

export interface Recurso {
  id: string;
  titulo: string;
  autores?: string;
  anio?: number;
  tipo: string;
  areas: string[];
  subareas?: string[];
  oficial?: boolean;
  archivo?: string | null;
  url?: string | null;
  prioridad?: number;
  nota?: string | null;
  gratuito?: boolean;
  idioma?: string;
}

export interface RespuestaGuardada {
  pregunta_id: string;
  seleccionada: number;
}

export interface Intento {
  id: number;
  modo: 'inmediato' | 'examen';
  area_filtro: string | null;
  banco_filtro: string | null;
  pregunta_ids?: string[] | null;
  total_preguntas: number;
  aciertos: number;
  errores: number;
  porcentaje: number;
  duracion_segundos?: number;
  completado: boolean;
  created_at: string;
  respuestas?: RespuestaGuardada[];
}

export interface EstadisticasUsuario {
  total_intentos: number;
  total_respuestas: number;
  total_aciertos: number;
  precision_global: number;
  por_area: Record<string, { total: number; aciertos: number; porcentaje: number }>;
  por_subarea?: Record<string, { total: number; aciertos: number; porcentaje: number }>;
  errores_recientes: string[];
}

export interface Guia {
  clave: string;
  titulo: string;
  contenido: string;
  snippet?: string;
}

export interface BibliotecaResumen {
  total_catalogo: number;
  con_archivo: number;
  oficiales: number;
  gratuitos: number;
  por_tipo: Record<string, number>;
}

export interface ComandoItem {
  comando: string;
  descripcion: string;
}

export interface RamaComandos {
  id: string;
  nombre: string;
  icono: string;
  subareas?: string[];
  descripcion: string;
  comandos: ComandoItem[];
}

export type WebFuenteId =
  | 'wikipedia'
  | 'mdn'
  | 'stackoverflow'
  | 'openlibrary'
  | 'openalex'
  | 'crossref'
  | 'arxiv'
  | 'github';

export interface ConceptoWeb {
  title: string;
  extract: string;
  url: string;
  source: string;
  category?: WebFuenteId;
}

export interface ResultadoBusqueda {
  guias: Guia[];
  comandos: Array<{ rama: string; icono: string; comando: string; descripcion: string }>;
  preguntas: Pregunta[];
  recursos: Recurso[];
  total?: number;
}

