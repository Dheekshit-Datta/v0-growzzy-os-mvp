'use client';

import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

const toastStore: { listeners: Set<(toasts: ToastMessage[]) => void>; toasts: ToastMessage[] } = {
  listeners: new Set(),
  toasts: [],
};

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) {
  const id = Date.now().toString();
  const toast: ToastMessage = { id, type, message, duration };
  toastStore.toasts.push(toast);
  toastStore.listeners.forEach((listener) => listener([...toastStore.toasts]));

  if (duration > 0) {
    setTimeout(() => {
      toastStore.toasts = toastStore.toasts.filter((t) => t.id !== id);
      toastStore.listeners.forEach((listener) => listener([...toastStore.toasts]));
    }, duration);
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    toastStore.listeners.add(setToasts);
    return () => {
      toastStore.listeners.delete(setToasts);
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-900 border border-green-200'
              : toast.type === 'error'
              ? 'bg-red-50 text-red-900 border border-red-200'
              : 'bg-blue-50 text-blue-900 border border-blue-200'
          }`}
        >
          {toast.type === 'success' && <CheckCircle className="h-4 w-4 flex-shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="h-4 w-4 flex-shrink-0" />}
          {toast.type === 'info' && <Info className="h-4 w-4 flex-shrink-0" />}
          <span>{toast.message}</span>
          <button
            onClick={() => {
              toastStore.toasts = toastStore.toasts.filter((t) => t.id !== toast.id);
              toastStore.listeners.forEach((listener) => listener([...toastStore.toasts]));
            }}
            className="ml-2 opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
