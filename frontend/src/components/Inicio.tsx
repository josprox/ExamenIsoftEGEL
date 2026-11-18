import { useRef, useState } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Code2,
  Compass,
  ExternalLink,
  GitBranch,
  Globe,
  Highlighter,
  Layers,
  Library,
  Package,
  Play,
  Rocket,
  Server,
  ShieldCheck,
  Sparkles,
  Target,
  Terminal,
} from 'lucide-react-native';
import { resolveBackendUrl } from '../lib/api';
import type { AppTab } from '../lib/router';
import type { Temario } from '../types/egel';
import { BrandLogo } from './BrandLogo';

interface InicioProps {
  temario: Temario | null;
  onNavigate: (
    tab: AppTab,
    opts?: { area?: string; subarea?: string; guiaClave?: string }
  ) => void;
}

interface EcosystemCard {
  id: string;
  badge: string;
  title: string;
  description: string;
  cta: string;
  url: string;
  accentCls: string;
  badgeCls: string;
  badgeTextCls: string;
  iconBgCls: string;
  iconColor: string;
  Icon: typeof GitBranch;
}

const ECOSYSTEM_CARDS: EcosystemCard[] = [
  {
    id: 'github-egel',
    badge: 'Open Source · Invitación',
    title: 'ExamenIsoftEGEL en GitHub',
    description:
      'Te invitamos a visitar el repositorio oficial, dejar una estrella, reportar mejoras o contribuir con reactivos y guías.',
    cta: 'Ver repositorio',
    url: 'https://github.com/josprox/ExamenIsoftEGEL',
    accentCls: 'bg-teal-600',
    badgeCls: 'bg-teal-50 dark:bg-teal-950/70',
    badgeTextCls: 'text-teal-700 dark:text-teal-300',
    iconBgCls: 'bg-teal-50 dark:bg-teal-950/60',
    iconColor: '#0f766e',
    Icon: GitBranch,
  },
  {
    id: 'astriom-home',
    badge: 'Web Principal',
    title: 'Astriom Systems',
    description:
      'Organización tecnológica independiente: software, productos e infraestructura diseñados para sistemas que deben perdurar.',
    cta: 'Visitar astriom.org',
    url: 'https://astriom.org',
    accentCls: 'bg-sky-600',
    badgeCls: 'bg-sky-50 dark:bg-sky-950/70',
    badgeTextCls: 'text-sky-700 dark:text-sky-300',
    iconBgCls: 'bg-sky-50 dark:bg-sky-950/60',
    iconColor: '#0284c7',
    Icon: Globe,
  },
  {
    id: 'joss-lang',
    badge: 'Lenguaje + Runtime Go',
    title: 'Lenguaje Joss',
    description:
      'Lenguaje de programación y plataforma backend con runtime en Go, CLI, ORM, WebSockets, autenticación y despliegue.',
    cta: 'Explorar Joss',
    url: 'https://astriom.org/lenguaje',
    accentCls: 'bg-indigo-600',
    badgeCls: 'bg-indigo-50 dark:bg-indigo-950/70',
    badgeTextCls: 'text-indigo-700 dark:text-indigo-300',
    iconBgCls: 'bg-indigo-50 dark:bg-indigo-950/60',
    iconColor: '#4f46e5',
    Icon: Code2,
  },
  {
    id: 'astriom-pub',
    badge: 'Developer Tools',
    title: 'Astriom Pub',
    description:
      'Registro y distribución de paquetes reutilizables y versionados para ampliar aplicaciones construidas en Joss.',
    cta: 'Abrir registro',
    url: 'https://astriom.org/pub',
    accentCls: 'bg-emerald-600',
    badgeCls: 'bg-emerald-50 dark:bg-emerald-950/70',
    badgeTextCls: 'text-emerald-700 dark:text-emerald-300',
    iconBgCls: 'bg-emerald-50 dark:bg-emerald-950/60',
    iconColor: '#059669',
    Icon: Package,
  },
  {
    id: 'requiem',
    badge: 'Infraestructura',
    title: 'Requiem Bare-Metal',
    description:
      'Suite de despliegue bare-metal para instalar y recuperar sistemas Windows desde entornos Linux autónomos.',
    cta: 'Ver en GitHub',
    url: 'https://github.com/josprox/Requiem',
    accentCls: 'bg-amber-600',
    badgeCls: 'bg-amber-50 dark:bg-amber-950/70',
    badgeTextCls: 'text-amber-700 dark:text-amber-300',
    iconBgCls: 'bg-amber-50 dark:bg-amber-950/60',
    iconColor: '#d97706',
    Icon: Server,
  },
  {
    id: 'astriom-docs',
    badge: 'Documentación y Blog',
    title: 'Docs y Blog Astriom',
    description:
      'Documentación técnica de Joss, guías de desarrollo y artículos de ingeniería publicados por Astriom.',
    cta: 'Leer docs',
    url: 'https://astriom.org/docs',
    accentCls: 'bg-violet-600',
    badgeCls: 'bg-violet-50 dark:bg-violet-950/70',
    badgeTextCls: 'text-violet-700 dark:text-violet-300',
    iconBgCls: 'bg-violet-50 dark:bg-violet-950/60',
    iconColor: '#7c3aed',
    Icon: BookOpen,
  },
  {
    id: 'astriom-shop',
    badge: 'Apps y Utilidades',
    title: 'Apps',
    description:
      'Joss Authenticator, Estrella Music, HTML to PDF y herramientas especializadas para escritorio y móvil.',
    cta: 'Explorar productos',
    url: 'https://github.com/josprox',
    accentCls: 'bg-rose-600',
    badgeCls: 'bg-rose-50 dark:bg-rose-950/70',
    badgeTextCls: 'text-rose-700 dark:text-rose-300',
    iconBgCls: 'bg-rose-50 dark:bg-rose-950/60',
    iconColor: '#e11d48',
    Icon: Rocket,
  },
];

