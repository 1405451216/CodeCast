import { ImageAnalysisService } from './ImageAnalysis';
import { logger } from '../logger';

export interface VideoFrame {
  timestamp: number;
  imageData: string; // base64
  duration: number;
}

export interface VideoAnalysisResult {
  duration: number;
  frameCount: number;
  fps: number;
  resolution: { width: number; height: number };
  frames: Array<{
    timestamp: number;
    analysis: any;
    keyFrame: boolean;
  }>;
  summary: string;
  detectedScenes: Array<{
    start: number;
    end: number;
    description: string;
    type: 'scene-change' | 'action' | 'dialogue' | 'text' | 'code';
  }>;
  extractedText: string[];
  extractedCode: string[];
  metadata: {
    format: string;
    codec?: string;
    bitrate?: number;
    audioTracks?: number;
  };
}

export interface VideoAnalysisOptions {
  maxFrames?: number;
  frameInterval?: number; // seconds between frames
  extractKeyFramesOnly?: boolean;
  analyzeContent?: boolean;
  extractText?: boolean;
  extractCode?: boolean;
  maxDuration?: number; // max video length to analyze (seconds)
}

export class VideoAnalysisService {
  private imageAnalysisService: ImageAnalysisService;

  constructor() {
    this.imageAnalysisService = new ImageAnalysisService();
    
    logger.info('VideoAnalysis', '🎬 Service initialized');
  }

  async analyzeVideo(
    videoSource: string | File | Blob,
    options?: Partial<VideoAnalysisOptions>
  ): Promise<VideoAnalysisResult> {
    const startTime = performance.now();

    const defaultOptions: VideoAnalysisOptions = {
      maxFrames: 30,
      frameInterval: 2,
      extractKeyFramesOnly: false,
      analyzeContent: true,
      extractText: true,
      extractCode: true,
      maxDuration: 300 // 5 minutes max
    };

    const opts = { ...defaultOptions, ...options };

    logger.info('VideoAnalysis', '🎬 Starting video analysis', {
      sourceType: typeof videoSource === 'string' ? 'url' : 'file',
      options: opts
    });

    try {
      const videoElement = await this.loadVideo(videoSource);
      
      if (videoElement.duration > opts.maxDuration!) {
        logger.warn('VideoAnalysis', `⚠️  Video exceeds max duration (${videoElement.duration}s > ${opts.maxDuration}s)`);
      }

      const frames = await this.extractFrames(videoElement, opts);
      
      let analyzedFrames: VideoAnalysisResult['frames'] = [];
      let allExtractedText: string[] = [];
      let allExtractedCode: string[] = [];

      if (opts.analyzeContent && frames.length > 0) {
        logger.info('VideoAnalysis', `📊 Analyzing ${frames.length} frames...`);
        
        analyzedFrames = await Promise.all(
          frames.map(async (frame, index) => {
            try {
              const imageBlob = this.base64ToBlob(frame.imageData);
              const analysis = await this.imageAnalysisService.analyzeImage(imageBlob, {
                extractText: opts.extractText,
                detectCode: opts.extractCode,
                detectObjects: false,
                analyzeColors: false
              });

              if (analysis.text) {
                allExtractedText.push(`[${frame.timestamp.toFixed(1)}s] ${analysis.text}`);
              }
              
              if (analysis.code) {
                allExtractedCode.push(`[${frame.timestamp.toFixed(1)}s]\n${analysis.code}`);
              }

              return {
                timestamp: frame.timestamp,
                analysis,
                keyFrame: index % Math.max(1, Math.floor(frames.length / 10)) === 0
              };
            } catch (error) {
              return {
                timestamp: frame.timestamp,
                analysis: null,
                keyFrame: false
              };
            }
          })
        );
      }

      const detectedScenes = this.detectSceneChanges(analyzedFrames);
      const summary = this.generateSummary(analyzedFrames, detectedScenes);

      const result: VideoAnalysisResult = {
        duration: videoElement.duration,
        frameCount: frames.length,
        fps: 30,
        resolution: { 
          width: videoElement.videoWidth, 
          height: videoElement.videoHeight 
        },
        frames: analyzedFrames,
        summary,
        detectedScenes,
        extractedText: allExtractedText,
        extractedCode: allExtractedCode,
        metadata: {
          format: 'unknown',
          audioTracks: 0
        }
      };

      URL.revokeObjectURL(videoElement.src);

      const duration = performance.now() - startTime;
      logger.info('VideoAnalysis', '✅ Analysis complete', {
        duration: `${duration.toFixed(1)}ms`,
        totalFrames: frames.length,
        scenesDetected: detectedScenes.length,
        textSegments: allExtractedText.length,
        codeSegments: allExtractedCode.length
      });

      return result;

    } catch (error) {
      logger.error('VideoAnalysis', '❌ Analysis failed', error);
      throw error;
    }
  }

