'use client';

import { cn } from '@/lib/utils';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error';

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [visible, setVisible] = useState(false);

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    setToast({ message, type });
    setVisible(true);
    setTimeout(() => setVisible(false), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          className={cn(
            'fixed top-5 left-1/2 -translate-x-1/2 z-[100]',
            'px-6 py-3 rounded-xl backdrop-blur-lg',
            'text-sm font-medium text-white',
            'transition-all duration-300',
            toast.type === 'success'
              ? 'bg-green-500/90 border border-green-500/50'
              : 'bg-red-500/90 border border-red-500/50',
            visible ? 'translate-y-0 opacity-100' : '-translate-y-24 opacity-0'
          )}
        >
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
