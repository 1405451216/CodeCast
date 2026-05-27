import { logger } from '../logger';

export type InputType = 'text' | 'image' | 'audio' | 'video';

export interface MultimodalInput {
  type: InputType;
  data: string | Blob | File;
  metadata?: {
    fileName?: string;
    mimeType?: string;
    language?: string;
    duration?: number;
  };
}

export interface ModelCapabilities {
  supportsText: boolean;
  supportsImage: boolean;
  supportsAudio: boolean;
  supportsVideo: boolean;
  maxInputTokens: number;
  maxImageSize: number;
  maxAudioDuration: number;
  maxVideoDuration: number;
  pricing: {
    inputPerToken: number;
    outputPerToken: number;
    imagePerToken: number;
    audioPerSecond: number;
    videoPerSecond: number;
  };
}

export interface ProcessResult {
  processedContent: string;
  usedModality: InputType;
  costEstimate: number;
  tokensUsed: number;
  modelUsed: string;
  processingTime: number;
  metadata?: {
    extractedText?: string;
    extractedCode?: string;
    transcription?: string;
    imageDescription?: string;
  };
}

export interface MultimodalConfig {
  apiKey: string;
  provider: 'openai' | 'anthropic' | 'custom';
  model: string;
  baseURL?: string;
  defaultLanguage: string;
  enableCostTracking: boolean;
}

interface ModelCapabilityProfile {
  name: string;
  capabilities: ModelCapabilities;
}

const MODEL_PROFILES: Record<string, ModelCapabilityProfile> = {
  'gpt-4o': {
    name: 'GPT-4o',
    capabilities: {
      supportsText: true,
      supportsImage: true,
      supportsAudio: false,
      supportsVideo: false,
      maxInputTokens: 128000,
      maxImageSize: 20 * 1024 * 1024,
      maxAudioDuration: 0,
      maxVideoDuration: 0,
      pricing: {
        inputPerToken: 0.0000025,
        outputPerToken: 0.00001,
        imagePerToken: 0.000085,
        audioPerSecond: 0,
        videoPerSecond: 0
      }
    }
  },
  'gpt-4o-mini': {
    name: 'GPT-4o Mini',
    capabilities: {
      supportsText: true,
      supportsImage: true,
      supportsAudio: false,
      supportsVideo: false,
      maxInputTokens: 128000,
      maxImageSize: 20 * 1024 * 1024,
      maxAudioDuration: 0,
      maxVideoDuration: 0,
      pricing: {
        inputPerToken: 0.00000015,
        outputPerToken: 0.0000006,
        imagePerToken: 0.000011,
        audioPerSecond: 0,
        videoPerSecond: 0
      }
    }
  },
  'gpt-4-turbo': {
    name: 'GPT-4 Turbo',
    capabilities: {
      supportsText: true,
      supportsImage: true,
      supportsAudio: false,
      supportsVideo: false,
      maxInputTokens: 128000,
      maxImageSize: 20 * 1024 * 1024,
      maxAudioDuration: 0,
      maxVideoDuration: 0,
      pricing: {
        inputPerToken: 0.00001,
        outputPerToken: 0.00003,
        imagePerToken: 0.000085,
        audioPerSecond: 0,
        videoPerSecond: 0
      }
    }
  },
  'claude-3-5-sonnet-20241022': {
    name: 'Claude 3.5 Sonnet',
    capabilities: {
      supportsText: true,
      supportsImage: true,
      supportsAudio: false,
      supportsVideo: false,
      maxInputTokens: 200000,
      maxImageSize: 5 * 1024 * 1024,
      maxAudioDuration: 0,
      maxVideoDuration: 0,
      pricing: {
        inputPerToken: 0.000003,
        outputPerToken: 0.000015,
        imagePerToken: 0.000065,
        audioPerSecond: 0,
        videoPerSecond: 0
      }
    }
  },
  'claude-3-opus-20240229': {
    name: 'Claude 3 Opus',
    capabilities: {
      supportsText: true,
      supportsImage: true,
      supportsAudio: false,
      supportsVideo: false,
      maxInputTokens: 200000,
      maxImageSize: 5 * 1024 * 1024,
      maxAudioDuration: 0,
      maxVideoDuration: 0,
      pricing: {
        inputPerToken: 0.000015,
        outputPerToken: 0.000075,
        imagePerToken: 0.00013,
        audioPerSecond: 0,
        videoPerSecond: 0
      }
    }
  },
  'whisper-1': {
    name: 'Whisper',
    capabilities: {
      supportsText: false,
      supportsImage: false,
      supportsAudio: true,
      supportsVideo: false,
      maxInputTokens: 0,
      maxImageSize: 0,
      maxAudioDuration: 600,
      maxVideoDuration: 0,
      pricing: {
        inputPerToken: 0,
        outputPerToken: 0,
        imagePerToken: 0,
        audioPerSecond: 0.000006,
        videoPerSecond: 0
      }
    }
  }
};

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  supportsText: true,
  supportsImage: false,
  supportsAudio: false,
  supportsVideo: false,
  maxInputTokens: 4096,
  maxImageSize: 0,
  maxAudioDuration: 0,
  maxVideoDuration: 0,
  pricing: {
    inputPerToken: 0.000001,
    outputPerToken: 0.000002,
    imagePerToken: 0,
    audioPerSecond: 0,
    videoPerSecond: 0
  }
};

