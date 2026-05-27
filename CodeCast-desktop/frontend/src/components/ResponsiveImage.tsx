import React, { useState, useEffect, useRef } from 'react';

interface ResponsiveImageProps {
  src: string;
  alt: string;
  webpSrc?: string;
  avifSrc?: string;
  srcSet?: string;
  sizes?: string;
  width?: number | string;
  height?: number | string;
  aspectRatio?: number;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  lazy?: boolean;
  placeholder?: 'blur' | 'color' | 'gradient';
  blurHash?: string;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  compressionFormat?: 'auto' | 'webp' | 'avif' | 'original';
  adaptiveQuality?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
}

interface QualityConfig {
  quality: number;
  format: string;
  width: number;
}

function getOptimalQuality(
  baseQuality: ResponsiveImageProps['quality'],
  adaptive: boolean
): QualityConfig {
  const connection = (navigator as any).connection;

  if (!adaptive || !connection) {
    const qualityMap = { low: 60, medium: 80, high: 95, auto: 85 };
    return {
      quality: qualityMap[baseQuality || 'auto'] || 85,
      format: 'auto',
      width: window.innerWidth
    };
  }

  const effectiveType = connection.effectiveType;
  const saveData = connection.saveData;

  if (saveData) {
    return { quality: 50, format: 'webp', width: Math.min(window.innerWidth, 640) };
  }

  const typeQualityMap: Record<string, number> = {
    'slow-2g': 50,
    '2g': 60,
    '3g': 75,
    '4g': 85
  };

  return {
    quality: typeQualityMap[effectiveType] || 85,
    format: effectiveType === '4g' ? 'avif' : 'webp',
    width: effectiveType === '4g'
      ? window.innerWidth
      : Math.min(window.innerWidth, 1024)
  };
}

const ResponsiveImage: React.FC<ResponsiveImageProps> = React.memo(({
  src,
  alt,
  webpSrc,
  avifSrc,
  srcSet,
  sizes,
  width = '100%',
  height = 'auto',
  aspectRatio,
  objectFit = 'cover',
  lazy = true,
  placeholder = 'blur',
  quality = 'auto',
  compressionFormat = 'auto',
  adaptiveQuality = false,
  onLoad,
  onError,
  className = '',
  style,
  priority = false
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const containerRef = useRef<HTMLDivElement>(null);

  const optimalQuality = getOptimalQuality(quality, adaptiveQuality);

  useEffect(() => {
    if (!lazy || priority) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [lazy, priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    width: typeof width === 'number' ? `${width}px` : width,
    height: aspectRatio ? `calc(${width} / ${aspectRatio})` : (typeof height === 'number' ? `${height}px` : height),
    backgroundColor: hasError ? 'var(--error-bg, rgba(248,113,113,0.1))' : 'var(--input-bg, #1e1e1e)',
    ...style
  };

  const imageStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit,
    opacity: isLoaded ? 1 : 0,
    transition: 'opacity 0.3s ease-in-out'
  };

  const getPlaceholderStyle = (): React.CSSProperties => {
    switch (placeholder) {
      case 'blur':
        return {
          filter: 'blur(20px) saturate(150%)',
          transform: 'scale(1.1)',
          opacity: isLoaded ? 0 : 1,
          transition: 'opacity 0.5s ease-out'
        };
      case 'color':
        return {
          opacity: isLoaded ? 0 : 1,
          backgroundColor: 'var(--accent-50, #f5f3ff)'
        };
      case 'gradient':
        return {
          background: 'linear-gradient(135deg, var(--input-bg), var(--sidebar-hover))',
          opacity: isLoaded ? 0 : 1,
          transition: 'opacity 0.3s ease'
        };
      default:
        return {};
    }
  };

  return (
    <div
      ref={containerRef}
      className={`responsive-image-container ${className}`}
      style={containerStyle}
      data-loaded={isLoaded}
    >
      <div className="image-placeholder" style={{ ...getPlaceholderStyle(), position: 'absolute', inset: 0 }} />

      {isInView && (
        <picture>
          {avifSrc && <source srcSet={avifSrc} type="image/avif" />}
          {webpSrc || <source srcSet={src.replace(/\.(jpg|jpeg|png)$/i, '.webp')} type="image/webp" />}
          {srcSet ? (
            <img
              src={src.split(' ')[0]}
              srcSet={srcSet}
              sizes={sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'}
              alt={alt}
              loading={lazy && !priority ? 'lazy' : 'eager'}
              decoding="async"
              style={imageStyle}
              onLoad={handleLoad}
              onError={handleError}
            />
          ) : (
            <img
              src={src}
              alt={alt}
              loading={lazy && !priority ? 'lazy' : 'eager'}
              decoding="async"
              style={imageStyle}
              onLoad={handleLoad}
              onError={handleError}
            />
          )}
        </picture>
      )}

      {hasError && (
        <div
          className="image-error"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--error, #f87171)',
            fontSize: 'var(--text-xs, 12px)',
            gap: '8px'
          }}
          aria-label="图片加载失败"
        >
          <span style={{ fontSize: '24px' }}>🖼️</span>
          <span>加载失败</span>
        </div>
      )}

      {!isLoaded && !hasError && isInView && (
        <div
          className="image-loading"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '24px',
            height: '24px',
            border: '2px solid var(--border-color, var(--border))',
            borderTopColor: 'var(--accent, #7c7cff)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
});

ResponsiveImage.displayName = 'ResponsiveImage';

export default ResponsiveImage;

interface ImageGalleryProps {
  images: Array<{
    src: string;
    alt: string;
    caption?: string;
  }>;
  columns?: number;
  gap?: number;
  onImageClick?: (index: number) => void;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  columns = 3,
  gap = 16,
  onImageClick
}) => {
  return (
    <div
      className="image-gallery"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap}px`
      }}
      role="list"
      aria-label="图片画廊"
    >
      {images.map((image, index) => (
        <figure
          key={index}
          onClick={() => onImageClick?.(index)}
          style={{ cursor: onImageClick ? 'pointer' : 'default' }}
          role="listitem"
        >
          <ResponsiveImage
            src={image.src}
            alt={image.alt}
            aspectRatio={1}
            objectFit="cover"
          />
          {image.caption && (
            <figcaption
              style={{
                marginTop: '8px',
                fontSize: 'var(--text-sm, 14px)',
                color: 'var(--text-secondary, var(--text-dim))',
                textAlign: 'center'
              }}
            >
              {image.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
};
