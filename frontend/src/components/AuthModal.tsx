import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LogIn, UserPlus, X } from 'lucide-react-native';
import { api, setStoredToken } from '../lib/api';
import type { User } from '../types/egel';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export function AuthModal({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const res =
        mode === 'login'
          ? await api.login(email.trim(), password)
          : await api.register(name.trim(), email.trim(), password, passwordConfirmation);
      setStoredToken(res.token);
      onSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error al autenticar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 items-center justify-center bg-stone-950/60 p-4"
      >
        <Pressable onPress={onClose} className="absolute inset-0" />
        <View className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
          <View className="flex-row items-center justify-between mb-6">
            <View className="flex-row gap-1 rounded-xl bg-stone-100 dark:bg-slate-800 p-1">
              <Pressable
                onPress={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex-row items-center gap-2 rounded-lg px-3.5 py-2 ${
                  mode === 'login' ? 'bg-teal-700' : ''
                }`}
              >
                <LogIn size={15} color={mode === 'login' ? '#ffffff' : '#94a3b8'} />
                <Text
                  className={`text-sm font-semibold ${
                    mode === 'login' ? 'text-white' : 'text-stone-600 dark:text-slate-300'
                  }`}
                >
                  Iniciar sesión
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`flex-row items-center gap-2 rounded-lg px-3.5 py-2 ${
                  mode === 'register' ? 'bg-teal-700' : ''
                }`}
              >
                <UserPlus size={15} color={mode === 'register' ? '#ffffff' : '#94a3b8'} />
                <Text
                  className={`text-sm font-semibold ${
                    mode === 'register' ? 'text-white' : 'text-stone-600 dark:text-slate-300'
                  }`}
                >
                  Registrarse
                </Text>
              </Pressable>
            </View>

            <Pressable onPress={onClose} className="rounded-lg p-1.5 active:bg-stone-100 dark:active:bg-slate-800">
              <X size={20} color="#94a3b8" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View className="gap-4">
              {mode === 'register' && (
                <View>
                  <Text className="text-xs font-semibold text-stone-700 dark:text-slate-300 mb-1.5">
                    Nombre completo
                  </Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Ej. Ana García"
                    placeholderTextColor="#94a3b8"
                    className="w-full rounded-xl border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-stone-900 dark:text-slate-100"
                  />
                </View>
              )}

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

              <View>
                <Text className="text-xs font-semibold text-stone-700 dark:text-slate-300 mb-1.5">
                  Contraseña
                </Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#94a3b8"
                  className="w-full rounded-xl border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-stone-900 dark:text-slate-100"
                />
              </View>

              {mode === 'register' && (
                <View>
                  <Text className="text-xs font-semibold text-stone-700 dark:text-slate-300 mb-1.5">
                    Confirmar contraseña
                  </Text>
                  <TextInput
                    value={passwordConfirmation}
                    onChangeText={setPasswordConfirmation}
                    secureTextEntry
                    placeholder="Repite tu contraseña"
                    placeholderTextColor="#94a3b8"
                    className="w-full rounded-xl border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-stone-900 dark:text-slate-100"
                  />
                </View>
              )}

              {error && (
                <View className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5">
                  <Text className="text-xs text-rose-700">{error}</Text>
                </View>
              )}

              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                className="mt-1 flex-row items-center justify-center gap-2 rounded-xl bg-teal-700 py-3 active:bg-teal-800 disabled:opacity-60"
              >
                {loading && <ActivityIndicator size="small" color="#ffffff" />}
                <Text className="text-sm font-semibold text-white">
                  {mode === 'login' ? 'Entrar a mi cuenta' : 'Crear cuenta'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