export function Inicio({ temario, onNavigate }: InicioProps) {
  const sliderRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);
  const [sliderX, setSliderX] = useState(0);

  const slideBy = (delta: number) => {
    const nextX = Math.max(0, sliderX + delta);
    setSliderX(nextX);
    sliderRef.current?.scrollTo({ x: nextX, animated: true });
  };

  return (
    <View className="mx-auto w-full max-w-6xl gap-7">
      {/* Hero profesional */}
      <View className="overflow-hidden rounded-3xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <View className="h-1.5 w-full bg-teal-600" />
        <View className="p-5 sm:p-9">
          <View className="flex-col lg:flex-row lg:items-center gap-8">
            <View className="flex-1">
              <View className="flex-row flex-wrap items-center gap-2">
                <View className="flex-row items-center gap-1.5 rounded-full border border-teal-700/20 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-950/70 px-3 py-1">
                  <Sparkles size={13} color="#f59e0b" />
                  <Text className="text-[11px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                    Guía del sustentante · Julio 2026
                  </Text>
                </View>
                <View className="flex-row items-center gap-1 rounded-full bg-stone-100 dark:bg-slate-800 px-2.5 py-1">
                  <ShieldCheck size={12} color="#0f766e" />
                  <Text className="text-[11px] font-semibold text-stone-600 dark:text-slate-300">
                    Alineado a Ceneval ISOFT
                  </Text>
                </View>
              </View>

              <Text className="mt-4 text-3xl sm:text-5xl font-extrabold tracking-tight text-stone-900 dark:text-slate-100 leading-tight">
                Domina el examen{' '}
                <Text className="text-teal-700 dark:text-teal-400">EGEL Plus ISOFT</Text>
              </Text>

              <Text className="mt-3.5 text-sm sm:text-base leading-relaxed text-stone-600 dark:text-slate-300 max-w-2xl">
                Plataforma integral de preparación con simulador oficial de 203 reactivos,{' '}
                <Text className="font-bold text-stone-800 dark:text-slate-100">
                  subrayado estratégico DCPDV
                </Text>
                , guías técnicas (ISO 25010, 9001, 27000) y buscador conectado a 12 fuentes abiertas.
              </Text>

              <View className="mt-6 flex-row flex-wrap items-center gap-2.5">
                <Pressable
                  onPress={() => onNavigate('simulador')}
                  className="flex-row items-center gap-2 rounded-xl bg-teal-700 px-5 py-3.5 active:bg-teal-800 shadow-sm"
                >
                  <Play size={16} color="#ffffff" />
                  <Text className="text-sm font-bold text-white">Comenzar práctica</Text>
                </Pressable>

                <Pressable
                  onPress={() => onNavigate('progreso')}
                  className="flex-row items-center gap-2 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3.5 active:bg-stone-50 dark:active:bg-slate-700"
                >
                  <Target size={16} color="#0d9488" />
                  <Text className="text-sm font-semibold text-stone-800 dark:text-slate-100">
                    Ver mi avance
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => onNavigate('guias', { guiaClave: 'estrategias' })}
                  className="flex-row items-center gap-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800/70 px-4 py-3.5 active:bg-stone-100 dark:active:bg-slate-700"
                >
                  <BookOpen size={16} color="#d97706" />
                  <Text className="text-sm font-semibold text-stone-700 dark:text-slate-200">
                    Método DCPDV
                  </Text>
                </Pressable>
              </View>

              <View className="mt-5 flex-row flex-wrap items-center gap-4 pt-4 border-t border-stone-100 dark:border-slate-800">
                <View className="flex-row items-center gap-1.5">
                  <CheckCircle2 size={14} color="#059669" />
                  <Text className="text-xs font-medium text-stone-600 dark:text-slate-400">
                    Modo Estudio y Examen Real
                  </Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <CheckCircle2 size={14} color="#059669" />
                  <Text className="text-xs font-medium text-stone-600 dark:text-slate-400">
                    Diagnóstico por área y subárea
                  </Text>
                </View>
                {Platform.OS === 'web' && (
                  <View className="flex-row items-center gap-1.5">
                    <Compass size={14} color="#0d9488" />
                    <Text className="text-xs font-medium text-stone-600 dark:text-slate-400">
                      Atajo rápido:{' '}
                      <Text className="font-bold text-stone-800 dark:text-slate-200">Ctrl + K</Text>
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Tarjeta derecha de portada / resumen */}
            <View className="w-full lg:w-[340px] rounded-2xl border border-teal-900/15 dark:border-slate-800 bg-stone-50 dark:bg-slate-800/60 p-3.5 gap-3">
              {Platform.OS === 'web' ? (
                <Image
                  source={{ uri: resolveBackendUrl('/og-cover.svg') }}
                  className="w-full h-44 rounded-xl border border-stone-200 dark:border-slate-700"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full rounded-xl bg-teal-800 p-5 items-center justify-center gap-2">
                  <BrandLogo size={54} />
                  <Text className="text-base font-extrabold text-white text-center">
                    EGEL Plus ISOFT 2026
                  </Text>
                  <Text className="text-xs text-teal-100 text-center">
                    Simulador oficial · Guías · 12 fuentes web
                  </Text>
                </View>
              )}

              <View className="flex-row flex-wrap justify-between gap-2 px-1">
                <View className="flex-1 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 p-2.5 items-center">
                  <Text className="text-base font-extrabold text-teal-800 dark:text-teal-400">382</Text>
                  <Text className="text-[10px] font-semibold text-stone-500 dark:text-slate-400">
                    Reactivos
                  </Text>
                </View>
                <View className="flex-1 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 p-2.5 items-center">
                  <Text className="text-base font-extrabold text-amber-700 dark:text-amber-400">19</Text>
                  <Text className="text-[10px] font-semibold text-stone-500 dark:text-slate-400">
                    Subáreas
                  </Text>
                </View>
                <View className="flex-1 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 p-2.5 items-center">
                  <Text className="text-base font-extrabold text-sky-700 dark:text-sky-400">140</Text>
                  <Text className="text-[10px] font-semibold text-stone-500 dark:text-slate-400">
                    Recursos
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Accesos rápidos del portal (Bento Grid) */}
      <View className="gap-3">
        <Text className="text-xs font-bold uppercase tracking-widest text-teal-700 dark:text-teal-400">
          Herramientas del portal
        </Text>
        <View className="flex-row flex-wrap gap-3">
          <Pressable
            onPress={() => onNavigate('simulador')}
            className="min-w-[220px] flex-1 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs active:border-teal-600"
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="h-10 w-10 rounded-xl bg-teal-50 dark:bg-teal-950/70 items-center justify-center">
                <Layers size={20} color="#0d9488" />
              </View>
              <ArrowRight size={16} color="#94a3b8" />
            </View>
            <Text className="text-sm font-bold text-stone-900 dark:text-slate-100">
              Simulador EGEL
            </Text>
            <Text className="mt-1 text-xs text-stone-600 dark:text-slate-400 leading-relaxed">
              Práctica rápida, por subárea o examen completo de 203 reactivos.
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onNavigate('guias')}
            className="min-w-[220px] flex-1 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs active:border-teal-600"
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 items-center justify-center">
                <BookOpen size={20} color="#d97706" />
              </View>
              <ArrowRight size={16} color="#94a3b8" />
            </View>
            <Text className="text-sm font-bold text-stone-900 dark:text-slate-100">
              Guías y Normas ISO
            </Text>
            <Text className="mt-1 text-xs text-stone-600 dark:text-slate-400 leading-relaxed">
              Resúmenes por subárea, ISO 25010, 9001, 27000 y método DCPDV.
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onNavigate('biblioteca')}
            className="min-w-[220px] flex-1 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs active:border-teal-600"
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="h-10 w-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 items-center justify-center">
                <Globe size={20} color="#0284c7" />
              </View>
              <ArrowRight size={16} color="#94a3b8" />
            </View>
            <Text className="text-sm font-bold text-stone-900 dark:text-slate-100">
              Biblioteca + 12 Fuentes
            </Text>
            <Text className="mt-1 text-xs text-stone-600 dark:text-slate-400 leading-relaxed">
              140 recursos locales + Wikipedia, MDN, GitHub, arXiv, Reddit y más.
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onNavigate('comandos')}
            className="min-w-[220px] flex-1 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs active:border-teal-600"
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="h-10 w-10 rounded-xl bg-stone-100 dark:bg-slate-800 items-center justify-center">
                <Terminal size={20} color="#64748b" />
              </View>
              <ArrowRight size={16} color="#94a3b8" />
            </View>
            <Text className="text-sm font-bold text-stone-900 dark:text-slate-100">
              130 Comandos Técnicos
            </Text>
            <Text className="mt-1 text-xs text-stone-600 dark:text-slate-400 leading-relaxed">
              Chuletario listo para copiar de SQL, Git, Docker, Linux y HTTP.
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Estructura oficial del examen */}
      <View className="flex-row flex-wrap gap-3">
        <View className="min-w-[165px] flex-1 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <View className="flex-row items-center gap-2">
            <View className="h-8 w-8 rounded-lg bg-teal-50 dark:bg-teal-950/70 items-center justify-center">
              <Library size={16} color="#0d9488" />
            </View>
            <Text className="text-2xl font-extrabold text-stone-900 dark:text-slate-100">203</Text>
          </View>
          <Text className="mt-2 text-xs font-bold text-stone-800 dark:text-slate-200">
            Reactivos oficiales
          </Text>
          <Text className="mt-0.5 text-[11px] text-stone-500 dark:text-slate-400">
            143 disciplinares y 60 de Lenguaje y Comunicación.
          </Text>
        </View>

        <View className="min-w-[165px] flex-1 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <View className="flex-row items-center gap-2">
            <View className="h-8 w-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 items-center justify-center">
              <Clock3 size={16} color="#0284c7" />
            </View>
            <Text className="text-2xl font-extrabold text-stone-900 dark:text-slate-100">9 h</Text>
          </View>
          <Text className="mt-2 text-xs font-bold text-stone-800 dark:text-slate-200">
            Dos sesiones
          </Text>
          <Text className="mt-0.5 text-[11px] text-stone-500 dark:text-slate-400">
            Temporizador integrado en Modo Examen Real.
          </Text>
        </View>

        <View className="min-w-[165px] flex-1 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <View className="flex-row items-center gap-2">
            <View className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 items-center justify-center">
              <Highlighter size={16} color="#d97706" />
            </View>
            <Text className="text-2xl font-extrabold text-stone-900 dark:text-slate-100">DCPDV</Text>
          </View>
          <Text className="mt-2 text-xs font-bold text-stone-800 dark:text-slate-200">
            Subrayar y marcar
          </Text>
          <Text className="mt-0.5 text-[11px] text-stone-500 dark:text-slate-400">
            Resalta pistas clave y marca reactivos para revisar.
          </Text>
        </View>

        <View className="min-w-[165px] flex-1 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <View className="flex-row items-center gap-2">
            <View className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 items-center justify-center">
              <Target size={16} color="#059669" />
            </View>
            <Text className="text-2xl font-extrabold text-stone-900 dark:text-slate-100">ICNE</Text>
          </View>
          <Text className="mt-2 text-xs font-bold text-stone-800 dark:text-slate-200">
            Nivel orientativo
          </Text>
          <Text className="mt-0.5 text-[11px] text-stone-500 dark:text-slate-400">
            Estimación Satisfactorio / Sobresaliente en tu progreso.
          </Text>
        </View>
      </View>

      {/* Carrusel deslizable: GitHub y productos Astriom */}
      <View className="gap-3">
        <View className="flex-row items-end justify-between gap-3">
          <View className="flex-1">
            <Text className="text-xs font-bold uppercase tracking-widest text-teal-700 dark:text-teal-400">
              Código abierto y ecosistema Astriom
            </Text>
            <Text className="text-xl font-extrabold text-stone-900 dark:text-slate-100">
              Conoce el repositorio y otros proyectos
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Pressable
              onPress={() => slideBy(-320)}
              accessibilityLabel="Deslizar a la izquierda"
              className="h-9 w-9 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 items-center justify-center active:bg-stone-100 dark:active:bg-slate-800"
            >
              <ChevronLeft size={18} color="#64748b" />
            </Pressable>
            <Pressable
              onPress={() => slideBy(320)}
              accessibilityLabel="Deslizar a la derecha"
              className="h-9 w-9 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 items-center justify-center active:bg-stone-100 dark:active:bg-slate-800"
            >
              <ChevronRight size={18} color="#64748b" />
            </Pressable>
          </View>
        </View>

        <ScrollView
          ref={sliderRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={312}
          onScroll={(e) => setSliderX(e.nativeEvent.contentOffset.x)}
          scrollEventThrottle={32}
          contentContainerStyle={{ gap: 12, paddingVertical: 2 }}
        >
          {ECOSYSTEM_CARDS.map((card) => {
            const IconComp = card.Icon;
            return (
              <Pressable
                key={card.id}
                onPress={() => Linking.openURL(card.url)}
                className="w-[285px] sm:w-[300px] overflow-hidden rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 justify-between shadow-xs active:border-teal-500"
              >
                <View>
                  <View className={`h-1 w-full ${card.accentCls}`} />
                  <View className="p-4 sm:p-5 gap-2.5">
                    <View className="flex-row items-center justify-between gap-2">
                      <View className={`h-9 w-9 rounded-xl ${card.iconBgCls} items-center justify-center`}>
                        <IconComp size={18} color={card.iconColor} />
                      </View>
                      <View className={`rounded-full px-2.5 py-1 ${card.badgeCls}`}>
                        <Text className={`text-[10px] font-bold uppercase tracking-wider ${card.badgeTextCls}`}>
                          {card.badge}
                        </Text>
                      </View>
                    </View>

                    <Text className="text-base font-bold text-stone-900 dark:text-slate-100">
                      {card.title}
                    </Text>
                    <Text className="text-xs leading-relaxed text-stone-600 dark:text-slate-400">
                      {card.description}
                    </Text>
                  </View>
                </View>

                <View className="px-4 sm:px-5 pb-4 flex-row items-center gap-1.5">
                  <Text className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                    {card.cta}
                  </Text>
                  <ExternalLink size={13} color="#0d9488" />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Mapa de estudio */}
      <View className="gap-4">
        <View className="flex-row flex-wrap items-end justify-between gap-3">
          <View>
            <Text className="text-xs font-bold uppercase tracking-widest text-teal-700 dark:text-teal-400">
              Mapa de estudio
            </Text>
            <Text className="mt-1 text-2xl font-bold text-stone-900 dark:text-slate-100">
              Elige un área o subárea para practicar
            </Text>
          </View>
          <Pressable
            onPress={() => onNavigate('guias')}
            className="flex-row items-center gap-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 active:bg-stone-50 dark:active:bg-slate-800"
          >
            <BookOpen size={15} color="#0d9488" />
            <Text className="text-xs font-semibold text-teal-800 dark:text-teal-300">
              Abrir todas las guías
            </Text>
            <ArrowRight size={14} color="#0d9488" />
          </Pressable>
        </View>

        {temario?.secciones.map((seccion) => (
          <View
            key={seccion.id}
            className="rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs"
          >
            <View className="flex-row flex-wrap items-center justify-between gap-2 border-b border-stone-100 dark:border-slate-800 pb-3.5">
              <Text className="text-lg font-bold text-stone-900 dark:text-slate-100">
                {seccion.nombre}
              </Text>
              <View className="rounded-lg bg-teal-50 dark:bg-teal-950/70 px-2.5 py-1">
                <Text className="text-xs font-bold text-teal-800 dark:text-teal-300">
                  {seccion.reactivos} reactivos
                </Text>
              </View>
            </View>

            <View className="mt-4 gap-3 sm:flex-row sm:flex-wrap">
              {seccion.areas.map((area) => (
                <View
                  key={area.id}
                  className="w-full sm:w-[48.5%] rounded-2xl border border-stone-200/80 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-800/50 p-4"
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-xs font-extrabold text-teal-700 dark:text-teal-400">
                        {area.id}
                      </Text>
                      <Text className="mt-0.5 text-sm font-bold text-stone-900 dark:text-slate-100">
                        {area.nombre}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => onNavigate('simulador', { area: area.id })}
                      className="rounded-lg bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 px-2.5 py-1 active:bg-teal-50"
                    >
                      <Text className="text-[11px] font-bold text-teal-800 dark:text-teal-300">
                        {area.reactivos} · Practicar
                      </Text>
                    </Pressable>
                  </View>

                  <View className="mt-3 gap-1">
                    {area.subareas.map((sub) => (
                      <Pressable
                        key={sub.id}
                        onPress={() => onNavigate('simulador', { area: area.id, subarea: sub.id })}
                        className="flex-row items-center justify-between gap-2 rounded-xl px-2.5 py-2 active:bg-white dark:active:bg-slate-800"
                      >
                        <Text className="flex-1 text-xs text-stone-700 dark:text-slate-300">
                          <Text className="font-bold text-stone-900 dark:text-slate-100">
                            {sub.id}
                          </Text>{' '}
                          · {sub.nombre}
                        </Text>
                        <View className="flex-row items-center gap-1">
                          <Text className="text-xs font-semibold text-stone-700 dark:text-slate-300">
                            {sub.reactivos}
                          </Text>
                          <ArrowRight size={12} color="#0d9488" />
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}

        {!temario && (
          <View className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40 p-4">
            <Text className="text-sm text-amber-900 dark:text-amber-200">
              No se pudo cargar el temario. Revisa que el servidor Go esté iniciado.
            </Text>
          </View>
        )}
      </View>

      <Text className="text-xs leading-relaxed text-stone-500 dark:text-slate-400">
        La guía incluye 15 % de reactivos piloto. La puntuación de esta plataforma es un resultado
        de práctica; Ceneval determina el ICNE oficial mediante su propio proceso de calificación.
      </Text>
    </View>
  );
}
