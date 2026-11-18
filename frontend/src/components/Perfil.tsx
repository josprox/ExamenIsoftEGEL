import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BarChart3,
  CheckCircle2,
  LogIn,
  LogOut,
  Save,
  Settings,
  User as UserIcon,
} from 'lucide-react-native';
import { api } from '../lib/api';
import type { EstadisticasUsuario, Intento, User } from '../types/egel';
import { Progreso } from './Progreso';

interface PerfilProps {
  user: User | null;
  wsConnected: boolean;
  intentos: Intento[];
  estadisticas: EstadisticasUsuario | null;
  onUserUpdated: (user: User) => void;
  onOpenAuth: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onAttemptDeleted?: () => void;
  onResumeAttempt?: (intentoId: number) => void;
}

export function Perfil({
  user,
  wsConnected,
  intentos,
  estadisticas,
  onUserUpdated,
  onOpenAuth,
  onOpenSettings,
  onLogout,
  onAttemptDeleted,
  onResumeAttempt,
}: PerfilProps) {
  const [subTab, setSubTab] = useState<'progreso' | 'cuenta'>('progreso');
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setError(null);
    setSavedMsg(null);
    setSaving(true);
    try {
      const res = await api.updateProfile({
        name: name.trim(),
        email: email.trim(),
        ...(password ? { password, password_confirmation: passwordConfirmation } : {}),
      });
      onUserUpdated(res.user);
      setPassword('');
      setPasswordConfirmation('');
      setSavedMsg('Perfil actualizado correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join('')
    : 'EG';

  return (
    <View className="mx-auto w-full max-w-6xl gap-5">
      {/* Cabecera de Perfil */}
      <View className="overflow-hidden rounded-3xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <View className="h-1.5 w-full bg-teal-600" />
        <View className="p-5 sm:p-6 gap-4">
          <View className="flex-row flex-wrap items-center justify-between gap-4">
            <View className="flex-row items-center gap-3.5">
              <View className="h-14 w-14 rounded-2xl bg-teal-700 items-center justify-center">
                <Text className="text-lg font-extrabold text-white">{initials}</Text>
              </View>
              <View>
                <Text className="text-xl font-extrabold text-stone-900 dark:text-slate-100">
                  {user ? user.name : 'Invitado'}
                </Text>
                <Text className="text-xs text-stone-500 dark:text-slate-400">
                  {user
                    ? user.email
                    : 'Inicia sesión para guardar tu progreso, subrayados y simulaciones'}
                </Text>
              </View>
            </View>

            <View className="flex-row flex-wrap items-center gap-2">
              <Pressable
                onPress={onOpenSettings}
                className="flex-row items-center gap-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-3.5 py-2 active:bg-stone-100"
              >
                <Settings size={15} color="#0d9488" />
                <Text className="text-xs font-semibold text-stone-700 dark:text-slate-200">
                  Ajustes
                </Text>
              </Pressable>

              {user ? (
                <Pressable
                  onPress={onLogout}
                  className="flex-row items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2 active:bg-rose-100"
                >
                  <LogOut size={15} color="#e11d48" />
                  <Text className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                    Cerrar sesión
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={onOpenAuth}
                  className="flex-row items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 active:bg-teal-800"
                >
                  <LogIn size={15} color="#ffffff" />
                  <Text className="text-xs font-semibold text-white">Entrar / Registro</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Sub-pestañas de Perfil */}
          <View className="flex-row gap-2 pt-3 border-t border-stone-100 dark:border-slate-800">
            <Pressable
              onPress={() => setSubTab('progreso')}
              className={`flex-row items-center gap-1.5 rounded-xl px-4 py-2 ${
                subTab === 'progreso'
                  ? 'bg-teal-700'
                  : 'bg-stone-100 dark:bg-slate-800'
              }`}
            >
              <BarChart3 size={15} color={subTab === 'progreso' ? '#ffffff' : '#64748b'} />
              <Text
                className={`text-xs font-bold ${
                  subTab === 'progreso'
                    ? 'text-white'
                    : 'text-stone-700 dark:text-slate-300'
                }`}
              >
                Mi Progreso
              </Text>
            </Pressable>

            {user && (
              <Pressable
                onPress={() => setSubTab('cuenta')}
                className={`flex-row items-center gap-1.5 rounded-xl px-4 py-2 ${
                  subTab === 'cuenta'
                    ? 'bg-teal-700'
                    : 'bg-stone-100 dark:bg-slate-800'
                }`}
              >
                <UserIcon size={15} color={subTab === 'cuenta' ? '#ffffff' : '#64748b'} />
                <Text
                  className={`text-xs font-bold ${
                    subTab === 'cuenta'
                      ? 'text-white'
                      : 'text-stone-700 dark:text-slate-300'
                  }`}
                >
                  Editar Perfil
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* Contenido de sub-pestaña */}
      {subTab === 'progreso' || !user ? (
        <Progreso
          user={user}
          wsConnected={wsConnected}
          intentos={intentos}
          estadisticas={estadisticas}
          onOpenAuth={onOpenAuth}
          onAttemptDeleted={onAttemptDeleted}
          onResumeAttempt={onResumeAttempt}
        />
      ) : (
        <View className="mx-auto w-full max-w-2xl rounded-3xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm gap-4">
          <View>
            <Text className="text-lg font-bold text-stone-900 dark:text-slate-100">
              Actualizar datos de perfil
            </Text>
            <Text className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
              Cambia tu nombre, correo electrónico o contraseña de acceso.
            </Text>
          </View>

          <View>
            <Text className="text-xs font-semibold text-stone-700 dark:text-slate-300 mb-1.5">
              Nombre completo
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Tu nombre"
              placeholderTextColor="#94a3b8"
              className="w-full rounded-xl border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-stone-900 dark:text-slate-100"
            />
          </View>

          <View>
            <Text className="text-xs font-semibold text-stone-700 dark:text-slate-300 mb-1.5">
              Correo electrónico
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="correo@ejemplo.com"
              placeholderTextColor="#94a3b8"
              className="w-full rounded-xl border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-stone-900 dark:text-slate-100"
            />
          </View>

          <View className="pt-2 border-t border-stone-100 dark:border-slate-800 gap-3">
            <Text className="text-xs font-bold text-stone-600 dark:text-slate-400">
              Cambiar contraseña (opcional)
            </Text>
            <View>
              <Text className="text-xs font-semibold text-stone-700 dark:text-slate-300 mb-1.5">
                Nueva contraseña
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Déjalo vacío para no cambiarla"
                placeholderTextColor="#94a3b8"
                className="w-full rounded-xl border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-stone-900 dark:text-slate-100"
              />
            </View>
            {password.length > 0 && (
              <View>
                <Text className="text-xs font-semibold text-stone-700 dark:text-slate-300 mb-1.5">
                  Confirmar nueva contraseña
                </Text>
                <TextInput
                  value={passwordConfirmation}
                  onChangeText={setPasswordConfirmation}
                  secureTextEntry
                  placeholder="Repite la nueva contraseña"
                  placeholderTextColor="#94a3b8"
                  className="w-full rounded-xl border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-stone-900 dark:text-slate-100"
                />
              </View>
            )}
          </View>

          {error && (
            <View className="rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5">
              <Text className="text-xs text-rose-700 dark:text-rose-300">{error}</Text>
            </View>
          )}

          {savedMsg && (
            <View className="flex-row items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2.5">
              <CheckCircle2 size={15} color="#059669" />
              <Text className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                {savedMsg}
              </Text>
            </View>
          )}

          <Pressable
            onPress={handleSaveProfile}
            disabled={saving}
            className="mt-1 self-start flex-row items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 active:bg-teal-800 disabled:opacity-60"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Save size={15} color="#ffffff" />
            )}
            <Text className="text-sm font-semibold text-white">Guardar cambios</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
