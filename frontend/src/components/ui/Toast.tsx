'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type ToastContextValue = {
  showToast: (msg: string) => void;
};

const ToastContext = createContext<ToastContextValue>({ showToast: () => undefined });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState('');
  const [visible, setVisible] = useState(false);

  const showToast = useCallback((message: string) => {
    setMsg(message);
    setVisible(true);
    setTimeout(() => setVisible(false), 2800);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className={`fixed bottom-6 right-6 z-[999] flex items-center gap-3 rounded-2xl bg-navy px-5 py-3 text-sm font-medium text-white shadow-2xl transition-all duration-300 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0 pointer-events-none'
        }`}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs">✓</span>
        {msg}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
