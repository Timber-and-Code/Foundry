import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: number;
  style?: React.CSSProperties;
}

export default function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'var(--bg-inset, #1a1a1e)',
        animation: 'shimmer 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton height={20} width="60%" />
      <Skeleton height={14} width="80%" />
      <Skeleton height={14} width="40%" />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Skeleton height={40} width={80} borderRadius={12} />
        <Skeleton height={40} width={80} borderRadius={12} />
        <Skeleton height={40} width={80} borderRadius={12} />
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Skeleton height={28} width="50%" />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
