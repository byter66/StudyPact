import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import './Modal.css';

export default function Modal({
  isOpen = true,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = '500px',
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="sp-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="sp-modal-container scale-in"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sp-modal-header">
          <div>
            {title && <h3 className="sp-modal-title">{title}</h3>}
            {subtitle && <p className="sp-modal-subtitle">{subtitle}</p>}
          </div>
          {onClose && (
            <button
              type="button"
              className="sp-modal-close"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="sp-modal-body">{children}</div>
      </div>
    </div>
  );
}
