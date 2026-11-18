import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CheckCircle2,
  Keyboard,
  Monitor,
  Moon,
  Server,
  Settings,
  Sun,
  User as UserIcon,
  Wifi,
  X,
} from 'lucide-react-native';
import { getApiBaseUrl } from '../lib/api';
import type { ThemePreference } from '../lib/theme';
import type { User } from '../types/egel';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  themePref: ThemePreference;
  onSelectTheme: (pref: ThemePreference) => void;
  user: User | null;
  wsConnected: boolean;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  themePref,
  onSelectTheme,
  user,
  wsConnected,
  onOpenProfile,
  onOpenAuth,
}: SettingsModalProps) {
  const apiUrl = getApiBaseUrl() || (Platform.OS === 'web' ? 'Mismo origen (/api)' : '');

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-stone-950/60 p-4">
        <Pressable onPress={onClose} className="absolute inset-0" />
        <SafeAreaView
          edges={['top', 'bottom']}
          className="w-full max-w-lg rounded-3xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-stone-200 dark:border-slate-800 px-5 py-4">
            <View className="flex-row items-center gap-2.5">
              <View className="h-8 w-8 rounded-xl bg-teal-50 dark:bg-teal-950/70 items-center justify-center">
                <Settings size={17} color="#0d9488" />
              </View>
              <View>
                <Text className="text-base font-bold text-stone-900 dark:text-slate-100">
                  Ajustes
                </Text>
                <Text className="text-[11px] text-stone-500 dark:text-slate-400">
                  Apariencia, sincronización y preferencias
                </Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              className="rounded-xl p-1.5 active:bg-stone-100 dark:active:bg-slate-800"
            >
              <X size={20} color="#94a3b8" />
            </Pressable>
          </View>

          <ScrollView className="max-h-[75vh] p-5">
            <View className="gap-5 pb-2">
              {/* Apariencia */}
              <View className="gap-2.5">
                <Text className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400">
                  Apariencia (Tema)
                </Text>
                <View className="flex-row gap-2">
                  {(
                    [
                      { id: 'system', label: 'Sistema', icon: Monitor },
                      { id: 'light', label: 'Claro', icon: Sun },
                      { id: 'dark', label: 'Oscuro', icon: Moon },
                    ] as const
                  ).map((opt) => {
                    const active = themePref === opt.id;
                    const Icon = opt.icon;
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => onSelectTheme(opt.id)}
                        className={`flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 py-3 px-2 ${
                          active
                            ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/50'
                            : 'border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800/50'
                        }`}
                      >
                        <Icon
                          size={18}
                          color={
                            active
                              ? '#0d9488'
                              : opt.id === 'dark'
                                ? '#fbbf24'
                                : opt.id === 'light'
                                  ? '#d97706'
                                  : '#64748b'
                          }
                        />
                        <Text
                          className={`text-xs font-bold ${
                            active
                              ? 'text-teal-900 dark:text-teal-200'
                              : 'text-stone-700 dark:text-slate-300'
                          }`}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text className="text-[11px] text-stone-500 dark:text-slate-400">
                  En modo «Sistema», la app se adapta automáticamente al tema claro u oscuro de tu dispositivo.
                </Text>
              </View>

              {/* Sincronización y Servidor */}
              <View className="gap-2.5">
                <Text className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400">
                  Sincronización y Conexión
                </Text>
                <View className="rounded-2xl border border-stone-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-800/50 p-4 gap-3">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <Wifi size={15} color={wsConnected ? '#10b981' : '#94a3b8'} />
                      <Text className="text-xs font-semibold text-stone-800 dark:text-slate-200">
                        WebSocket en tiempo real
                      </Text>
                    </View>
                    <View
                      className={`rounded-full px-2.5 py-0.5 ${
                        wsConnected
                          ? 'bg-emerald-100 dark:bg-emerald-950/70'
                          : 'bg-stone-200 dark:bg-slate-700'
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-bold ${
                          wsConnected
                            ? 'text-emerald-800 dark:text-emerald-300'
                            : 'text-stone-600 dark:text-slate-400'
                        }`}
                      >
                        {wsConnected ? 'Conectado' : user ? 'Reconectando...' : 'Sin sesión'}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between gap-2 pt-2 border-t border-stone-200/70 dark:border-slate-700/70">
                    <View className="flex-row items-center gap-2">
                      <Server size={15} color="#64748b" />
                      <Text className="text-xs font-semibold text-stone-800 dark:text-slate-200">
                        API Backend
                      </Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      className="text-xs font-mono text-stone-600 dark:text-slate-400 max-w-[200px]"
                    >
                      {apiUrl}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Cuenta */}
              <View className="gap-2.5">
                <Text className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400">
                  Cuenta
                </Text>
                {user ? (
                  <Pressable
                    onPress={() => {
                      onClose();
                      onOpenProfile();
                    }}
                    className="flex-row items-center justify-between rounded-2xl border border-stone-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-800/50 p-4 active:bg-stone-100"
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="h-9 w-9 rounded-full bg-teal-700 items-center justify-center">
                        <Text className="text-xs font-bold text-white">
                          {user.name.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text className="text-sm font-bold text-stone-900 dark:text-slate-100">
                          {user.name}
                        </Text>
                        <Text className="text-xs text-stone-500 dark:text-slate-400">
                          {user.email}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                      Ir a Perfil →
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => {
                      onClose();
                      onOpenAuth();
                    }}
                    className="flex-row items-center justify-center gap-2 rounded-xl bg-teal-700 py-3 active:bg-teal-800"
                  >
                    <UserIcon size={15} color="#ffffff" />
                    <Text className="text-xs font-bold text-white">
                      Iniciar sesión / Registrarse
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* Atajos */}
              {Platform.OS === 'web' && (
                <View className="flex-row items-center justify-between rounded-2xl border border-stone-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-800/50 px-4 py-3">
                  <View className="flex-row items-center gap-2">
                    <Keyboard size={15} color="#64748b" />
                    <Text className="text-xs font-medium text-stone-700 dark:text-slate-300">
                      Buscador universal rápido
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1 rounded-md border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1">
                    <CheckCircle2 size={11} color="#0d9488" />
                    <Text className="text-[11px] font-bold text-stone-700 dark:text-slate-200">
                      Ctrl + K
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
