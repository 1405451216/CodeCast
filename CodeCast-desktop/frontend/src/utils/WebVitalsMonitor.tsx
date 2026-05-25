import { useEffect, useState, useCallback } from 'react';

interface LCPEntry extends PerformanceEntry {
  startTime: number;
  renderTime?: number;
  loadTime?: number;
  size?: number;
  element?: Element;
  url?: string;
  id?: string;
}

interface FIDEntry extends PerformanceEntry {
  processingStart: number;
  startTime: number;
  name: string;
}

interface INPEntry extends PerformanceEntry {
  duration: number;
  processingStart: number;
  startTime: number;
  name: string;
  interactionId?: number;
  entryType: string;
}

interface CLSEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
  startTime: number;
  name: string;
}

interface TTFBEntry extends PerformanceEntry {
  responseStart: number;
  requestStart: number;
  responseEnd?: number;
  transferSize?: number;
}

interface FCPEntry extends PerformanceEntry {
  startTime: number;
  name: string;
  entryType: string;
}

interface MetricData {
  name: string;
  value: number | null;
  rating: 'good' | 'needs-improvement' | 'poor' | null;
  delta: number | null;
  timestamp: number;
  entries: PerformanceEntry[];
}

interface WebVitalsConfig {
  endpoint?: string;
  reportInterval?: number;
  showDashboard?: boolean;
  thresholds?: {
    LCP: number;
    FID: number;
    INP: number;
    CLS: number;
    TTFB: number;
    FCP: number;
  };
}

const DEFAULT_THRESHOLDS = {
  LCP: 2500,
  FID: 100,
  INP: 200,
  CLS: 0.1,
  TTFB: 800,
  FCP: 1800
};

export function useWebVitals(config: WebVitalsConfig = {}) {
  const [metrics, setMetrics] = useState<Map<string, MetricData>>(new Map());
  
  const thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds };

  const getRating = useCallback((name: string, value: number): 'good' | 'needs-improvement' | 'poor' => {
    const threshold = thresholds[name as keyof typeof DEFAULT_THRESHOLDS];
    if (!threshold) return 'good';

    if (name === 'CLS') {
      if (value <= 0.1) return 'good';
      if (value <= 0.25) return 'needs-improvement';
      return 'poor';
    }

    if (value <= threshold * 1.5) return 'good';
    if (value <= threshold * 2.5) return 'needs-improvement';
    return 'poor';
  }, [thresholds]);

  const updateMetric = useCallback((name: string, data: Partial<MetricData>) => {
    setMetrics(prev => {
      const existing = prev.get(name);
      const metric: MetricData = {
        name,
        value: data.value ?? existing?.value ?? null,
        rating: data.rating ?? existing?.rating ?? null,
        delta: data.delta ?? existing?.delta ?? null,
        timestamp: Date.now(),
        entries: [...(existing?.entries || []), ...(data.entries || [])]
      };
      
      const newMap = new Map(prev);
      newMap.set(name, metric);
      return newMap;
    });
  }, []);

  useEffect(() => {
    let clsValue = 0;

    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as LCPEntry;
        
        if (lastEntry) {
          updateMetric('LCP', {
            value: lastEntry.startTime,
            rating: getRating('LCP', lastEntry.startTime),
            entries: [lastEntry]
          });
        }
      });

      const fidObserver = new PerformanceObserver((list) => {
        const entry = list.getEntries()[0] as FIDEntry;
        
        if (entry) {
          updateMetric('FID', {
            value: entry.processingStart - entry.startTime,
            rating: getRating('FID', entry.processingStart - entry.startTime),
            entries: [entry]
          });
        }
      });

      const inpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        let worstINP = 0;
        let worstEntry: INPEntry | null = null;

        for (const entry of entries as INPEntry[]) {
          const duration = entry.duration;
          if (duration > worstINP) {
            worstINP = duration;
            worstEntry = entry;
          }
        }

        if (worstEntry) {
          updateMetric('INP', {
            value: worstINP,
            rating: getRating('INP', worstINP),
            entries: [worstEntry]
          });
        }
      });

      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as CLSEntry[]) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            
            updateMetric('CLS', {
              value: Math.round(clsValue * 1000) / 1000,
              rating: getRating('CLS', clsValue),
              delta: entry.value,
              entries: [entry]
            });
          }
        }
      });

      const ttfbObserver = new PerformanceObserver((list) => {
        const entry = list.getEntries()[0] as TTFBEntry;
        
        if (entry) {
          updateMetric('TTFB', {
            value: entry.responseStart - entry.requestStart,
            rating: getRating('TTFB', entry.responseStart - entry.requestStart),
            entries: [entry]
          });
        }
      });

      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
        
        if (fcpEntry) {
          updateMetric('FCP', {
            value: fcpEntry.startTime,
            rating: getRating('FCP', fcpEntry.startTime),
            entries: [fcpEntry]
          });
        }
      });

      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      fidObserver.observe({ type: 'first-input', buffered: true });
      inpObserver.observe({ type: 'event', buffered: true });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      ttfbObserver.observe({ type: 'navigation', buffered: true });
      fcpObserver.observe({ type: 'paint', buffered: true });

      return () => {
        lcpObserver.disconnect();
        fidObserver.disconnect();
        inpObserver.disconnect();
        clsObserver.disconnect();
        ttfbObserver.disconnect();
        fcpObserver.disconnect();
      };
    } catch (e) {
      console.warn('[Web Vitals] Observer setup failed:', e);
    }
  }, [getRating, updateMetric]);

  useEffect(() => {
    if (!config.endpoint) return;

    const interval = setInterval(() => {
      const payload = {
        metrics: Object.fromEntries(metrics),
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      };

      fetch(config.endpoint!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(error => console.error('[Web Vitals] Report failed:', error));
    }, config.reportInterval || 30000);

    return () => clearInterval(interval);
  }, [config.endpoint, config.reportInterval, metrics]);

  const getScore = useCallback((): number => {
    const coreWebVitals = ['LCP', 'INP', 'CLS'];
    let totalScore = 0;
    let validMetrics = 0;

    for (const name of coreWebVitals) {
      const metric = metrics.get(name);
      if (metric?.rating) {
        switch (metric.rating) {
          case 'good': totalScore += 100; break;
          case 'needs-improvement': totalScore += 50; break;
          case 'poor': totalScore += 0; break;
        }
        validMetrics++;
      }
    }

    return validMetrics > 0 ? Math.round(totalScore / validMetrics) : 0;
  }, [metrics]);

  return { metrics, getScore };
}

