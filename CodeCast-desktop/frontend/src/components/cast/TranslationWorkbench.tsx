import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { LanguageCode, TranslationStyle } from '../../types/cast-types';
import { LANGUAGES, TRANSLATION_STYLES } from '../../types/cast-types';
import { translate, detectLanguage, saveToHistory, getTranslationHistory } from '../../utils/cast/translation-engine';
import { saveCastMemory, autoSaveCastInteraction } from '../../utils/cast/cast-memory-bridge';
import FileImportExportBar from './FileImportExportBar';
import { castFS } from '../../utils/cast/cast-fs-api';

const TranslationWorkbench: React.FC = () => {
  const [sourceLang, setSourceLang] = useState<LanguageCode>('zh');
  const [targetLang, setTargetLang] = useState<LanguageCode>('en');
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [translationStyle, setTranslationStyle] = useState<TranslationStyle>('free');
  const [isTranslating, setIsTranslating] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'stacked'>('split');
  const [confidence, setConfidence] = useState(0);
  const [autoTranslate, setAutoTranslate] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const sourceLangInfo = LANGUAGES.find(l => l.code === sourceLang);
  const targetLangInfo = LANGUAGES.find(l => l.code === targetLang);

  const handleSwapLanguages = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  }, [sourceLang, targetLang, sourceText, translatedText]);

  const handleTranslate = useCallback(async (text?: string) => {
    const textToTranslate = text || sourceText;
    if (!textToTranslate.trim()) return;
    if (isTranslating) return;

    setIsTranslating(true);
    setTranslatedText('');
    abortRef.current = new AbortController();

    try {
      const result = await translate(
        {
          sourceText: textToTranslate,
          sourceLang,
          targetLang,
          style: translationStyle
        },
        (chunk) => {
          setTranslatedText(prev => prev + chunk);
        }
      );

      if (!translatedText || !translatedText.length) {
        setTranslatedText(result.translatedText);
      }
      setConfidence(result.confidence);

      saveToHistory({
        sourceText: textToTranslate,
        translatedText: result.translatedText,
        sourceLang,
        targetLang,
        style: translationStyle
      });

      autoSaveCastInteraction({
        userMessage: textToTranslate.slice(0, 100),
        aiResponse: `${sourceLang}→${targetLang}: ${result.translatedText.slice(0, 100)}`,
        panel: 'translate',
        actionType: 'translate'
      }).catch(() => {});
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('[TranslationWorkbench] Translate failed:', error);
        setTranslatedText('❌ 翻译失败: ' + error.message);
      }
    } finally {
      setIsTranslating(false);
      abortRef.current = null;
    }
  }, [sourceText, sourceLang, targetLang, translationStyle, isTranslating]);

  const handleStopTranslate = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      setIsTranslating(false);
    }
  }, []);

  useEffect(() => {
    if (!autoTranslate || !sourceText.trim() || isTranslating) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleTranslate();
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sourceText, autoTranslate, handleTranslate, isTranslating]);

  const handlePasteAndDetect = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setSourceText(text);
        const detected = detectLanguage(text);
        if (detected !== sourceLang) {
          setSourceLang(detected);
        }
      }
    } catch {}
  }, [sourceLang]);

  const handleBatchExport = useCallback(() => {
    if (!translatedText.trim()) return;
    const sourceInfo = LANGUAGES.find(l => l.code === sourceLang);
    const targetInfo = LANGUAGES.find(l => l.code === targetLang);
    const filename = `translation_${sourceInfo?.name || sourceLang}_to_${targetInfo?.name || targetLang}_${new Date().toISOString().split('T')[0]}.txt`;
    const exportContent = `Translation Export\n====================\nSource Language: ${sourceInfo?.nativeName || sourceLang}\nTarget Language: ${targetInfo?.nativeName || targetLang}\nStyle: ${translationStyle}\nDate: ${new Date().toISOString()}\n\n--- Source Text ---\n${sourceText}\n\n--- Translated Text ---\n${translatedText}`;
    castFS.exportAsFile(exportContent, filename, 'text/plain').catch(console.error);
  }, [translatedText, sourceText, sourceLang, targetLang, translationStyle]);

  return (
    <div className="cast-panel-container">
      <div className="cast-toolbar">
        <div className="cast-toolbar-group">
          <select className="cast-toolbar-select" value={sourceLang} onChange={(e) => setSourceLang(e.target.value as LanguageCode)}>
            {LANGUAGES.map(l => (<option key={l.code} value={l.code}>{l.nativeName} ({l.name})</option>))}
          </select>

          <button className="cast-toolbar-btn" onClick={handleSwapLanguages} title="交换语言">↔️</button>

          <select className="cast-toolbar-select" value={targetLang} onChange={(e) => setTargetLang(e.target.value as LanguageCode)}>
            {LANGUAGES.map(l => (<option key={l.code} value={l.code}>{l.nativeName} ({l.name})</option>))}
          </select>
        </div>

        <div className="cast-toolbar-divider" />

        <div className="cast-toolbar-group">
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>🎤 风格:</span>
          {TRANSLATION_STYLES.map(s => (
            <button key={s.key} className={`cast-toolbar-btn ${translationStyle === s.key ? 'active' : ''}`} onClick={() => setTranslationStyle(s.key)} title={s.desc}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="cast-toolbar-divider" />

        <div className="cast-toolbar-group">
          <button
            className={`cast-toolbar-btn active`}
            onClick={() => handleTranslate()}
            disabled={isTranslating || !sourceText.trim()}
          >
            {isTranslating ? '⏳ 翻译中...' : '🌐 翻译'}
          </button>
          {isTranslating && (
            <button className="cast-toolbar-btn" onClick={handleStopTranslate} style={{ borderColor: '#ef4444', color: '#ef4444' }}>⏹ 停止</button>
          )}
          <button className="cast-toolbar-btn" onClick={handlePasteAndDetect}>📋 粘贴检测</button>
          <button className={`cast-toolbar-btn ${autoTranslate ? 'active' : ''}`} onClick={() => setAutoTranslate(!autoTranslate)}>
            {autoTranslate ? '🔵 自动' : '⚪ 自动'}
          </button>
          <button className={`cast-toolbar-btn ${viewMode === 'split' ? 'active' : ''}`} onClick={() => setViewMode(viewMode === 'split' ? 'stacked' : 'split')}>
            {viewMode === 'split' ? '🗀 分屏' : '📚 上下'}
          </button>
          <FileImportExportBar mode="export" onExport={handleBatchExport} exportFilename="translation_export.txt" compact />
        </div>
      </div>

      <div className="cast-stat-bar">
        <span className="cast-stat-item">源文本: <span className="cast-stat-value">{sourceText.length}</span> 字符</span>
        <span className="cast-stat-item">译文: <span className="cast-stat-value">{translatedText.length}</span> 字符</span>
        {confidence > 0 && (
          <span className="cast-stat-item cast-tag-green">
            置信度: <span className="cast-stat-value">{confidence}%</span>
          </span>
        )}
        {autoTranslate && (
          <span className="cast-stat-item cast-tag-blue">🔄 实时翻译已开启</span>
        )}
      </div>

      <div className={viewMode === 'split' ? 'cast-split-view' : ''}>
        <div className={viewMode === 'split' ? 'cast-split-pane' : ''}>
          <div className="cast-split-pane-header">
            📦 源文本 ({sourceLangInfo?.nativeName})
            <span style={{ opacity: 0.6 }}>{sourceText.length} 字符</span>
          </div>
          <div className="cast-editor-area" style={viewMode !== 'split' ? { height: '200px' } : undefined}>
            <textarea
              className="cast-editor-textarea"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder={`输入要翻译的${sourceLangInfo?.nativeName}文本...（开启自动模式后输入即译）`}
            />
          </div>
        </div>

        <div className={viewMode === 'split' ? 'cast-split-pane' : ''}>
          <div className="cast-split-pane-header" style={{ borderColor: '#10b981' }}>
            ✨ 翻译结果 ({targetLangInfo?.nativeName})
            {isTranslating && <span style={{ color: '#c084fc' }}>翻译中...</span>}
            <span style={{ opacity: 0.6 }}>{translatedText.length} 字符</span>
          </div>
          <div className="cast-editor-area" style={viewMode !== 'split' ? { height: '200px' } : undefined}>
            {translatedText && translatedText.startsWith('❌') ? (
              <div className="cast-preview-area" style={{ padding: '14px', color: '#ef4444' }}>
                {translatedText}
              </div>
            ) : translatedText ? (
              <div className="cast-preview-area" style={{ padding: '14px' }}>
                {translatedText.split('\n').map((line, i) => (
                  <p key={i} style={{ margin: '4px 0' }}>{line || '\u00A0'}</p>
                ))}
                {isTranslating && <span style={{ animation: 'blink 1s infinite', color: '#10b981' }}>▊</span>}
              </div>
            ) : (
              <div className="cast-empty-state" style={{ padding: '20px' }}>
                <div className="cast-empty-icon">🌐</div>
                <h4>{autoTranslate ? '等待输入...' : '等待翻译'}</h4>
                <p>{autoTranslate ? '在左侧输入文本将自动翻译' : '在左侧输入文本后点击 "翻译"'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(TranslationWorkbench);
