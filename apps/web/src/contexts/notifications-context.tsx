import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Notification } from '@mathitis/schemas';
import { notificationsApi } from '@/lib/notifications-api';
import { useAuth } from '@/contexts/auth-context';
import { playUiSound } from '@/lib/ui-sounds';

const POLL_INTERVAL_MS = 30_000;
const TOAST_TTL_MS = 6_000;
const MUTE_STORAGE_KEY = 'mathitis_notifications_muted';

export interface NotificationToast {
  id: string;
  title: string;
  body: string;
}

interface NotificationsContextValue {
  notifications: Notification[];
  unread: number;
  isLoading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  toasts: NotificationToast[];
  muted: boolean;
  toggleMuted: () => void;
  dismissToast: (id: string) => void;
  playUiSound: typeof playUiSound;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const [muted, setMuted] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem(MUTE_STORAGE_KEY) === '1',
  );
  const latestIdRef = useRef<string | null>(null);

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ limit: 20 }),
    enabled: isAuthenticated,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 15_000,
  });

  useEffect(() => {
    const notifications = notificationsQuery.data?.notifications ?? [];
    const latestId = notifications[0]?.id ?? null;
    if (latestId === null || latestId === latestIdRef.current) return;
    const isFirstPoll = latestIdRef.current === null;
    latestIdRef.current = latestId;
    if (isFirstPoll) return;
    const latest = notifications[0];
    if (!latest) return;
    setToasts((current) => [
      ...current.slice(-2),
      { id: latest.id, title: latest.title, body: latest.body },
    ]);
    if (!muted) playUiSound('clack');
  }, [notificationsQuery.data, muted]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((current) => current.slice(1));
    }, TOAST_TTL_MS);
    return () => clearTimeout(timer);
  }, [toasts]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markRead = useCallback(
    async (id: string) => {
      await markReadMutation.mutateAsync(id);
    },
    [markReadMutation],
  );

  const markAllRead = useCallback(async () => {
    await markAllReadMutation.mutateAsync();
  }, [markAllReadMutation]);

  const toggleMuted = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      if (typeof window !== 'undefined') {
        localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0');
      }
      return next;
    });
  }, []);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications: notificationsQuery.data?.notifications ?? [],
      unread: notificationsQuery.data?.unread ?? 0,
      isLoading: notificationsQuery.isLoading,
      markRead,
      markAllRead,
      toasts,
      muted,
      toggleMuted,
      dismissToast,
      playUiSound,
    }),
    [
      notificationsQuery.data,
      notificationsQuery.isLoading,
      markRead,
      markAllRead,
      toasts,
      muted,
      toggleMuted,
      dismissToast,
    ],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
