tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * GV_Notifications
 * Global toast notifications for the PortfolioPro MVP editor suite.
 * - Fully self-contained: maintains its own internal toast queue.
 * - Exposes a global emitToast(payload) function on window for triggering from anywhere.
 * - Accessible: each toast uses ARIA live region semantics.
 * - Single render block: returns one top-level fragment (<></>).
 * - No external component imports; Tailwind CSS classes provide styling.
 */

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number; // in ms
  created_at: number;
}

type ToastPayload = {
  id?: string;
  type?: ToastType;
  message: string;
  duration?: number;
};

const colorForType = (type: ToastType) => {
  switch (type) {
    case 'success':
      return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', dot: 'bg-green-500' };
    case 'error':
      return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', dot: 'bg-red-500' };
    case 'info':
    default:
      return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', dot: 'bg-blue-500' };
  }
};

const GV_Notifications: React.FC = () => {
  // Internal toast queue
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Timers tracking per toast to auto-dismiss
  const timersRef = useRef<Record<string, number>>({});

  // Helper: add a toast to the queue
  const addToast = (payload: ToastPayload) => {
    const id = payload.id ?? Math.random().toString(36).slice(2);
    const toast: Toast = {
      id,
      type: (payload.type ?? 'info') as ToastType,
      message: payload.message,
      duration: payload.duration ?? 3500,
      created_at: Date.now(),
    };
    setToasts((prev) => [...prev, toast]);
  };

  // Helper: remove a toast by id
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    // cleanup timer
    if (timersRef.current[id]) {
      window.clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  };

  // Expose a global emitter for other parts of the app to trigger toasts
  useEffect(() => {
    // @ts-ignore - augment global window with a toast emitter
    (window as any).emitToast = (payload: ToastPayload) => {
      addToast(payload);
    };
    // Cleanup on unmount
    return () => {
      // @ts-ignore
      delete (window as any).emitToast;
    };
  }, []);

  // Setup per-toast timers for auto-dismiss
  useEffect(() => {
    // For each new toast, if no timer exists, set one
    toasts.forEach((t) => {
      if (timersRef.current[t.id] == null) {
        const timerId = window.setTimeout(() => {
          removeToast(t.id);
        }, t.duration);
        timersRef.current[t.id] = timerId;
      }
    });

    // Cleanup function to clear timers on unmount
    return () => {
      Object.values(timersRef.current).forEach((id) => {
        window.clearTimeout(id);
      });
      timersRef.current = {};
    };
  }, [toasts]);

  // Accessibility: announce count or last message via live region if needed
  const totalToasts = useMemo(() => toasts.length, [toasts.length]);

  // Render a single, big fragment as required
  return (
    <>
      {/* Screen-reader friendly live region (per-toast status is also used for announcements) */}
      <div aria-live="polite" aria-atomic="false" className="sr-only" role="status" aria-label={`${totalToasts} notifications`}>{/* intentionally empty - per-toast live regions handle announcements */}</div>

      {/* Overlay container: bottom-right on desktop; stack upwards with no blocking main content */}
      <div
        aria-label="Global notifications"
        className="pointer-events-none fixed bottom-4 right-4 z-50 w-full max-w-sm flex flex-col items-end gap-3"
        style={{ // allow stacking without affecting layout
          pointerEvents: 'none',
        } as React.CSSProperties}
      >
        {toasts.map((toast) => {
          const color = colorForType(toast.type);
          return (
            <div
              key={toast.id}
              role="status"
              aria-live="polite"
              aria-atomic="false"
              className={`w-full pointer-events-auto rounded-md border ${color.border} ${color.bg} ${color.text} shadow-lg transition-all duration-200 transform hover:scale-105`}
              style={{ willChange: 'transform', minHeight: '56px' }}
            >
              <div className="flex items-start p-3">
                {/* leading colored dot/icon */}
                <span
                  aria-hidden="true"
                  className={`inline-block h-4 w-4 rounded-full mt-1 mr-3 ${color.dot}`}
                  style={{ boxShadow: '0 0 0 2px rgba(0,0,0,0.04)' }}
                />
                {/* Message content */}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${color.text}`} style={{ lineHeight: '1.25' }}>
                    {toast.message}
                  </p>
                </div>
                {/* Dismiss button (icon-only) */}
                <button
                  aria-label="Dismiss notification"
                  className={`ml-2 p-1 rounded-md text-sm font-medium ${color.text} hover:opacity-90`}
                  onClick={() => removeToast(toast.id)}
                  style={{ background: 'transparent' }}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default GV_Notifications;