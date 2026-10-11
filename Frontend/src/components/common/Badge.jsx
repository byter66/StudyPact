import React from 'react';

const EXAM_VARIANTS = {
  UPSC: 'sp-badge-upsc',
  GATE: 'sp-badge-gate',
  NEET: 'sp-badge-neet',
  JEE: 'sp-badge-jee',
  CAT: 'sp-badge-cat',
  SSC: 'sp-badge-ssc',
};

export default function Badge({
  children,
  variant, // 'upsc' | 'gate' | 'neet' | 'jee' | 'cat' | 'ssc' | 'live' | 'streak' | 'custom'
  icon: Icon = null,
  pulse = false,
  className = '',
  style = {},
}) {
  const normalizedVariant = (variant || '').toUpperCase();
  const examClass = EXAM_VARIANTS[normalizedVariant] || '';

  return (
    <span
      className={`sp-badge ${examClass} ${className}`}
      style={style}
    >
      {pulse && <span className="pulse-dot" aria-hidden="true" />}
      {Icon && <Icon size={12} />}
      <span>{children}</span>
    </span>
  );
}
