import React from 'react';

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'message' | 'sidebar-item';
  width?: string | number;
  height?: string | number;
  lines?: number;
  className?: string;
  animation?: 'shimmer' | 'pulse';
}

const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  lines = 1,
  className = '',
  animation = 'shimmer'
}) => {
  const baseClass = `skeleton skeleton-${variant} skeleton-${animation} ${className}`.trim();
  
  const style: React.CSSProperties = {
    ...(width !== undefined && { width }),
    ...(height !== undefined && { height }),
  };

  if (variant === 'message') {
    return <MessageSkeleton className={className} animation={animation} />;
  }

  if (variant === 'sidebar-item') {
    return <SidebarItemSkeleton className={className} animation={animation} />;
  }

  if (lines > 1) {
    return (
      <div className={`${baseClass} skeleton-lines`} style={style} aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="skeleton-line"
            style={{
              width: i === lines - 1 ? '60%' : '100%',
            }}
          />
        ))}
      </div>
    );
  }

  return <div className={baseClass} style={style} aria-hidden="true" />;
};

const MessageSkeleton: React.FC<{ className?: string; animation?: 'shimmer' | 'pulse' }> = ({ 
  className = '', 
  animation = 'shimmer' 
}) => (
  <div className={`message-skeleton skeleton-${animation} ${className}`} aria-hidden="true">
    <div className="skeleton skeleton-circular" style={{ width: 36, height: 36 }} />
    <div className="skeleton-content">
      <div className="skeleton skeleton-text" style={{ width: 80, height: 16, marginBottom: 8 }} />
      <div className="skeleton skeleton-text" style={{ width: '100%', height: 14, marginBottom: 6 }} />
      <div className="skeleton skeleton-text" style={{ width: '95%', height: 14, marginBottom: 6 }} />
      <div className="skeleton skeleton-text" style={{ width: '75%', height: 14 }} />
    </div>
  </div>
);

const SidebarItemSkeleton: React.FC<{ className?: string; animation?: 'shimmer' | 'pulse' }> = ({ 
  className = '', 
  animation = 'shimmer' 
}) => (
  <div className={`sidebar-item-skeleton skeleton-${animation} ${className}`} aria-hidden="true">
    <div className="skeleton skeleton-circular" style={{ width: 28, height: 28 }} />
    <div className="skeleton skeleton-text" style={{ flex: 1, height: 14 }} />
  </div>
);

const SkeletonContainer: React.FC<{
  children: React.ReactNode;
  isLoading: boolean;
  fallback?: React.ReactNode;
}> = ({ children, isLoading, fallback }) => {
  if (!isLoading) return <>{children}</>;
  return <>{fallback || <Skeleton variant="message" />}</>;
};

export { Skeleton, SkeletonContainer, MessageSkeleton, SidebarItemSkeleton };
export default Skeleton;
