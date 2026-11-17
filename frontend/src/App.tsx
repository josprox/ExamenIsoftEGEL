import { useEffect, useState, useCallback } from 'react';
import {
  GraduationCap,
  Home,
  PlayCircle,
  BookOpen,
  Library,
  BarChart3,
  Search,
  LogIn,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { api, getStoredToken, setStoredToken } from './lib/api';
import { getLocalProgress } from './lib/localProgress';
import type { EstadisticasUsuario, Intento, Temario, User } from './types/egel';
import { AuthModal } from './components/AuthModal';
import { SearchModal } from './components/SearchModal';
import { Inicio } from './components/Inicio';
import { Simulator } from './components/Simulator';
import { Guias } from './components/Guias';
import { Biblioteca } from './components/Biblioteca';
import { Comandos } from './components/Comandos';
import { Progreso } from './components/Progreso';

type Tab = 'inicio' | 'simulador' | 'guias' | 'biblioteca' | 'comandos' | 'progreso';

export function App() {
  const [tab, setTab] = useState<Tab>('inicio');
  const [user, setUser] = useState<User | null>(null);
  const [temario, setTemario] = useState<Temario | null>(null);
  const [intentos, setIntentos] = useState<Intento[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasUsuario | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const [simArea, setSimArea] = useState<string>('todas');
  const [simSubarea, setSimSubarea] = useState<string>('todas');
  const [guiaClave, setGuiaClave] = useState<string | undefined>(undefined);

  const cargarProgreso = useCallback(async () => {
    if (getStoredToken()) {
      try {
        const res = await api.getIntentos();
        setIntentos(res.intentos);
        setEstadisticas(res.estadisticas);
        return;
      } catch {
        // fallback a local
      }
    }
    const local = getLocalProgress();
    setIntentos(local.intentos);
    setEstadisticas(local.estadisticas);
  }, []);

  useEffect(() => {
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
  }, [cargarProgreso]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleNavigate = (
    targetTab: Tab,
    opts?: { area?: string; subarea?: string; guiaClave?: string }
  ) => {
    if (opts?.area) setSimArea(opts.area);
    else if (targetTab === 'simulador') setSimArea('todas');

    if (opts?.subarea) setSimSubarea(opts.subarea);
    else if (targetTab === 'simulador') setSimSubarea('todas');

    if (opts?.guiaClave) setGuiaClave(opts.guiaClave);
    setTab(targetTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const navItems: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'inicio', label: 'Inicio', icon: <Home className="h-4 w-4" /> },
    { id: 'simulador', label: 'Practicar', icon: <PlayCircle className="h-4 w-4" /> },
    { id: 'guias', label: 'Guías', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'progreso', label: 'Progreso', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'biblioteca', label: 'Biblioteca', icon: <Library className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          <button
            type="button"
            onClick={() => handleNavigate('inicio')}
            className="flex items-center gap-2.5 text-left cursor-pointer"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold text-stone-900 leading-tight">
                EGEL Plus ISOFT
              </div>
              <div className="text-[11px] text-stone-500">
                Portal de Estudio 2026
              </div>
            </div>
          </button>

          <nav className="flex items-center gap-1 rounded-xl bg-stone-100 p-1 overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                onClick={() => handleNavigate(item.id)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition cursor-pointer shrink-0 ${
                  tab === item.id
                    ? 'bg-white text-teal-800 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {item.icon}
                <span className="hidden md:inline">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              title="Buscar en todo el portal (Ctrl+K)"
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Buscar</span>
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                <span className="hidden xl:inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-800">
                  <UserIcon className="h-3.5 w-3.5 text-teal-700" />
                  {user.name}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Cerrar sesión"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 transition cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Entrar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8">
        {tab === 'inicio' && (
          <Inicio temario={temario} onNavigate={handleNavigate} />
        )}
        {tab === 'simulador' && (
          <Simulator
            temario={temario}
            user={user}
            erroresRecientes={estadisticas?.errores_recientes ?? []}
            initialArea={simArea}
            initialSubarea={simSubarea}
            onOpenGuia={(clave) => handleNavigate('guias', { guiaClave: clave })}
            onAttemptFinished={cargarProgreso}
          />
        )}
        {tab === 'guias' && (
          <Guias
            initialClave={guiaClave}
            onPracticeSubarea={(sub) =>
              handleNavigate('simulador', { subarea: sub })
            }
          />
        )}
        {tab === 'biblioteca' && <Biblioteca temario={temario} />}
        {tab === 'comandos' && <Comandos />}
        {tab === 'progreso' && (
          <Progreso
            user={user}
            intentos={intentos}
            estadisticas={estadisticas}
            onOpenAuth={() => setAuthOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 py-6 text-xs text-stone-500">
          <div>
            <strong className="text-stone-800">EGEL Plus ISOFT</strong> — Plataforma abierta de preparación para Ingeniería de Software.
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => handleNavigate('inicio')}
              className="hover:text-teal-700 cursor-pointer"
            >
              Inicio
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('simulador')}
              className="hover:text-teal-700 cursor-pointer"
            >
              Simulador
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('guias')}
              className="hover:text-teal-700 cursor-pointer"
            >
              Guías
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('biblioteca')}
              className="hover:text-teal-700 cursor-pointer"
            >
              Biblioteca
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('comandos')}
              className="hover:text-teal-700 cursor-pointer"
            >
              Comandos
            </button>
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={handleNavigate}
      />
    </div>
  );
}

export default App;
