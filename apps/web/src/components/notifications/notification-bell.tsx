import { useEffect, useRef, useState } from 'react';
import { useNotifications } from '@/contexts/notifications-context';
import { Button } from '@/components/ui/button';

function relativeTime(date: Date): string {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h atrás`;
  const days = Math.round(hours / 24);
  return `${days} d atrás`;
}

export function NotificationBell() {
  const { notifications, unread, isLoading, markRead, markAllRead, muted, toggleMuted } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="outline"
        size="sm"
        aria-label="Notificações"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <BellIcon className="h-4 w-4" />
        {unread > 0 && (
          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 max-w-[90vw] rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">Notificações</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => void markAllRead()}
                >
                  Marcar tudo como lido
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-xs" onClick={toggleMuted}>
                {muted ? 'Reativar som' : 'Silenciar'}
              </Button>
            </div>
          </div>

          <ul className="max-h-96 overflow-y-auto">
            {isLoading && notifications.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-500">Carregando…</li>
            )}
            {!isLoading && notifications.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-500">
                Nenhuma notificação ainda
              </li>
            )}
            {notifications.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  onClick={() => {
                    if (!notification.readAt) void markRead(notification.id);
                  }}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      notification.readAt ? 'bg-transparent' : 'bg-indigo-500'
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">
                      {notification.title}
                    </span>
                    <span className="block text-sm text-slate-600">{notification.body}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      {relativeTime(notification.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
      />
    </svg>
  );
}