import { useState, useCallback, useRef } from 'react';
import { SpeechRecognitionService } from './SpeechRecognition';
import { ImageAnalysisService, ImageAnalysisResult } from './ImageAnalysis';
import { VideoAnalysisService, VideoAnalysisResult } from './VideoAnalysis';
import { logger } from '../logger';

interface MultimodalState {
  speech: {
    isListening: boolean;
    isSupported: boolean;
    transcript: string;
    error: string | null;
  };
  image: {
    isAnalyzing: boolean;
    lastResult: ImageAnalysisResult | null;
    error: string | null;
  };
  video: {
    isAnalyzing: boolean;
    lastResult: VideoAnalysisResult | null;
    progress: number;
    error: string | null;
  };
}

interface UseMultimodalReturn extends MultimodalState {
  // Speech
  startSpeechRecognition: (language?: string) => Promise<void>;
  stopSpeechRecognition: () => void;
  clearTranscript: () => void;

  // Image
  analyzeImage: (source: string | File | Blob) => Promise<ImageAnalysisResult>;
  extractCodeFromImage: (source: string | File | Blob) => Promise<string>;
  extractTextFromImage: (source: string | File | Blob) => Promise<string>;

  // Video
  analyzeVideo: (source: string | File | Blob) => Promise<VideoAnalysisResult>;
  extractScreenshots: (source: string | File | Blob, count?: number) => Promise<Array<{ timestamp: number; imageUrl: string }>>;

  // Utilities
  clearAllCaches: () => void;
}

export function useMultimodal(): UseMultimodalReturn {
  const speechService = useRef(new SpeechRecognitionService());
  const imageService = useRef(new ImageAnalysisService());
  const videoService = useRef(new VideoAnalysisService());

  const [state, setState] = useState<MultimodalState>({
    speech: {
      isListening: false,
      isSupported: false,
      transcript: '',
      error: null
    },
    image: {
      isAnalyzing: false,
      lastResult: null,
      error: null
    },
    video: {
      isAnalyzing: false,
      lastResult: null,
      progress: 0,
      error: null
    }
  });

  // Initialize speech support check
  useState(() => {
    const speechState = speechService.current.getState();
    setState(prev => ({
      ...prev,
      speech: {
        ...prev.speech,
        isSupported: speechState.isSupported
      }
    }));
  });

  // Speech Recognition Methods
  const startSpeechRecognition = useCallback(async (language?: string) => {
    try {
      await speechService.current.startListening({
        language: language || 'zh-CN',
        onResult: (transcript, isFinal) => {
          if (isFinal) {
            setState(prev => ({
              ...prev,
              speech: {
                ...prev.speech,
                transcript: prev.speech.transcript + transcript
              }
            }));
            
            logger.info('useMultimodal', '🎤 Speech recognized', { 
              transcript: transcript.slice(0, 50),
              isFinal 
            });
          }
        },
        onError: (error) => {
          setState(prev => ({
            ...prev,
            speech: {
              ...prev.speech,
              error,
              isListening: false
            }
          }));
        },
        onEnd: () => {
          setState(prev => ({
            ...prev,
            speech: {
              ...prev.speech,
              isListening: false
            }
          }));
        }
      });

      setState(prev => ({
        ...prev,
        speech: {
          ...prev.speech,
          isListening: true,
          error: null
        }
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start speech recognition';
      
      setState(prev => ({
        ...prev,
        speech: {
          ...prev.speech,
          error: errorMessage,
          isListening: false
        }
      }));

      logger.error('useMultimodal', '❌ Speech recognition failed', error);
      throw error;
    }
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    speechService.current.stopListening();
    
    setState(prev => ({
      ...prev,
      speech: {
        ...prev.speech,
        isListening: false
      }
    }));
  }, []);

  const clearTranscript = useCallback(() => {
    speechService.current.clearTranscript();
    
    setState(prev => ({
      ...prev,
      speech: {
        ...prev.speech,
        transcript: ''
      }
    }));
  }, []);

  // Image Analysis Methods
  const analyzeImage = useCallback(async (
    source: string | File | Blob
  ): Promise<ImageAnalysisResult> => {
    try {
      setState(prev => ({
        ...prev,
        image: {
          ...prev.image,
          isAnalyzing: true,
          error: null
        }
      }));

      const result = await imageService.current.analyzeImage(source);

      setState(prev => ({
        ...prev,
        image: {
          ...prev.image,
          isAnalyzing: false,
          lastResult: result
        }
      }));

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze image';
      
      setState(prev => ({
        ...prev,
        image: {
          ...prev.image,
          isAnalyzing: false,
          error: errorMessage
        }
      }));

      throw error;
    }
  }, []);

  const extractCodeFromImage = useCallback(async (
    source: string | File | Blob
  ): Promise<string> => {
    return await imageService.current.extractCodeFromImage(source);
  }, []);

  const extractTextFromImage = useCallback(async (
    source: string | File | Blob
  ): Promise<string> => {
    return await imageService.current.extractTextFromImage(source);
  }, []);

  // Video Analysis Methods
  const analyzeVideo = useCallback(async (
    source: string | File | Blob
  ): Promise<VideoAnalysisResult> => {
    try {
      setState(prev => ({
        ...prev,
        video: {
          ...prev.video,
          isAnalyzing: true,
          progress: 0,
          error: null
        }
      }));

      const result = await videoService.current.analyzeVideo(source);

      setState(prev => ({
        ...prev,
        video: {
          ...prev.video,
          isAnalyzing: false,
          lastResult: result,
          progress: 100
        }
      }));

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze video';
      
      setState(prev => ({
        ...prev,
        video: {
          ...prev.video,
          isAnalyzing: false,
          error: errorMessage,
          progress: 0
        }
      }));

      throw error;
    }
  }, []);

  const extractScreenshots = useCallback(async (
    source: string | File | Blob,
    count?: number
  ): Promise<Array<{ timestamp: number; imageUrl: string }>> => {
    return await videoService.current.extractScreenshots(source, count);
  }, []);

  // Utility Methods
  const clearAllCaches = useCallback(() => {
    imageService.current.clearCache();
    
    logger.info('useMultimodal', '🗑️  All multimodal caches cleared');
  }, []);

  return {
    ...state,

    // Speech
    startSpeechRecognition,
    stopSpeechRecognition,
    clearTranscript,

    // Image
    analyzeImage,
    extractCodeFromImage,
    extractTextFromImage,

    // Video
    analyzeVideo,
    extractScreenshots,

    // Utilities
    clearAllCaches
  };
}