import { logger } from '../logger';

export interface SpeechRecognitionConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

export interface SpeechRecognitionState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  confidence: number;
  error: string | null;
}

export class SpeechRecognitionService {
  private recognition: any = null;
  private state: SpeechRecognitionState = {
    isListening: false,
    isSupported: false,
    transcript: '',
    interimTranscript: '',
    confidence: 0,
    error: null
  };

  constructor() {
    this.checkSupport();
    logger.info('SpeechRecognition', '🎤 Service initialized', { 
      supported: this.state.isSupported 
    });
  }

  getState(): SpeechRecognitionState {
    return { ...this.state };
  }

  async startListening(config?: Partial<SpeechRecognitionConfig>): Promise<void> {
    if (!this.state.isSupported) {
      throw new Error('Speech recognition not supported in this browser');
    }

    if (this.state.isListening) {
      logger.warn('SpeechRecognition', '⚠️  Already listening');
      return;
    }

    const defaultConfig: SpeechRecognitionConfig = {
      language: 'zh-CN',
      continuous: true,
      interimResults: true,
      maxAlternatives: 1,
      onResult: () => {},
      onError: (error) => console.error('Speech error:', error),
      onEnd: () => {}
    };

    const finalConfig = { ...defaultConfig, ...config };

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || 
                                 (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        throw new Error('Speech Recognition API not available');
      }

      this.recognition = new SpeechRecognition();

      this.recognition.lang = finalConfig.language;
      this.recognition.continuous = finalConfig.continuous;
      this.recognition.interimResults = finalConfig.interimResults;
      this.recognition.maxAlternatives = finalConfig.maxAlternatives;

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
            this.state.confidence = result[0].confidence;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        if (finalTranscript) {
          this.state.transcript += finalTranscript;
          finalConfig.onResult(finalTranscript, true);
        }

        if (interimTranscript) {
          this.state.interimTranscript = interimTranscript;
          finalConfig.onResult(interimTranscript, false);
        }
      };

      this.recognition.onerror = (event: any) => {
        let errorMessage = 'Unknown error';
        
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'No speech detected';
            break;
          case 'audio-capture':
            errorMessage = 'No microphone found';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone permission denied';
            break;
          case 'network':
            errorMessage = 'Network error';
            break;
          default:
            errorMessage = `Error: ${event.error}`;
        }

        this.state.error = errorMessage;
        this.state.isListening = false;
        
        finalConfig.onError(errorMessage);
        logger.error('SpeechRecognition', `❌ ${errorMessage}`);
      };

      this.recognition.onend = () => {
        this.state.isListening = false;
        finalConfig.onEnd();
        logger.info('SpeechRecognition', '⏹️  Stopped listening');
      };

      this.recognition.start();
      this.state.isListening = true;
      this.state.error = null;

      logger.info('SpeechRecognition', '🎙️ Started listening', {
        language: finalConfig.language
      });

    } catch (error) {
      this.state.error = error instanceof Error ? error.message : 'Failed to start';
      throw error;
    }
  }

  stopListening(): void {
    if (this.recognition && this.state.isListening) {
      this.recognition.stop();
      this.state.isListening = false;
      
      logger.info('SpeechRecognition', '⏹️  Stopped listening manually', {
        transcriptLength: this.state.transcript.length
      });
    }
  }

  abortListening(): void {
    if (this.recognition && this.state.isListening) {
      this.recognition.abort();
      this.state.isListening = false;
      this.state.transcript = '';
      this.state.interimTranscript = '';
      
      logger.info('SpeechRecognition', '❌ Aborted listening');
    }
  }

  clearTranscript(): void {
    this.state.transcript = '';
    this.state.interimTranscript = '';
    this.state.confidence = 0;
  }

  private checkSupport(): void {
    const hasAPI = !!(window as any).SpeechRecognition || 
                   !!(window as any).webkitSpeechRecognition;
    
    this.state.isSupported = hasAPI;

    if (!hasAPI) {
      logger.warn('SpeechRecognition', '⚠️  Speech Recognition API not supported in this browser');
    }
  }
}