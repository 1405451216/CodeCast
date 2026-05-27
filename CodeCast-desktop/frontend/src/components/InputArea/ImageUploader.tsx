import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ImageAttachment } from '../../store/types';

interface ImageUploaderProps {
  images: ImageAttachment[];
  onAddImage: (image: ImageAttachment) => void;
  onRemoveImage: (id: string) => void;
  disabled?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  images,
  onAddImage,
  onRemoveImage,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewImage, setPreviewImage] = useState<ImageAttachment | null>(null);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file);
            e.preventDefault();
            break;
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [disabled]);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      console.warn('Only image files are supported');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      console.warn('Image size exceeds 10MB limit');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image: ImageAttachment = {
        id: crypto.randomUUID(),
        name: file.name || `image-${Date.now()}.png`,
        dataUrl: reader.result as string,
        file,
        size: file.size,
        type: file.type,
      };
      onAddImage(image);
    };
    reader.readAsDataURL(file);
  }, [onAddImage]);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      processFile(file);
    });

    e.target.value = '';
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        processFile(file);
      }
    });
  }, [disabled, processFile]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {images.length > 0 && (
        <div className="image-preview-list">
          {images.map((image) => (
            <div key={image.id} className="image-preview-item">
              <img
                src={image.dataUrl}
                alt={image.name}
                className="image-thumbnail"
                onClick={() => setPreviewImage(image)}
              />
              <button
                className="image-remove-btn"
                onClick={() => onRemoveImage(image.id)}
                disabled={disabled}
                title="移除图片"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <span className="image-size">{formatFileSize(image.size)}</span>
            </div>
          ))}
        </div>
      )}

      <div
        className={`image-upload-zone ${isDragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleFileSelect}
      >
        <div className="upload-zone-content">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span className="upload-text">
            {isDragOver ? '释放以上传图片' : '点击或拖拽上传图片'}
          </span>
          <span className="upload-hint">支持 JPG、PNG、GIF、WebP，最大 10MB</span>
        </div>
      </div>

      {previewImage && (
        <div className="image-preview-modal" onClick={() => setPreviewImage(null)}>
          <div className="preview-modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage.dataUrl} alt={previewImage.name} className="preview-image" />
            <div className="preview-info">
              <span>{previewImage.name}</span>
              <span>{formatFileSize(previewImage.size)}</span>
            </div>
            <button className="preview-close" onClick={() => setPreviewImage(null)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ImageUploader;