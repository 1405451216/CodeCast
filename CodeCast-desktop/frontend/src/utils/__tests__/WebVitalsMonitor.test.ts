import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  exportMetricsAsJSON,
  exportMetricsAsCSV,
  generatePerformanceReport
} from '../WebVitalsMonitor';

describe('WebVitals Export Functions', () => {
  let metrics: Map<string, import('../WebVitalsMonitor').MetricData>;

  beforeEach(() => {
    metrics = new Map([
      ['LCP', {
        name: 'LCP',
        value: 2500,
        rating: 'good',
        delta: 100,
        timestamp: Date.now(),
        entries: []
      }],
      ['FID', {
        name: 'FID',
        value: 50,
        rating: 'good',
        delta: -10,
        timestamp: Date.now(),
        entries: []
      }],
      ['CLS', {
        name: 'CLS',
        value: 0.15,
        rating: 'needs-improvement',
        delta: 0.05,
        timestamp: Date.now(),
        entries: []
      }]
    ]);
  });

  describe('exportMetricsAsJSON', () => {
    it('exports metrics as valid JSON string', () => {
      const json = exportMetricsAsJSON(metrics);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('includes all metric data', () => {
      const json = exportMetricsAsJSON(metrics);
      const parsed = JSON.parse(json);

      expect(Object.keys(parsed)).toEqual(['LCP', 'FID', 'CLS']);
      expect(parsed.LCP.value).toBe(2500);
      expect(parsed.FID.rating).toBe('good');
    });
  });

  describe('exportMetricsAsCSV', () => {
    it('exports metrics as CSV format with headers', () => {
      const csv = exportMetricsAsCSV(metrics);

      const lines = csv.split('\n');
      expect(lines[0]).toContain('Metric Name');
      expect(lines[0]).toContain('Value');
      expect(lines[0]).toContain('Rating');
      expect(lines.length).toBe(4); // header + 3 metrics
    });

    it('handles empty metrics map', () => {
      const emptyMetrics = new Map();
      const csv = exportMetricsAsCSV(emptyMetrics);

      const lines = csv.split('\n');
      expect(lines.length).toBe(1); // only header
    });
  });

  describe('generatePerformanceReport', () => {
    it('generates report with all metrics', () => {
      const report = generatePerformanceReport(metrics);

      expect(report).toContain('=== Web Vitals Performance Report ===');
      expect(report).toContain('LCP');
      expect(report).toContain('FID');
      expect(report).toContain('CLS');
    });

    it('shows good status for good metrics', () => {
      const report = generatePerformanceReport(metrics);

      expect(report).toContain('✅ LCP');
      expect(report).toContain('✅ FID');
    });

    it('shows warning for needs-improvement metrics', () => {
      const report = generatePerformanceReport(metrics);

      expect(report).toContain('⚠️ CLS');
    });

    it('includes summary section', () => {
      const report = generatePerformanceReport(metrics);

      expect(report).toContain('=== Summary ===');
      expect(report).toContain('⚠️ Some metrics need attention');
    });

    it('shows all good message when all metrics are good', () => {
      const allGoodMetrics: Map<string, import('../WebVitalsMonitor').MetricData> = new Map([
        ['LCP', {
          name: 'LCP',
          value: 1000,
          rating: 'good',
          delta: null,
          timestamp: Date.now(),
          entries: []
        }]
      ]);

      const report = generatePerformanceReport(allGoodMetrics);

      expect(report).toContain('🎉 All metrics are within good thresholds!');
    });

    it('includes timestamp in report', () => {
      const beforeTest = Date.now();
      const report = generatePerformanceReport(metrics);
      const afterTest = Date.now();

      expect(report).toContain('Generated at:');
    });
  });
});