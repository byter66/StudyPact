import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';

          return (
            <div
              key={toast.id}
              className="scale-in"
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 18px',
                borderRadius: 'var(--radius-lg)',
                background: '#161e31',
                border: `1px solid ${
                  isSuccess
                    ? 'rgba(16, 185, 129, 0.4)'
                    : isError
                    ? 'rgba(239, 68, 68, 0.4)'
                    : isWarning
                    ? 'rgba(245, 158, 11, 0.4)'
                    : 'rgba(255, 255, 255, 0.15)'
                }`,
                boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.6)',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 500,
                maxWidth: '400px',
              }}
            >
              {isSuccess && <CheckCircle2 size={18} color="#10b981" />}
              {isError && <AlertCircle size={18} color="#ef4444" />}
              {isWarning && <AlertTriangle size={18} color="#f59e0b" />}
              {!isSuccess && !isError && !isWarning && <Info size={18} color="#3b82f6" />}
              <span style={{ flex: 1 }}>{toast.message}</span>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      addToast: (msg) => console.log('Toast:', msg),
      removeToast: () => {},
    };
  }
  return context;
}
