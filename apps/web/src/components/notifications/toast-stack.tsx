import { useNotifications } from '@/contexts/notifications-context';

export function NotificationToastStack() {
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 rounded-md border border-border bg-popover text-popover-foreground p-3 shadow-lg"
          role="status"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{toast.title}</p>
            {toast.body && <p className="mt-0.5 line-clamp-2 text-sm text-foreground/80">{toast.body}</p>}
          </div>
          <button
            type="button"
            aria-label="Descartar"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => dismissToast(toast.id)}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}