export class MultimodalManager {
  private config: MultimodalConfig;
  private capabilities: ModelCapabilities;
  private costTracker: { totalCost: number; requestCount: number };

  constructor(config: MultimodalConfig) {
    this.config = config;
    this.capabilities = this.detectModelCapabilities(config.model);
    this.costTracker = { totalCost: 0, requestCount: 0 };

    logger.info('MultimodalManager', '🎭 Initialized', {
      model: config.model,
      provider: config.provider,
      capabilities: this.getSupportedModalities()
    });
  }

  getCapabilities(): ModelCapabilities {
    return { ...this.capabilities };
  }

  getSupportedModalities(): InputType[] {
    const modalities: InputType[] = [];
    
    if (this.capabilities.supportsText) modalities.push('text');
    if (this.capabilities.supportsImage) modalities.push('image');
    if (this.capabilities.supportsAudio) modalities.push('audio');
    if (this.capabilities.supportsVideo) modalities.push('video');

    return modalities;
  }

  isModalitySupported(type: InputType): boolean {
    switch (type) {
      case 'text':
        return this.capabilities.supportsText;
      case 'image':
        return this.capabilities.supportsImage;
      case 'audio':
        return this.capabilities.supportsAudio;
      case 'video':
        return this.capabilities.supportsVideo;
      default:
        return false;
    }
  }

  async processInput(input: MultimodalInput): Promise<ProcessResult> {
    const startTime = performance.now();

    if (!this.isModalitySupported(input.type)) {
      throw new Error(
        `Model ${this.config.model} does not support ${input.type} input. ` +
        `Supported modalities: ${this.getSupportedModalities().join(', ')}`
      );
    }

    logger.info('MultimodalManager', `📥 Processing ${input.type} input`);

    let result: ProcessResult;

    switch (input.type) {
      case 'text':
        result = await this.processTextInput(input);
        break;
      case 'image':
        result = await this.processImageInput(input);
        break;
      case 'audio':
        result = await this.processAudioInput(input);
        break;
      case 'video':
        result = await this.processVideoInput(input);
        break;
      default:
        throw new Error(`Unsupported input type: ${input.type}`);
    }

    result.processingTime = performance.now() - startTime;

    if (this.config.enableCostTracking) {
      this.costTracker.totalCost += result.costEstimate;
      this.costTracker.requestCount++;
    }

    logger.info('MultimodalManager', `✅ Processing complete`, {
      modality: input.type,
      cost: `$${result.costEstimate.toFixed(6)}`,
      duration: `${result.processingTime.toFixed(1)}ms`,
      tokens: result.tokensUsed
    });

    return result;
  }

  async processBatch(inputs: MultimodalInput[]): Promise<ProcessResult[]> {
    const results: ProcessResult[] = [];

    for (const input of inputs) {
      try {
        const result = await this.processInput(input);
        results.push(result);
      } catch (error) {
        logger.error('MultimodalManager', `❌ Failed to process ${input.type} input`, error);
        
        results.push({
          processedContent: '',
          usedModality: input.type,
          costEstimate: 0,
          tokensUsed: 0,
          modelUsed: this.config.model,
          processingTime: 0,
          metadata: { error: error instanceof Error ? error.message : 'Processing failed' }
        } as any);
      }
    }

    return results;
  }

  getCostSummary(): { totalCost: number; requestCount: number; averageCost: number } {
    return {
      totalCost: this.costTracker.totalCost,
      requestCount: this.costTracker.requestCount,
      averageCost: this.costTracker.requestCount > 0 
        ? this.costTracker.totalCost / this.costTracker.requestCount 
        : 0
    };
  }

