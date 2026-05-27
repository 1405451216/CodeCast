import { logger } from '../logger';

export interface ImageAnalysisResult {
  description: string;
  tags: string[];
  confidence: number;
  objects: Array<{
    label: string;
    confidence: number;
    bbox?: { x: number; y: number; width: number; height: number };
  }>;
  text?: string;
  code?: string;
  colors: Array<{ hex: string; name: string; percentage: number }>;
  metadata: {
    format: string;
    size: { width: number; height: number };
    fileSize: number;
  };
}

export interface ImageAnalysisOptions {
  extractText?: boolean;
  detectCode?: boolean;
  detectObjects?: boolean;
  analyzeColors?: boolean;
  maxDescriptionLength?: number;
}

export class ImageAnalysisService {
  private cache: Map<string, ImageAnalysisResult> = new Map();
  private readonly CACHE_TTL = 10 * 60 * 1000;

  async analyzeImage(
    imageSource: string | File | Blob,
    options?: Partial<ImageAnalysisOptions>
  ): Promise<ImageAnalysisResult> {
    const startTime = performance.now();
    
    const defaultOptions: ImageAnalysisOptions = {
      extractText: true,
      detectCode: true,
      detectObjects: true,
      analyzeColors: true,
      maxDescriptionLength: 500
    };

    const opts = { ...defaultOptions, ...options };

    logger.info('ImageAnalysis', '🖼️ Starting image analysis', {
      sourceType: typeof imageSource === 'string' ? 'url' : 'file',
      options: opts
    });

    try {
      const imageData = await this.loadImage(imageSource);
      
      if (imageData.size.width === 0 || imageData.size.height === 0) {
        throw new Error('Invalid image dimensions');
      }

      const base64Data = await this.imageToBase64(imageData.element);

      let result: ImageAnalysisResult = await this.callAIForAnalysis(base64Data, imageData, opts);

      result.metadata = {
        format: imageData.format,
        size: imageData.size,
        fileSize: imageData.fileSize
      };

      this.cache.set(this.getCacheKey(imageSource), result);

      const duration = performance.now() - startTime;
      logger.info('ImageAnalysis', '✅ Analysis complete', {
        duration: `${duration.toFixed(1)}ms`,
        hasText: !!result.text,
        hasCode: !!result.code,
        objectCount: result.objects.length
      });

      return result;

    } catch (error) {
      logger.error('ImageAnalysis', '❌ Analysis failed', error);
      
      return this.createFallbackResult(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async extractCodeFromImage(
    imageSource: string | File | Blob
  ): Promise<string> {
    try {
      const result = await this.analyzeImage(imageSource, {
        extractText: false,
        detectCode: true,
        detectObjects: false,
        analyzeColors: false
      });

      return result.code || '';
    } catch (error) {
      logger.error('ImageAnalysis', '❌ Code extraction failed', error);
      return '';
    }
  }

  async extractTextFromImage(
    imageSource: string | File | Blob
  ): Promise<string> {
    try {
      const result = await this.analyzeImage(imageSource, {
        extractText: true,
        detectCode: false,
        detectObjects: false,
        analyzeColors: false
      });

      return result.text || '';
    } catch (error) {
      logger.error('ImageAnalysis', '❌ Text extraction failed', error);
      return '';
    }
  }

  clearCache(): void {
    this.cache.clear();
    logger.info('ImageAnalysis', '🗑️  Cache cleared');
  }

  getCacheStats(): { size: number } {
    return { size: this.cache.size };
  }

  private async loadImage(source: string | File | Blob): Promise<{
    element: HTMLImageElement;
    format: string;
    size: { width: number; height: number };
    fileSize: number;
  }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        let format = 'unknown';
        let fileSize = 0;

        if (typeof source === 'string') {
          const ext = source.split('.').pop()?.toLowerCase() || '';
          format = ext;
          fileSize = 0;
        } else if (source instanceof File) {
          format = source.type.split('/')[1] || 'unknown';
          fileSize = source.size;
        } else {
          format = 'blob';
          fileSize = source.size;
        }

        resolve({
          element: img,
          format,
          size: { width: img.naturalWidth, height: img.naturalHeight },
          fileSize
        });
      };

      img.onerror = () => reject(new Error('Failed to load image'));

      if (typeof source === 'string') {
        img.src = source;
      } else if (source instanceof File || source instanceof Blob) {
        img.src = URL.createObjectURL(source);
      } else {
        reject(new Error('Invalid image source type'));
      }
    });
  }

  private imageToBase64(img: HTMLImageElement): Promise<string> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
      }

      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    });
  }

  private async callAIForAnalysis(
    base64Data: string,
    imageData: { format: string; size: { width: number; height: number }; fileSize: number },
    options: ImageAnalysisOptions
  ): Promise<ImageAnalysisResult> {
    try {
      const response = await fetch('/api/ai/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Data,
          options: {
            extract_text: options.extractText,
            detect_code: options.detectCode,
            detect_objects: options.detectObjects,
            analyze_colors: options.analyzeColors,
            max_description_length: options.maxDescriptionLength
          },
          metadata: imageData
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        description: data.description || '',
        tags: data.tags || [],
        confidence: Math.min(1, Math.max(0, data.confidence || 0)),
        objects: data.objects || [],
        text: data.text,
        code: data.code,
        colors: data.colors || [],
        metadata: {} as any
      };

    } catch (error) {
      logger.warn('ImageAnalysis', '⚠️  AI analysis unavailable, using fallback', error);
      return this.generateFallbackAnalysis(base64Data, imageData, options);
    }
  }

  private generateFallbackAnalysis(
    _base64Data: string,
    imageData: { format: string; size: { width: number; height: number }; fileSize: number },
    _options: ImageAnalysisOptions
  ): ImageAnalysisResult {
    const aspectRatio = imageData.size.width / imageData.size.height;
    
    let probableContent = 'general image';
    if (aspectRatio > 2 || aspectRatio < 0.5) {
      probableContent = 'panorama or screenshot';
    }
    if (imageData.size.height > 1000 && imageData.size.width > 1500) {
      probableContent = 'high-resolution photograph or screenshot';
    }

    return {
      description: `This appears to be a ${probableContent} (${imageData.size.width}x${imageData.size.height} pixels). Advanced AI analysis is not currently available.`,
      tags: ['image', imageData.format, probableContent],
      confidence: 0.3,
      objects: [],
      colors: [],
      metadata: {} as any
    };
  }

  private createFallbackResult(errorMessage: string): ImageAnalysisResult {
    return {
      description: `Failed to analyze image: ${errorMessage}`,
      tags: ['error'],
      confidence: 0,
      objects: [],
      colors: [],
      metadata: {
        format: 'unknown',
        size: { width: 0, height: 0 },
        fileSize: 0
      }
    };
  }

  private getCacheKey(source: string | File | Blob): string {
    if (typeof source === 'string') return source;
    if (source instanceof File) return `file-${source.name}-${source.lastModified}`;
    return `blob-${Date.now()}`;
  }
}