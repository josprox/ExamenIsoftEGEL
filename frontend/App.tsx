import './global.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowUp,
  BookOpen,
  Home,
  Library,
  LogIn,
  PlayCircle,
  Search,
  Settings,
  Terminal,
  User as UserIcon,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import {
  api,
  getStoredToken,
  getWebSocketUrl,
  setStoredToken,
  TOKEN_KEY,
} from './src/lib/api';
import { getLocalProgress, PROGRESS_STORAGE_KEY } from './src/lib/localProgress';
import { buildPath, parseLocation, type AppTab } from './src/lib/router';
import { hydrateStorage, isStorageHydrated } from './src/lib/storage';
import {
  applyThemePreference,
  getStoredTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from './src/lib/theme';
import type { EstadisticasUsuario, Intento, Temario, User } from './src/types/egel';
import { AuthModal } from './src/components/AuthModal';
import { Biblioteca } from './src/components/Biblioteca';
import { BrandLogo } from './src/components/BrandLogo';
import { Comandos } from './src/components/Comandos';
import { Guias } from './src/components/Guias';
import { Inicio } from './src/components/Inicio';
import { Perfil } from './src/components/Perfil';
import { SearchModal } from './src/components/SearchModal';
import { SettingsModal } from './src/components/SettingsModal';
import { Simulator } from './src/components/Simulator';

export default function App() {
  const [ready, setReady] = useState<boolean>(isStorageHydrated());
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [themePref, setThemePref] = useState<ThemePreference>(() => getStoredTheme());
  const initialRoute = parseLocation();

  const [tab, setTab] = useState<AppTab>(initialRoute.tab);
  const [user, setUser] = useState<User | null>(null);
  const [temario, setTemario] = useState<Temario | null>(null);
  const [intentos, setIntentos] = useState<Intento[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasUsuario | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [simArea, setSimArea] = useState<string>(initialRoute.area);
  const [simSubarea, setSimSubarea] = useState<string>(initialRoute.subarea);
  const [guiaClave, setGuiaClave] = useState<string | undefined>(initialRoute.guiaClave);
  const [resumeIntentoId, setResumeIntentoId] = useState<number | null>(null);
  const [bibliotecaMode, setBibliotecaMode] = useState<'catalogo' | 'web'>(
    initialRoute.bibliotecaMode
  );
  const [bibliotecaWebQuery, setBibliotecaWebQuery] = useState<string>(
    initialRoute.bibliotecaWebQuery
  );
  const [showScrollTop, setShowScrollTop] = useState(false);
  const reachBottomListenersRef = useRef<Set<() => void>>(new Set());
  const lastBottomTriggerRef = useRef(0);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const wsSearchListenersRef = useRef<
    Set<(msg: { type: string; request_id?: string; conceptos?: unknown[] }) => void>
  >(new Set());
  const [lastWsEvent, setLastWsEvent] = useState<{
    action: string;
    intento_id: number;
    pregunta_id?: string;
    seleccionada?: number;
    ts: number;
  } | null>(null);
  const [lastSubrayadoSync, setLastSubrayadoSync] = useState<{
    pregunta_id: string;
    subrayados: Record<string, Array<{ start: number; end: number; color: 'amber' | 'emerald' | 'rose' }>>;
    ts: number;
  } | null>(null);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);

  const sendWsSearch = useCallback((q: string, fuente: string, requestId: string) => {
    const sock = wsRef.current;
    if (!sock || sock.readyState !== 1) return false;
    sock.send(JSON.stringify({ type: 'buscar_web', q, fuente, request_id: requestId }));
    return true;
  }, []);

  const subscribeWsSearch = useCallback(
    (fn: (msg: { type: string; request_id?: string; conceptos?: unknown[] }) => void) => {
      wsSearchListenersRef.current.add(fn);
      return () => {
        wsSearchListenersRef.current.delete(fn);
      };
    },
    []
  );

  const subscribeReachBottom = useCallback((fn: () => void) => {
    reachBottomListenersRef.current.add(fn);
    return () => {
      reachBottomListenersRef.current.delete(fn);
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      hydrateStorage([TOKEN_KEY, PROGRESS_STORAGE_KEY, THEME_STORAGE_KEY]).then(() => {
        const pref = getStoredTheme();
        setThemePref(pref);
        applyThemePreference(pref);
        setReady(true);
      });
    } else {
      const pref = getStoredTheme();
      setThemePref(pref);
      applyThemePreference(pref);
    }
  }, [ready]);

  // Favicon SVG en <head> para Web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/svg+xml';
    link.href = '/favicon.svg';
  }, []);

  const handleSelectTheme = (pref: ThemePreference) => {
    setThemePref(pref);
    applyThemePreference(pref);
  };

  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      themePref !== 'system' ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = () => {
      applyThemePreference('system');
    };

    syncSystemTheme();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', syncSystemTheme);
      return () => mq.removeEventListener('change', syncSystemTheme);
    }
    mq.addListener(syncSystemTheme);
    return () => mq.removeListener(syncSystemTheme);
  }, [themePref]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const titles: Record<AppTab, string> = {
      inicio: 'EGEL Plus ISOFT 2026 — Simulador, Guías y Banco de Reactivos',
      simulador: 'Simulador de Examen — EGEL Plus ISOFT 2026',
      guias: 'Guías de Estudio — EGEL Plus ISOFT 2026',
      progreso: 'Mi Perfil y Progreso — EGEL Plus ISOFT 2026',
      biblioteca: 'Biblioteca de Recursos — EGEL Plus ISOFT 2026',
      comandos: 'Comandos Técnicos — EGEL Plus ISOFT 2026',
    };
    document.title = titles[tab];
  }, [tab]);

  const cargarProgreso = useCallback(async () => {
    if (getStoredToken()) {
      try {
        const res = await api.getIntentos();
        setIntentos(res.intentos);
        setEstadisticas(res.estadisticas);
        return;
      } catch {
        // fallback local
      }
    }
    const local = getLocalProgress();
    setIntentos(local.intentos);
    setEstadisticas(local.estadisticas);
  }, []);

  useEffect(() => {
    if (!ready) return;

    api
      .getTemario()
      .then((res) => setTemario(res.temario))
      .catch(() => setTemario(null));

    if (getStoredToken()) {
      api
        .me()
        .then((res) => {
          setUser(res.user);
          return cargarProgreso();
        })
        .catch(() => {
          setStoredToken(null);
          setUser(null);
          cargarProgreso();
        });
    } else {
      cargarProgreso();
    }
  }, [ready, cargarProgreso]);

  // WebSocket en tiempo real para sincronizar simulaciones entre PC y celular
  useEffect(() => {
    if (!ready || !user) return;
    const token = getStoredToken();
    if (!token) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closedByEffect = false;

    const connect = () => {
      if (closedByEffect) return;
      try {
        ws = new WebSocket(getWebSocketUrl(token));
        wsRef.current = ws;
        ws.onopen = () => {
          if (!closedByEffect) setWsConnected(true);
        };
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(String(event.data));
            if (msg?.type === 'intento_sync') {
              setLastWsEvent({
                action: String(msg.action ?? ''),
                intento_id: Number(msg.intento_id ?? 0),
                pregunta_id: msg.pregunta_id ? String(msg.pregunta_id) : undefined,
                seleccionada:
                  typeof msg.seleccionada === 'number' ? msg.seleccionada : undefined,
                ts: Date.now(),
              });
              void cargarProgreso();
            } else if (msg?.type === 'web_search_chunk' || msg?.type === 'web_search_done') {
              wsSearchListenersRef.current.forEach((fn) => fn(msg));
            } else if (msg?.type === 'subrayado_sync' && msg.pregunta_id) {
              setLastSubrayadoSync({
                pregunta_id: String(msg.pregunta_id),
                subrayados: msg.subrayados ?? {},
                ts: Date.now(),
              });
            }
          } catch {
            // ignore malformed ws payload
          }
        };
        ws.onclose = () => {
          if (wsRef.current === ws) wsRef.current = null;
          if (!closedByEffect) {
            setWsConnected(false);
            reconnectTimer = setTimeout(connect, 3000);
          }
        };
      } catch {
        if (!closedByEffect) {
          setWsConnected(false);
          reconnectTimer = setTimeout(connect, 5000);
        }
      }
    };

    connect();
    return () => {
      closedByEffect = true;
      setWsConnected(false);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
      wsRef.current = null;
    };
  }, [ready, user, cargarProgreso]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onPopState = () => {
      const next = parseLocation();
      setTab(next.tab);
      setSimArea(next.area);
      setSimSubarea(next.subarea);
      setGuiaClave(next.guiaClave);
      setBibliotecaMode(next.bibliotecaMode);
      setBibliotecaWebQuery(next.bibliotecaWebQuery);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleNavigate = (
    targetTab: AppTab,
    opts?: {
      area?: string;
      subarea?: string;
      guiaClave?: string;
      bibliotecaMode?: 'catalogo' | 'web';
      bibliotecaWebQuery?: string;
    }
  ) => {
    const nextArea = opts?.area ?? (targetTab === 'simulador' ? 'todas' : simArea);
    const nextSubarea = opts?.subarea ?? (targetTab === 'simulador' ? 'todas' : simSubarea);
    const nextGuia = opts?.guiaClave ?? (targetTab === 'guias' ? guiaClave : undefined);
    const nextBibMode =
      opts?.bibliotecaMode ?? (targetTab === 'biblioteca' ? bibliotecaMode : 'catalogo');
    const nextBibQuery =
      opts?.bibliotecaWebQuery ?? (targetTab === 'biblioteca' ? bibliotecaWebQuery : '');

    if (opts?.area) setSimArea(opts.area);
    else if (targetTab === 'simulador') setSimArea('todas');

    if (opts?.subarea) setSimSubarea(opts.subarea);
    else if (targetTab === 'simulador') setSimSubarea('todas');

    if (opts?.guiaClave) setGuiaClave(opts.guiaClave);
    if (opts?.bibliotecaMode) setBibliotecaMode(opts.bibliotecaMode);
    if (opts?.bibliotecaWebQuery !== undefined) setBibliotecaWebQuery(opts.bibliotecaWebQuery);

    setTab(targetTab);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const nextUrl = buildPath(targetTab, {
        area: nextArea,
        subarea: nextSubarea,
        guiaClave: nextGuia,
        bibliotecaMode: nextBibMode,
        bibliotecaWebQuery: nextBibQuery,
      });
      if (window.location.pathname + window.location.search !== nextUrl) {
        window.history.pushState(null, '', nextUrl);
      }
    }

    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleLoginSuccess = (loggedUser: User) => {
    setUser(loggedUser);
    cargarProgreso();
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setStoredToken(null);
    setUser(null);
    setIntentos([]);
    setEstadisticas(null);
  };

  const navItems: Array<{
    id: AppTab;
    label: string;
    renderIcon: (active: boolean) => React.ReactNode;
  }> = [
    {
      id: 'inicio',
      label: 'Inicio',
      renderIcon: (a) => <Home size={16} color={a ? (isDark ? '#2dd4bf' : '#0f766e') : (isDark ? '#94a3b8' : '#57534e')} />,
    },
    {
      id: 'simulador',
      label: 'Practicar',
      renderIcon: (a) => <PlayCircle size={16} color={a ? (isDark ? '#2dd4bf' : '#0f766e') : (isDark ? '#94a3b8' : '#57534e')} />,
    },
    {
      id: 'guias',
      label: 'Guías',
      renderIcon: (a) => <BookOpen size={16} color={a ? (isDark ? '#2dd4bf' : '#0f766e') : (isDark ? '#94a3b8' : '#57534e')} />,
    },
    {
      id: 'biblioteca',
      label: 'Biblioteca',
      renderIcon: (a) => <Library size={16} color={a ? (isDark ? '#2dd4bf' : '#0f766e') : (isDark ? '#94a3b8' : '#57534e')} />,
    },
    {
      id: 'comandos',
      label: 'Comandos',
      renderIcon: (a) => <Terminal size={16} color={a ? (isDark ? '#2dd4bf' : '#0f766e') : (isDark ? '#94a3b8' : '#57534e')} />,
    },
    {
      id: 'progreso',
      label: 'Perfil',
      renderIcon: (a) => <UserIcon size={16} color={a ? (isDark ? '#2dd4bf' : '#0f766e') : (isDark ? '#94a3b8' : '#57534e')} />,
    },
  ];

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View className="flex-1 items-center justify-center bg-stone-50 dark:bg-slate-950">
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView className="flex-1 bg-stone-100/70 dark:bg-slate-950" edges={['top', 'left', 'right']}>
        {/* Header compacto + pestañas */}
        <View className="border-b border-stone-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-xs">
          <View className="mx-auto w-full max-w-6xl px-4 py-2 flex-row items-center justify-between gap-3">
            <Pressable
              onPress={() => handleNavigate('inicio')}
              className="flex-row items-center gap-2.5"
            >
              <BrandLogo size={30} />
              <Text className="text-sm font-extrabold text-stone-900 dark:text-slate-100">
                EGEL Plus ISOFT
              </Text>
            </Pressable>

            {/* Acciones derecha compactas */}
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setSearchOpen(true)}
                className="flex-row items-center gap-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-2.5 py-1.5 active:bg-stone-100 dark:active:bg-slate-700"
              >
                <Search size={14} color={isDark ? '#2dd4bf' : '#0f766e'} />
                <Text className="text-xs font-semibold text-stone-700 dark:text-slate-200 hidden sm:flex">
                  Buscar
                </Text>
                {Platform.OS === 'web' && (
                  <View className="hidden sm:flex rounded-md border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-0.5">
                    <Text className="text-[10px] font-bold text-stone-500 dark:text-slate-400">
                      Ctrl K
                    </Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                onPress={() => setSettingsOpen(true)}
                className="flex-row items-center gap-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 p-2 active:bg-stone-100 dark:active:bg-slate-700"
              >
                <Settings size={15} color={isDark ? '#cbd5e1' : '#57534e'} />
              </Pressable>

              {user ? (
                <Pressable
                  onPress={() => handleNavigate('progreso')}
                  className="flex-row items-center gap-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/70 px-3 py-1.5 border border-teal-700/15 dark:border-teal-500/25 active:bg-teal-100"
                >
                  <UserIcon size={14} color={isDark ? '#2dd4bf' : '#0f766e'} />
                  <Text className="text-xs font-semibold text-teal-900 dark:text-teal-200 hidden sm:flex">
                    {user.name}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setAuthOpen(true)}
                  className="flex-row items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-1.5 active:bg-teal-800"
                >
                  <LogIn size={14} color="#ffffff" />
                  <Text className="text-xs font-semibold text-white">Entrar</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Barra de pestañas desktop/tablet */}
          <View className="hidden md:flex border-t border-stone-100 dark:border-slate-800/80">
            <View className="mx-auto w-full max-w-6xl px-4 flex-row items-center gap-1">
              {navItems.map((item) => {
                const active = tab === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handleNavigate(item.id)}
                    className={`flex-row items-center gap-1.5 px-3.5 py-2 border-b-2 ${
                      active
                        ? 'border-teal-600'
                        : 'border-transparent active:bg-stone-50 dark:active:bg-slate-800/50'
                    }`}
                  >
                    {item.renderIcon(active)}
                    <Text
                      className={`text-xs font-semibold ${
                        active
                          ? 'text-teal-800 dark:text-teal-300'
                          : 'text-stone-600 dark:text-slate-400'
                      }`}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Contenido principal */}
        <ScrollView
          ref={scrollRef}
          onScroll={(e) => {
            const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
            setShowScrollTop(contentOffset.y > 320);
            if (
              contentSize.height > 0 &&
              contentOffset.y + layoutMeasurement.height >= contentSize.height - 380
            ) {
              const now = Date.now();
              if (now - lastBottomTriggerRef.current > 250) {
                lastBottomTriggerRef.current = now;
                reachBottomListenersRef.current.forEach((fn) => fn());
              }
            }
          }}
          scrollEventThrottle={100}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
        >
          <View className="mx-auto w-full max-w-6xl px-4 py-6">
            {tab === 'inicio' && <Inicio temario={temario} onNavigate={handleNavigate} />}

            {tab === 'simulador' && (
              <Simulator
                temario={temario}
                user={user}
                intentos={intentos}
                lastWsEvent={lastWsEvent}
                lastSubrayadoSync={lastSubrayadoSync}
                erroresRecientes={estadisticas?.errores_recientes ?? []}
                initialArea={simArea}
                initialSubarea={simSubarea}
                resumeIntentoId={resumeIntentoId}
                onResumeHandled={() => setResumeIntentoId(null)}
                onOpenGuia={(clave) => handleNavigate('guias', { guiaClave: clave })}
                onOpenAuth={() => setAuthOpen(true)}
                onAttemptFinished={cargarProgreso}
              />
            )}

            {tab === 'guias' && (
              <Guias
                initialClave={guiaClave}
                onSelectClave={(clave) => handleNavigate('guias', { guiaClave: clave })}
                onPracticeSubarea={(sub) =>
                  handleNavigate('simulador', { area: 'todas', subarea: sub })
                }
              />
            )}

            {tab === 'progreso' && (
              <Perfil
                user={user}
                wsConnected={wsConnected}
                intentos={intentos}
                estadisticas={estadisticas}
                onUserUpdated={(updatedUser) => setUser(updatedUser)}
                onOpenAuth={() => setAuthOpen(true)}
                onOpenSettings={() => setSettingsOpen(true)}
                onLogout={handleLogout}
                onAttemptDeleted={cargarProgreso}
                onResumeAttempt={(id) => {
                  setResumeIntentoId(id);
                  handleNavigate('simulador');
                }}
              />
            )}

            {tab === 'biblioteca' && (
              <Biblioteca
                temario={temario}
                initialMode={bibliotecaMode}
                initialWebQuery={bibliotecaWebQuery}
                wsConnected={wsConnected}
                onSubscribeReachBottom={subscribeReachBottom}
                onSendWsSearch={sendWsSearch}
                onSubscribeWsSearch={subscribeWsSearch}
                onModeChange={(mode, query) =>
                  handleNavigate('biblioteca', {
                    bibliotecaMode: mode,
                    bibliotecaWebQuery: query ?? '',
                  })
                }
              />
            )}

            {tab === 'comandos' && <Comandos />}
          </View>

          {/* Footer en desktop/web */}
          <View className="hidden md:flex mt-auto border-t border-stone-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 py-4">
            <View className="mx-auto w-full max-w-6xl flex-row items-center justify-between gap-4">
              <Text className="text-xs text-stone-500 dark:text-slate-400">
                <Text className="font-bold text-stone-700 dark:text-slate-200">EGEL Plus ISOFT</Text> — Plataforma abierta de preparación para Ingeniería de Software.
              </Text>
              <View className="flex-row items-center gap-4">
                {navItems.map((item) => (
                  <Pressable key={`ft-${item.id}`} onPress={() => handleNavigate(item.id)}>
                    <Text className="text-xs font-medium text-stone-500 dark:text-slate-400 active:text-teal-700">
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Botón volver arriba */}
        {showScrollTop && (
          <Pressable
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
            className="absolute bottom-20 md:bottom-6 right-5 h-11 w-11 rounded-full bg-teal-700 items-center justify-center shadow-lg active:bg-teal-800"
          >
            <ArrowUp size={18} color="#ffffff" />
          </Pressable>
        )}

        {/* Barra inferior nativa en móvil (Android / pantallas pequeñas) */}
        <SafeAreaView edges={['bottom']} className="md:hidden border-t border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <View className="flex-row items-center justify-around py-1.5 px-1">
            {navItems.map((item) => {
              const active = tab === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => handleNavigate(item.id)}
                  className={`items-center justify-center rounded-xl px-2 py-1.5 ${
                    active ? 'bg-teal-50 dark:bg-teal-950/70' : ''
                  }`}
                >
                  {item.renderIcon(active)}
                  <Text
                    className={`mt-0.5 text-[10px] font-semibold ${
                      active ? 'text-teal-800 dark:text-teal-300' : 'text-stone-500 dark:text-slate-400'
                    }`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>

        <AuthModal
          isOpen={authOpen}
          onClose={() => setAuthOpen(false)}
          onSuccess={handleLoginSuccess}
        />

        <SearchModal
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          onNavigate={(t, opts) => handleNavigate(t, opts)}
          onOpenWebPortal={(q) =>
            handleNavigate('biblioteca', {
              bibliotecaMode: 'web',
              bibliotecaWebQuery: q,
            })
          }
        />

        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          themePref={themePref}
          onSelectTheme={handleSelectTheme}
          user={user}
          wsConnected={wsConnected}
          onOpenProfile={() => handleNavigate('progreso')}
          onOpenAuth={() => setAuthOpen(true)}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
