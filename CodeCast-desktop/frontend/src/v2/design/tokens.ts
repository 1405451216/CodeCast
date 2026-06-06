// frontend/src/v2/design/tokens.ts
export type ThemeTokens = {
  bg: string; bgSub: string; surface: string;
  border: string; borderStrong: string;
  text: string; textSub: string; textMute: string;
  accent: string; accentBg: string; accentText: string;
  success: string; warn: string; danger: string;
};

export const light: ThemeTokens = {
  bg: '#FAF9F5',
  bgSub: '#F2F0E9',
  surface: '#FFFFFF',
  border: '#E5E3DD',
  borderStrong: '#D6D3C9',
  text: '#1F1E1B',
  textSub: '#6B6862',
  textMute: '#9A968D',
  accent: '#DA7756',
  accentBg: '#F5E5DC',
  accentText: '#8C3A1A',
  success: '#3A8266',
  warn: '#C4923C',
  danger: '#C4533C',
};

export const dark: ThemeTokens = {
  bg: '#1B1A17',
  bgSub: '#26241F',
  surface: '#1F1E1B',
  border: '#2E2C27',
  borderStrong: '#3A3832',
  text: '#F0EEE5',
  textSub: '#B5B0A4',
  textMute: '#7A766C',
  accent: '#E08766',
  accentBg: '#3A2A22',
  accentText: '#F0B097',
  success: '#5A9D80',
  warn: '#D4A65A',
  danger: '#D86A52',
};

export const radius = { sm: '4px', md: '6px', lg: '8px' } as const;
export const shadow = 'none';
export const font = {
  serif: '"IBM Plex Serif", Georgia, serif',
  sans: '"IBM Plex Sans", "PingFang SC", -apple-system, system-ui, sans-serif',
  mono: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
} as const;
