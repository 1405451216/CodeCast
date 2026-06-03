import { useState, useEffect } from 'react';

interface UseAICompletionReturn {
  enhancedVisible: boolean;
  wizardOpen: boolean;
  configured: boolean;
  setEnhancedVisible: (v: boolean) => void;
  setWizardOpen: (v: boolean) => void;
  setConfigured: (v: boolean) => void;
}

export function useAICompletion(): UseAICompletionReturn {
  const [enhancedVisible, setEnhancedVisible] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    const savedConfig = localStorage.getItem('codecast_ai_completion_config');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        if (config && config.enabled) {
          setConfigured(true);
        }
      } catch (e) {
        console.warn('Failed to parse AI completion config:', e);
      }
    }
  }, []);

  return { enhancedVisible, wizardOpen, configured, setEnhancedVisible, setWizardOpen, setConfigured };
}
