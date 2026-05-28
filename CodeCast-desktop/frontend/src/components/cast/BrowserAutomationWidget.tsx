import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CastBrowserEngine } from '../../utils/cast/cast-browser-engine';
import type {
  BrowserPageInfo,
  BrowserScrapeResult,
  BrowserScreenshot,
  BrowserFormData,
  BrowserEvent
} from '../../utils/cast/cast-browser-engine';

interface BrowserAutomationWidgetProps {
  onClose: () => void;
}

type ActiveTab = 'preview' | 'result' | 'settings';

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  cdp: { label: 'CDP 直连', color: '#10b981', icon: '(CDP)' },
  simulation: { label: '模拟模式', color: '#f59e0b', icon: '(SIM)' },
  unavailable: { label: '不可用', color: '#ef4444', icon: '(OFF)' }
};

const BrowserAutomationWidget: React.FC<BrowserAutomationWidgetProps> = ({ onClose }) => {
  const [urlInput, setUrlInput] = useState('');
  const [pageInfo, setPageInfo] = useState<BrowserPageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('preview');
  const [screenshot, setScreenshot] = useState<BrowserScreenshot | null>(null);
  const [scrapeResult, setScrapeResult] = useState<BrowserScrapeResult | null>(null);
  const [selectorInput, setSelectorInput] = useState('');
  const [valueInput, setValueInput] = useState('');
  const [jsScript, setJsScript] = useState('');
  const [resultText, setResultText] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [allowedDomains, setAllowedDomains] = useState<string[]>(() => CastBrowserEngine.getAllowedDomains());
  const [engineMode, setEngineMode] = useState(CastBrowserEngine.getStatus().method);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEngineMode(CastBrowserEngine.getStatus().method);
    const unsub = CastBrowserEngine.on('navigated', (e: BrowserEvent) => addLog(`navigated: ${e.url}`));
    const unsub2 = CastBrowserEngine.on('loaded', (e: BrowserEvent) => addLog(`loaded: ${e.url}`));
    const unsub3 = CastBrowserEngine.on('error', (e: BrowserEvent) => addLog(`error: ${e.message}`));
    return () => { unsub(); unsub2(); unsub3(); };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [eventLog]);

  const addLog = useCallback((msg: string) => {
    setEventLog(prev => [...prev.slice(-50), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const handleNavigate = useCallback(async () => {
    let targetUrl = urlInput.trim();
    if (!targetUrl) return;

    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
      setUrlInput(targetUrl);
    }

    setIsLoading(true);
    setScrapeResult(null);
    setScreenshot(null);
    setResultText('');

    try {
      const info = await CastBrowserEngine.navigate(targetUrl, { timeout: 15000 });
      setPageInfo(info);
      addLog(`Navigated to: ${info.title || info.url}`);
    } catch (error: any) {
      setResultText('Error: ' + error.message);
      addLog(`Navigate failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [urlInput, addLog]);

  const handleScrape = useCallback(async () => {
    if (!CastBrowserEngine.isAvailable()) return;

    setIsLoading(true);
    try {
      const result = await CastBrowserEngine.scrape({
        includeHtml: false,
        includeLinks: true,
        includeImages: true,
        includeForms: true
      });
      setScrapeResult(result);
      setActiveTab('result');
      setResultText(`Scraped: ${result.title}\nText: ${result.content.text.slice(0, 500)}...\nLinks: ${result.content.links.length} | Images: ${result.content.images.length} | Forms: ${result.content.forms.length}`);
      addLog(`Scrape complete: ${result.content.links.length} links, ${result.content.images.length} images`);
    } catch (error: any) {
      setResultText('Scrape Error: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [addLog]);

  const handleScreenshot = useCallback(async () => {
    if (!CastBrowserEngine.isAvailable()) return;

    setIsLoading(true);
    try {
      const shot = await CastBrowserEngine.screenshot();
      setScreenshot(shot);
      if (shot.dataUrl) {
        setActiveTab('preview');
        addLog('Screenshot captured');
      } else {
        setResultText('Screenshot not available in simulation mode. CDP backend required for real screenshots.');
      }
    } catch (error: any) {
      setResultText('Screenshot Error: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [addLog]);

  const handleExtractLinks = useCallback(() => {
    if (!scrapeResult) return;
    const links = scrapeResult.content.links.map((l, i) => `${i + 1}. ${l.text} -> ${l.href}`).join('\n');
    setResultText(`Extracted ${scrapeResult.content.links.length} links:\n\n${links}`);
    setActiveTab('result');
  }, [scrapeResult]);

  const handleFindElement = useCallback(async () => {
    if (!selectorInput.trim()) return;
    setIsLoading(true);
    try {
      const elements = await CastBrowserEngine.findElements(selectorInput);
      setResultText(elements.length > 0
        ? `Found ${elements.length} element(s):\n${elements.map(e => `  <${e.tag}> "${e.text}" [visible=${e.visible}, clickable=${e.clickable}, editable=${e.editable}]`).join('\n')}`
        : `No elements found for selector: ${selectorInput}`
      );
      setActiveTab('result');
    } catch (error: any) {
      setResultText('Error: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectorInput]);

  const handleClickElement = useCallback(async () => {
    if (!selectorInput.trim()) return;
    setIsLoading(true);
    try {
      const ok = await CastBrowserEngine.click(selectorInput);
      setResultText(ok ? `Clicked: ${selectorInput}` : `Click failed: ${selectorInput}`);
      addLog(`Click: ${selectorInput}`);
    } catch (error: any) {
      setResultText('Click Error: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectorInput, addLog]);

  const handleFillElement = useCallback(async () => {
    if (!selectorInput.trim()) return;
    setIsLoading(true);
    try {
      const ok = await CastBrowserEngine.fill(selectorInput, valueInput);
      setResultText(ok ? `Filled "${valueInput}" into: ${selectorInput}` : 'Fill failed');
      addLog(`Fill: ${selectorInput} = ${valueInput}`);
    } catch (error: any) {
      setResultText('Fill Error: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectorInput, valueInput, addLog]);

  const handleRunJS = useCallback(async () => {
    if (!jsScript.trim()) return;
    setIsLoading(true);
    try {
      const result = await CastBrowserEngine.evaluate(jsScript);
      setResultText(typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result));
      addLog(`JS executed successfully`);
    } catch (error: any) {
      setResultText('JS Error: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [jsScript, addLog]);

  const handleCopyText = useCallback(() => {
    if (!resultText) return;
    navigator.clipboard.writeText(resultText).then(() => {
      addLog('Copied to clipboard');
    });
  }, [resultText, addLog]);

  const handleAddDomain = useCallback(() => {
    const domain = domainInput.trim().toLowerCase().replace(/^https?:\/\//, '');
    if (!domain) return;
    const updated = [...allowedDomains, domain];
    CastBrowserEngine.setAllowedDomains(updated);
    setAllowedDomains(updated);
    setDomainInput('');
    addLog(`Added domain to allowlist: ${domain}`);
  }, [domainInput, allowedDomains, addLog]);

  const handleRemoveDomain = useCallback((domain: string) => {
    const updated = allowedDomains.filter(d => d !== domain);
    CastBrowserEngine.setAllowedDomains(updated);
    setAllowedDomains(updated);
    addLog(`Removed domain from allowlist: ${domain}`);
  }, [allowedDomains, addLog]);

  const statusInfo = STATUS_LABELS[engineMode] || STATUS_LABELS.unavailable;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>GLOBE</span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Browser Automation</span>
          <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: `${statusInfo.color}22`, color: statusInfo.color }}>
            {statusInfo.icon}
          </span>
        </div>
        <button className="cast-toolbar-btn" onClick={onClose}>X</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* URL Bar */}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleNavigate()}
            placeholder="Enter URL (e.g., example.com)"
            style={{
              flex: 1, padding: '7px 12px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              borderRadius: 6, fontSize: 12, outline: 'none'
            }}
          />
          <button
            className={`cast-toolbar-btn ${urlInput.trim() ? 'active' : ''}`}
            onClick={handleNavigate}
            disabled={!urlInput.trim() || isLoading}
            style={{ whiteSpace: 'nowrap', fontSize: 12 }}
          >
            {isLoading ? '...' : 'GO'}
          </button>
        </div>

        {/* Page Info Card */}
        {(pageInfo || scrapeResult) && (
          <div className="cast-preview-area" style={{ borderRadius: 8, padding: 12, background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pageInfo?.title || scrapeResult?.title || 'No title'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pageInfo?.url || scrapeResult?.url || ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, marginLeft: 8, flexShrink: 0 }}>
                <button className="cast-toolbar-btn" onClick={() => CastBrowserEngine.goBack().then(setPageInfo)} disabled={!pageInfo?.canGoBack} style={{ fontSize: 11, padding: '4px 8px' }}>BACK</button>
                <button className="cast-toolbar-btn" onClick={() => CastBrowserEngine.goForward().then(setPageInfo)} disabled={!pageInfo?.canGoForward} style={{ fontSize: 11, padding: '4px 8px' }}>FWD</button>
              </div>
            </div>
            {scrapeResult && (
              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
                <span>Links: <b>{scrapeResult.content.links.length}</b></span>
                <span>Images: <b>{scrapeResult.content.images.length}</b></span>
                <span>Forms: <b>{scrapeResult.content.forms.length}</b></span>
                <span>Words: <b>{scrapeResult.metadata.wordCount}</b></span>
                <span>Load: <b>{scrapeResult.metadata.loadTime}ms</b></span>
              </div>
            )}
          </div>
        )}

        {/* Screenshot Preview */}
        {screenshot && screenshot.dataUrl && activeTab === 'preview' && (
          <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <img src={screenshot.dataUrl} alt="Browser screenshot" style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Quick Actions</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            <button className="cast-toolbar-btn active" onClick={handleScrape} disabled={isLoading || !pageInfo} style={{ fontSize: 11, padding: '5px 10px' }}>SCRAPE</button>
            <button className="cast-toolbar-btn active" onClick={handleScreenshot} disabled={isLoading || !pageInfo} style={{ fontSize: 11, padding: '5px 10px' }}>SCREENSHOT</button>
            <button className="cast-toolbar-btn active" onClick={handleExtractLinks} disabled={!scrapeResult} style={{ fontSize: 11, padding: '5px 10px' }}>LINKS</button>
            <button className="cast-toolbar-btn active" onClick={handleCopyText} disabled={!resultText} style={{ fontSize: 11, padding: '5px 10px' }}>COPY</button>
          </div>
        </div>

        {/* Advanced Operations */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Advanced</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg-secondary)', borderRadius: 8, padding: 10 }}>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <input type="text" value={selectorInput} onChange={e => setSelectorInput(e.target.value)}
                placeholder="CSS selector (e.g., #login, input[name='q'])"
                onKeyDown={e => e.key === 'Enter' && handleFindElement()}
                style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: 5, fontSize: 11, outline: 'none' }} />
              <button className="cast-toolbar-btn active" onClick={handleFindElement} disabled={!selectorInput.trim()} style={{ fontSize: 11, padding: '5px 10px' }}>FIND</button>
              <button className="cast-toolbar-btn active" onClick={handleClickElement} disabled={!selectorInput.trim()} style={{ fontSize: 11, padding: '5px 10px' }}>CLICK</button>
            </div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <input type="text" value={valueInput} onChange={e => setValueInput(e.target.value)}
                placeholder="Value to fill"
                onKeyDown={e => e.key === 'Enter' && handleFillElement()}
                style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: 5, fontSize: 11, outline: 'none' }} />
              <button className="cast-toolbar-btn active" onClick={handleFillElement} disabled={!selectorInput.trim() || !valueInput.trim()} style={{ fontSize: 11, padding: '5px 10px' }}>FILL</button>
            </div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <input type="text" value={jsScript} onChange={e => setJsScript(e.target.value)}
                placeholder="JavaScript expression (e.g., document.title)"
                onKeyDown={e => e.key === 'Enter' && handleRunJS()}
                style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: 5, fontSize: 11, outline: 'none', fontFamily: 'monospace' }} />
              <button className="cast-toolbar-btn active" onClick={handleRunJS} disabled={!jsScript.trim()} style={{ fontSize: 11, padding: '5px 10px' }}>RUN JS</button>
            </div>
          </div>
        </div>

        {/* Result Area */}
        {resultText && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Result</span>
              <button className="cast-toolbar-btn" onClick={() => setResultText('')} style={{ fontSize: 10, padding: '2px 8px' }}>CLEAR</button>
            </div>
            <pre className="cast-preview-area" style={{ maxHeight: 180, overflow: 'auto', padding: 10, fontSize: 11.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', borderRadius: 8 }}>{resultText}</pre>
          </div>
        )}

        {/* Settings / Domain Allowlist */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span
              style={{ fontSize: 11, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setActiveTab(activeTab === 'settings' ? 'preview' : 'settings')}
            >
              Security ({activeTab === 'settings' ? 'hide' : 'show'})
            </span>
            <span style={{ fontSize: 10, color: statusInfo.color }}>{statusInfo.label}</span>
          </div>
          {activeTab === 'settings' && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Domain Allowlist ({allowedDomains.length === 0 ? 'All domains allowed' : `${allowedDomains.length} rule(s)`})
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <input type="text" value={domainInput} onChange={e => setDomainInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddDomain()}
                  placeholder="Add domain (e.g., example.com)"
                  style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: 5, fontSize: 11, outline: 'none' }} />
                <button className="cast-toolbar-btn active" onClick={handleAddDomain} disabled={!domainInput.trim()} style={{ fontSize: 11, padding: '5px 10px' }}>ADD</button>
              </div>
              {allowedDomains.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {allowedDomains.map(d => (
                    <span key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 20, fontSize: 10.5, color: '#ef4444' }}>
                      {d}
                      <button onClick={() => handleRemoveDomain(d)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}>x</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Event Log */}
        {eventLog.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Event Log</div>
            <div ref={logRef} style={{ maxHeight: 100, overflow: 'auto', background: '#1a1a2e', borderRadius: 6, padding: 8, fontFamily: 'monospace', fontSize: 10 }}>
              {eventLog.map((log, i) => (
                <div key={i} style={{ color: log.includes('error') ? '#f87171' : log.includes('loaded') || log.includes('Navigated') ? '#86efac' : '#94a3b8', lineHeight: 1.6 }}>{log}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div style={{ padding: '6px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: CastBrowserEngine.isAvailable() ? statusInfo.color : '#9ca3af' }}></span>
          {CastBrowserEngine.isAvailable() ? `Connected (${statusInfo.label})` : 'Disconnected'}
        </span>
        <span>{pageInfo ? new URL(pageInfo.url).hostname : 'No page loaded'}</span>
      </div>
    </div>
  );
};

export default React.memo(BrowserAutomationWidget);