export function WebVitalsDashboard() {
  const { metrics, getScore } = useWebVitals();

  const score = getScore();

  const formatValue = (name: string, value: number | null) => {
    if (value === null) return '--';
    switch (name) {
      case 'LCP':
      case 'FCP':
      case 'TTFB':
        return `${Math.round(value)}ms`;
      case 'FID':
      case 'INP':
        return `${Math.round(value)}ms`;
      case 'CLS':
        return value.toFixed(3);
      default:
        return String(value);
    }
  };

  const getRatingColor = (rating: string | null) => {
    switch (rating) {
      case 'good': return '#34d399';
      case 'needs-improvement': return '#fbbf24';
      case 'poor': return '#f87171';
      default: return '#888';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#34d399';
    if (score >= 50) return '#fbbf24';
    return '#f87171';
  };

  if (import.meta.env.DEV === false) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 99999,
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '12px'
      }}
    >
      <div
        style={{
          background: 'rgba(26, 26, 46, 0.95)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          padding: '16px',
          minWidth: '220px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <span style={{ color: '#fff', fontWeight: 600, fontSize: '13px' }}>
            📊 Web Vitals
          </span>
          <span
            style={{
              background: getScoreColor(score),
              color: '#000',
              padding: '2px 8px',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '14px'
            }}
          >
            {score}
          </span>
        </div>

        {['LCP', 'FID', 'INP', 'CLS', 'FCP', 'TTFB'].map((name) => {
          const metric = metrics.get(name);
          return (
            <div
              key={name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 0',
                color: 'rgba(255,255,255,0.7)'
              }}
            >
              <span>{name}</span>
              <span
                style={{
                  color: getRatingColor(metric?.rating ?? null),
                  fontWeight: 500,
                  fontFamily: 'monospace'
                }}
              >
                {formatValue(name, metric?.value ?? null)}
              </span>
            </div>
          );
        })}

        <div
          style={{
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            fontSize: '10px',
            color: 'rgba(255,255,255,0.4)',
            textAlign: 'center'
          }}
        >
          Core Web Vitals Score
        </div>
      </div>
    </div>
  );
}

export type { MetricData, WebVitalsConfig };

export function exportMetricsAsJSON(metrics: Map<string, MetricData>): string {
  const data = Object.fromEntries(metrics);
  return JSON.stringify(data, null, 2);
}

export function exportMetricsAsCSV(metrics: Map<string, MetricData>): string {
  const headers = ['Metric Name', 'Value', 'Rating', 'Delta', 'Timestamp'];
  const rows = Array.from(metrics.entries()).map(([name, data]) => [
    name,
    data.value?.toString() || '',
    data.rating || '',
    data.delta?.toString() || '',
    new Date(data.timestamp).toISOString()
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

export async function copyMetricsToClipboard(metrics: Map<string, MetricData>): Promise<boolean> {
  try {
    const json = exportMetricsAsJSON(metrics);
    await navigator.clipboard.writeText(json);
    return true;
  } catch (error) {
    console.error('Failed to copy metrics to clipboard:', error);
    return false;
  }
}

export function downloadMetricsAsFile(
  metrics: Map<string, MetricData>,
  format: 'json' | 'csv' = 'json',
  filename?: string
): void {
  const content = format === 'json'
    ? exportMetricsAsJSON(metrics)
    : exportMetricsAsCSV(metrics);

  const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `web-vitals-report-${Date.now()}.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generatePerformanceReport(metrics: Map<string, MetricData>): string {
  const reportLines: string[] = [];
  reportLines.push('=== Web Vitals Performance Report ===');
  reportLines.push(`Generated at: ${new Date().toISOString()}`);
  reportLines.push('');

  let allGood = true;
  for (const [name, data] of metrics) {
    const rating = data.rating || 'unknown';
    const statusIcon = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';
    
    if (rating !== 'good') allGood = false;

    reportLines.push(`${statusIcon} ${name}`);
    reportLines.push(`   Value: ${data.value ?? 'N/A'}`);
    reportLines.push(`   Rating: ${rating}`);
    if (data.delta !== null) {
      reportLines.push(`   Delta: ${data.delta}`);
    }
    reportLines.push('');
  }

  reportLines.push('=== Summary ===');
  reportLines.push(allGood
    ? '🎉 All metrics are within good thresholds!'
    : '⚠️ Some metrics need attention. Consider optimizing.');
  
  return reportLines.join('\n');
}
