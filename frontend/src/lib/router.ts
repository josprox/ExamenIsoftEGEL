import { Platform } from 'react-native';

export type AppTab =
  | 'inicio'
  | 'simulador'
  | 'guias'
  | 'biblioteca'
  | 'comandos'
  | 'progreso';

export interface RouteState {
  tab: AppTab;
  area: string;
  subarea: string;
  guiaClave?: string;
  bibliotecaMode: 'catalogo' | 'web';
  bibliotecaWebQuery: string;
}

const DEFAULT_ROUTE: RouteState = {
  tab: 'inicio',
  area: 'todas',
  subarea: 'todas',
  bibliotecaMode: 'catalogo',
  bibliotecaWebQuery: '',
};

export function parseLocation(): RouteState {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return DEFAULT_ROUTE;
  }

  const rawPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const parts = rawPath.split('/').filter(Boolean);
  const qs = new URLSearchParams(window.location.search);

  const first = (parts[0] ?? '').toLowerCase();

  if (first === 'practicar' || first === 'simulador') {
    const seg = parts[1] ? decodeURIComponent(parts[1]) : '';
    const areaParam = qs.get('area');
    const subareaParam = qs.get('subarea');
    let area = areaParam || 'todas';
    let subarea = subareaParam || 'todas';
    if (seg && !areaParam && !subareaParam) {
      if (/^(A[1-4]|L[12])$/i.test(seg)) {
        area = seg.toUpperCase();
      } else {
        subarea = seg;
      }
    }
    return {
      tab: 'simulador',
      area,
      subarea,
      bibliotecaMode: 'catalogo',
      bibliotecaWebQuery: '',
    };
  }

  if (first === 'guias') {
    const clave = parts[1] ? decodeURIComponent(parts[1]) : undefined;
    return {
      tab: 'guias',
      area: 'todas',
      subarea: 'todas',
      guiaClave: clave,
      bibliotecaMode: 'catalogo',
      bibliotecaWebQuery: '',
    };
  }

  if (first === 'progreso') {
    return {
      tab: 'progreso',
      area: 'todas',
      subarea: 'todas',
      bibliotecaMode: 'catalogo',
      bibliotecaWebQuery: '',
    };
  }

  if (first === 'biblioteca') {
    const second = (parts[1] ?? '').toLowerCase();
    const isWeb = second === 'explorar' || qs.get('modo') === 'web';
    return {
      tab: 'biblioteca',
      area: 'todas',
      subarea: 'todas',
      bibliotecaMode: isWeb ? 'web' : 'catalogo',
      bibliotecaWebQuery: qs.get('q') ?? '',
    };
  }

  if (first === 'comandos') {
    return {
      tab: 'comandos',
      area: 'todas',
      subarea: 'todas',
      bibliotecaMode: 'catalogo',
      bibliotecaWebQuery: '',
    };
  }

  return DEFAULT_ROUTE;
}

export function buildPath(
  tab: AppTab,
  opts?: {
    area?: string;
    subarea?: string;
    guiaClave?: string;
    bibliotecaMode?: 'catalogo' | 'web';
    bibliotecaWebQuery?: string;
  }
): string {
  switch (tab) {
    case 'inicio':
      return '/';
    case 'simulador': {
      const params = new URLSearchParams();
      if (opts?.area && opts.area !== 'todas') params.set('area', opts.area);
      if (opts?.subarea && opts.subarea !== 'todas') params.set('subarea', opts.subarea);
      const query = params.toString();
      return `/practicar${query ? `?${query}` : ''}`;
    }
    case 'guias':
      return opts?.guiaClave ? `/guias/${encodeURIComponent(opts.guiaClave)}` : '/guias';
    case 'progreso':
      return '/progreso';
    case 'biblioteca': {
      if (opts?.bibliotecaMode === 'web') {
        const q = opts.bibliotecaWebQuery?.trim();
        return `/biblioteca/explorar${q ? `?q=${encodeURIComponent(q)}` : ''}`;
      }
      return '/biblioteca';
    }
    case 'comandos':
      return '/comandos';
  }
}