  resetCostTracker(): void {
    this.costTracker = { totalCost: 0, requestCount: 0 };
  }

  updateConfig(newConfig: Partial<MultimodalConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.model && newConfig.model !== this.config.model) {
      this.capabilities = this.detectModelCapabilities(newConfig.model);
      
      logger.info('MultimodalManager', '🔄 Model updated', {
        newModel: newConfig.model,
        capabilities: this.getSupportedModalities()
      });
    }
  }

  estimateCost(type: InputType, sizeInfo?: {
    tokenCount?: number;
    imageSizeBytes?: number;
    audioDurationSeconds?: number;
    videoDurationSeconds?: number;
  }): number {
    const pricing = this.capabilities.pricing;

    switch (type) {
      case 'text':
        return (sizeInfo?.tokenCount || 1000) * pricing.inputPerToken;
      case 'image':
        return pricing.imagePerToken * Math.ceil((sizeInfo?.imageSizeBytes || 0) / 1000);
      case 'audio':
        return (sizeInfo?.audioDurationSeconds || 60) * pricing.audioPerSecond;
      case 'video':
        return (sizeInfo?.videoDurationSeconds || 30) * pricing.videoPerSecond;
      default:
        return 0;
    }
  }

  private detectModelCapabilities(model: string): ModelCapabilities {
    const normalizedModel = model.toLowerCase().trim();
    
    for (const [key, profile] of Object.entries(MODEL_PROFILES)) {
      if (normalizedModel.includes(key.toLowerCase()) || 
          key.toLowerCase().includes(normalizedModel)) {
        logger.info('MultimodalManager', `🔍 Detected model profile: ${profile.name}`);
        return { ...profile.capabilities };
      }
    }

    logger.warn('MultimodalManager', `⚠️  Unknown model '${model}', using default capabilities`);
    return { ...DEFAULT_CAPABILITIES };
  }

  private async processTextInput(input: MultimodalInput): Promise<ProcessResult> {
    const textContent = typeof input.data === 'string' 
      ? input.data 
      : await this.blobToString(input.data as Blob);

    const tokenEstimate = this.estimateTokens(textContent);

    return {
      processedContent: textContent,
      usedModality: 'text',
      costEstimate: this.estimateCost('text', { tokenCount: tokenEstimate }),
      tokensUsed: tokenEstimate,
      modelUsed: this.config.model,
      processingTime: performance.now() - (Date.now() - tokenEstimate)
    };
  }

  private async processImageInput(input: MultimodalInput): Promise<ProcessResult> {
    let imageData: Blob;

    if (typeof input.data === 'string') {
      const response = await fetch(input.data);
      imageData = await response.blob();
    } else if (input.data instanceof File) {
      imageData = input.data;
    } else {
      imageData = input.data as Blob;
    }

    if (imageData.size > this.capabilities.maxImageSize) {
      throw new Error(
        `Image size (${(imageData.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size ` +
        `(${(this.capabilities.maxImageSize / 1024 / 1024).toFixed(2)}MB)`
      );
    }

    try {
      const base64Data = await this.blobToBase64(imageData);

      const response = await this.callVisionAPI(base64Data, input.metadata?.mimeType || imageData.type);

      const tokenEstimate = this.estimateTokens(response.description || '');

      return {
        processedContent: response.description || '',
        usedModality: 'image',
        costEstimate: this.estimateCost('image', { imageSizeBytes: imageData.size }) +
                      (tokenEstimate * this.capabilities.pricing.outputPerToken),
        tokensUsed: tokenEstimate,
        modelUsed: this.config.model,
        processingTime: performance.now() - Date.now(),
        metadata: {
          extractedText: response.text,
          extractedCode: response.code,
          imageDescription: response.description
        }
      };
    } catch (error) {
      logger.error('MultimodalManager', '❌ Image processing failed', error);
      throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processAudioInput(input: MultimodalInput): Promise<ProcessResult> {
    let audioData: Blob;

    if (typeof input.data === 'string') {
      const response = await fetch(input.data);
      audioData = await response.blob();
    } else if (input.data instanceof File) {
      audioData = input.data;
    } else {
      audioData = input.data as Blob;
    }

    const duration = input.metadata?.duration || await this.estimateAudioDuration(audioData);

    if (duration > this.capabilities.maxAudioDuration) {
      throw new Error(
        `Audio duration (${duration}s) exceeds maximum allowed duration (${this.capabilities.maxAudioDuration}s)`
      );
    }

    try {
      const transcription = await this.callWhisperAPI(audioData);

      const tokenEstimate = this.estimateTokens(transcription);

      return {
        processedContent: transcription,
        usedModality: 'audio',
        costEstimate: this.estimateCost('audio', { audioDurationSeconds: duration }),
        tokensUsed: tokenEstimate,
        modelUsed: this.config.model,
        processingTime: performance.now() - Date.now(),
        metadata: {
          transcription
        }
      };
    } catch (error) {
      logger.error('MultimodalManager', '❌ Audio processing failed', error);
      throw new Error(`Failed to process audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processVideoInput(input: MultimodalInput): Promise<ProcessResult> {
    if (!this.capabilities.supportsVideo) {
      throw new Error('Video processing requires a model with video support. Consider extracting frames and processing as images.');
    }

    let videoData: Blob;

    if (typeof input.data === 'string') {
      const response = await fetch(input.data);
      videoData = await response.blob();
    } else if (input.data instanceof File) {
      videoData = input.data;
    } else {
      videoData = input.data as Blob;
    }

    const duration = input.metadata?.duration || 30;

    if (duration > this.capabilities.maxVideoDuration) {
      throw new Error(
        `Video duration (${duration}s) exceeds maximum allowed duration (${this.capabilities.maxVideoDuration}s)`
      );
    }

    try {
      const result = await this.callVideoAnalysisAPI(videoData, duration);

      const tokenEstimate = this.estimateTokens(result.summary || '');

      return {
        processedContent: result.summary || '',
        usedModality: 'video',
        costEstimate: this.estimateCost('video', { videoDurationSeconds: duration }),
        tokensUsed: tokenEstimate,
        modelUsed: this.config.model,
        processingTime: performance.now() - Date.now(),
        metadata: {
          extractedText: result.extractedText?.join('\n'),
          extractedCode: result.extractedCode?.join('\n')
        }
      };
    } catch (error) {
      logger.error('MultimodalManager', '❌ Video processing failed', error);
      throw new Error(`Failed to process video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async callVisionAPI(
    base64Image: string, 
    mimeType: string
  ): Promise<{ description: string; text?: string; code?: string }> {
    const endpoint = this.config.provider === 'anthropic'
      ? `${this.config.baseURL || 'https://api.anthropic.com'}/v1/messages`
      : `${this.config.baseURL || 'https://api.openai.com'}/v1/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.provider === 'anthropic') {
      headers['x-api-key'] = this.config.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    let body: any;

    if (this.config.provider === 'anthropic') {
      body = {
        model: this.config.model,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Image
              }
            },
            {
              type: 'text',
              text: 'Analyze this image. Extract any visible text or code. Provide a detailed description.'
            }
          ]
        }]
      };
    } else {
      body = {
        model: this.config.model,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            },
            {
              type: 'text',
              text: 'Analyze this image. Extract any visible text or code. Provide a detailed description.'
            }
          ]
        }]
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Vision API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();

    if (this.config.provider === 'anthropic') {
      const textContent = data.content?.[0]?.text || '';
      return this.parseVisionResponse(textContent);
    } else {
      const textContent = data.choices?.[0]?.message?.content || '';
      return this.parseVisionResponse(textContent);
    }
  }

  private async callWhisperAPI(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', this.config.defaultLanguage || 'zh');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Whisper API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    return data.text || '';
  }

  private async callVideoAnalysisAPI(_videoBlob: Blob, _duration: number): Promise<{
    summary: string;
    extractedText?: string[];
    extractedCode?: string[];
  }> {
    throw new Error('Direct video analysis not implemented. Use VideoAnalysisService for frame-by-frame processing.');
  }

  private parseVisionResponse(text: string): { description: string; text?: string; code?: string } {
    const codeMatch = text.match(/```[\w]*\n([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1].trim() : undefined;

    const textWithoutCode = text.replace(/```[\w]*\n[\s\S]*?```/g, '').trim();

    return {
      description: textWithoutCode,
      text: textWithoutCode.length > 500 ? textWithoutCode.slice(0, 500) + '...' : textWithoutCode,
      code
    };
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = () => reject(new Error('Failed to convert blob to base64'));
      reader.readAsDataURL(blob);
    });
  }

  private async blobToString(blob: Blob): Promise<string> {
    return blob.text();
  }

  private async estimateAudioDuration(blob: Blob): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.onloadedmetadata = () => resolve(audio.duration);
      audio.onerror = () => resolve(60);
      audio.src = URL.createObjectURL(blob);
    });
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
