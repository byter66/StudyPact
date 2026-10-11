import React from 'react';

export function Skeleton({ width = '100%', height = '16px', borderRadius = 'var(--radius-sm)', className = '', style = {} }) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}

export function RoomCardSkeleton() {
  return (
    <div
      className="glass-panel"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        minHeight: '140px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="60px" height="22px" borderRadius="12px" />
        <Skeleton width="75px" height="18px" />
      </div>
      <Skeleton width="85%" height="24px" />
      <Skeleton width="60%" height="14px" />
    </div>
  );
}

export function TaskSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
      <Skeleton width="18px" height="18px" borderRadius="4px" />
      <Skeleton width="80%" height="16px" />
    </div>
  );
}
