import React, { Suspense, lazy, useRef, useState, useEffect, useCallback } from 'react';

interface LoadingProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

const LoadingSkeleton: React.FC<LoadingProps> = ({ size = 'medium', message }) => {
  const sizes = {
    small: { width: '100%', height: '80px' },
    medium: { width: '100%', height: '200px' },
    large: { width: '100%', height: '400px' }
  };

  return (
    <div
      className="loading-skeleton"
      style={sizes[size]}
      role="status"
      aria-label={message || '加载中...'}
    >
      <div className="skeleton-animation" aria-hidden="true" />
      {message && <span className="skeleton-message">{message}</span>}
      <style>{`
        .loading-skeleton {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .skeleton-animation {
          position: absolute;
          width: 100%;
          height: 100%;
        }
        .skeleton-message {
          color: #666;
          font-size: 14px;
          z-index: 1;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
};

export function withLazyLoad<P extends object>(
  importFn: () => Promise<{ default: React.ComponentType<P> }>,
  fallback?: React.ReactNode,
  preloadDelay: number = 0
): React.FC<P> {
  let LazyComponent: React.LazyExoticComponent<React.ComponentType<P>> | null = null;
  let preloadTimer: ReturnType<typeof setTimeout> | null = null;

  const LazyWrapper = React.forwardRef<P>((props, ref) => {
    if (!LazyComponent) {
      LazyComponent = lazy(importFn);
    }

    return (
      <Suspense fallback={fallback || <LoadingSkeleton />}>
        <LazyComponent {...(props as any)} ref={ref as any} />
      </Suspense>
    );
  });

  (LazyWrapper as any).preload = () => {
    if (!LazyComponent && !preloadTimer) {
      preloadTimer = setTimeout(() => {
        importFn().then(() => {
          LazyComponent = lazy(importFn);
        });
      }, preloadDelay);
    }
  };

  return LazyWrapper as unknown as React.FC<P>;
}

export function useLazyImage(
  src: string,
  options?: IntersectionObserverInit & { threshold?: number }
) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !src) return;

    const observerOptions: IntersectionObserverInit = {
      root: options?.root,
      rootMargin: options?.rootMargin || '50px',
      threshold: options?.threshold || 0.01
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.disconnect();
      }
    }, observerOptions);

    observer.observe(img);
    return () => observer.disconnect();
  }, [src, options?.root, options?.rootMargin, options?.threshold]);

  useEffect(() => {
    if (!isInView || !src) return;

    const img = new Image();

    img.onload = () => {
      setImageSrc(src);
      setIsLoading(false);
      setHasError(false);
    };

    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
    };

    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [isInView, src]);

  return { imageSrc, imgRef, isLoading, hasError };
}

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholder?: React.ReactNode;
  errorFallback?: React.ReactNode;
  observerOptions?: IntersectionObserverInit & { threshold?: number };
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  placeholder,
  errorFallback,
  observerOptions,
  ...props
}) => {
  const { imageSrc, imgRef, isLoading, hasError } = useLazyImage(src, observerOptions);

  if (isLoading) {
    return (
      <>
        {placeholder || (
          <div className="lazy-image-placeholder" style={{ width: '100%', height: '100%' }}>
            <LoadingSkeleton size="medium" />
          </div>
        )}
      </>
    );
  }

  if (hasError) {
    return (
      <>
        {errorFallback || (
          <div className="lazy-image-error" role="alert">
            图片加载失败
          </div>
        )}
      </>
    );
  }

  return (
    <img
      ref={imgRef}
      src={imageSrc || src}
      alt={alt}
      loading="lazy"
      {...props}
    />
  );
};

export function usePreload(resources: Array<string | (() => Promise<any>)>) {
  const [loadedResources, setLoadedResources] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const preload = useCallback(async () => {
    if (isLoading || loadedResources.size === resources.length) return;

    setIsLoading(true);

    await Promise.all(
      resources.map(async (resource) => {
        const key = typeof resource === 'string' ? resource : resource.name || 'anonymous';

        try {
          if (typeof resource === 'string') {
            const img = new Image();
            img.src = resource;
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
            });
          } else {
            await resource();
          }

          setLoadedResources(prev => new Set([...prev, key]));
        } catch (error) {
          console.warn(`[LazyLoader] Failed to preload:`, error);
        }
      })
    );

    setIsLoading(false);
  }, [resources, isLoading, loadedResources.size]);

  return { preload, loadedResources, isLoading, isComplete: loadedResources.size === resources.length };
}

export { LoadingSkeleton, LazyImage };
export default withLazyLoad;