  async extractScreenshots(
    videoSource: string | File | Blob,
    count: number = 5
  ): Promise<Array<{ timestamp: number; imageUrl: string }>> {
    try {
      const videoElement = await this.loadVideo(videoSource);
      const interval = videoElement.duration / count;
      const screenshots: Array<{ timestamp: number; imageUrl: string }> = [];

      for (let i = 0; i < count; i++) {
        const timestamp = interval * i;
        videoElement.currentTime = timestamp;
        
        await new Promise(resolve => {
          videoElement.onseeked = resolve;
        });

        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoElement, 0, 0);
        }

        screenshots.push({
          timestamp,
          imageUrl: canvas.toDataURL('image/jpeg', 0.8)
        });
      }

      URL.revokeObjectURL(videoElement.src);
      
      return screenshots;

    } catch (error) {
      logger.error('VideoAnalysis', '❌ Screenshot extraction failed', error);
      return [];
    }
  }

  async extractAudioWaveform(
    videoSource: string | File | Blob
  ): Promise<Array<{ time: number; amplitude: number }>> {
    try {
      const response = await fetch('/api/ai/video-audio', {
        method: 'POST',
        body: await this.createFormData(videoSource)
      });

      if (!response.ok) throw new Error('API error');

      const data = await response.json();
      return data.waveform || [];

    } catch (error) {
      logger.warn('VideoAnalysis', '⚠️  Audio waveform extraction not available', error);
      return [];
    }
  }

  private async loadVideo(source: string | File | Blob): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.crossOrigin = 'anonymous';

      video.onloadedmetadata = () => resolve(video);
      video.onerror = () => reject(new Error('Failed to load video'));

      if (typeof source === 'string') {
        video.src = source;
      } else {
        video.src = URL.createObjectURL(source);
      }
    });
  }

  private async extractFrames(
    video: HTMLVideoElement,
    options: VideoAnalysisOptions
  ): Promise<VideoFrame[]> {
    const frames: VideoFrame[] = [];
    const duration = Math.min(video.duration, options.maxDuration || 300);
    const interval = options.frameInterval || 2;
    const maxFrames = options.maxFrames || 30;
    
    const totalFrames = Math.min(Math.floor(duration / interval), maxFrames);

    for (let i = 0; i < totalFrames; i++) {
      const timestamp = i * interval;
      
      try {
        video.currentTime = timestamp;
        
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Seek timeout')), 5000);
          
          video.onseeked = () => {
            clearTimeout(timeout);
            resolve();
          };
          
          video.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Video seek error'));
          };
        });

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];

        frames.push({
          timestamp,
          imageData: base64Data,
          duration: video.duration
        });

      } catch (error) {
        logger.warn('VideoAnalysis', `⚠️  Failed to extract frame at ${timestamp}s`, error);
      }
    }

    return frames;
  }

  private detectSceneChanges(
    frames: VideoAnalysisResult['frames']
  ): VideoAnalysisResult['detectedScenes'] {
    const scenes: VideoAnalysisResult['detectedScenes'] = [];

    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1];
      const curr = frames[i];

      if (!prev.analysis || !curr.analysis) continue;

      const tagsChanged = 
        JSON.stringify(prev.analysis.tags) !== JSON.stringify(curr.analysis.tags);
      
      const textAppeared = !prev.analysis.text && curr.analysis.text;
      const codeAppeared = !prev.analysis.code && curr.analysis.code;

      if (tagsChanged || textAppeared || codeAppeared) {
        let type: VideoAnalysisResult['detectedScenes'][0]['type'] = 'scene-change';
        let description = 'Scene change detected';

        if (textAppeared) {
          type = 'text';
          description = 'Text content appeared';
        } else if (codeAppeared) {
          type = 'code';
          description = 'Code snippet visible';
        }

        scenes.push({
          start: prev.timestamp,
          end: curr.timestamp,
          description,
          type
        });
      }
    }

    return scenes;
  }

  private generateSummary(
    frames: VideoAnalysisResult['frames'],
    scenes: VideoAnalysisResult['detectedScenes']
  ): string {
    if (frames.length === 0) {
      return 'No frames were successfully analyzed.';
    }

    const parts: string[] = [];
    
    parts.push(`Analyzed ${frames.length} frames from the video.`);

    if (scenes.length > 0) {
      parts.push(`Detected ${scenes.length} scene changes or content transitions.`);
      
      const codeScenes = scenes.filter(s => s.type === 'code');
      const textScenes = scenes.filter(s => s.type === 'text');
      
      if (codeScenes.length > 0) {
        parts.push(`${codeScenes.length} segments contain code snippets.`);
      }
      if (textScenes.length > 0) {
        parts.push(`${textScenes.length} segments contain readable text.`);
      }
    }

    const framesWithContent = frames.filter(f => f.analysis?.description);
    if (framesWithContent.length > 0) {
      parts.push(`${framesWithContent.length} frames contained identifiable visual content.`);
    }

    return parts.join(' ');
  }

  private base64ToBlob(base64: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'image/jpeg' });
  }

  private async createFormData(source: string | File | Blob): Promise<FormData> {
    const formData = new FormData();
    
    if (typeof source === 'string') {
      const response = await fetch(source);
      const blob = await response.blob();
      formData.append('video', blob, 'video.mp4');
    } else {
      formData.append('video', source instanceof File ? source : new Blob([source]), 'video.mp4');
    }
    
    return formData;
  }
}