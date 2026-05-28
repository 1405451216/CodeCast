import React, { useState, useCallback } from 'react';
import { castFS } from '../../utils/cast/cast-fs-api';

interface FileImportExportBarProps {
  mode: 'import' | 'export' | 'both';
  onImport?: (content: string, filename: string) => void;
  onExport?: (content: string) => void;
  exportFilename?: string;
  exportContent?: string;
  compact?: boolean;
  accept?: string;
  exportMimeType?: string;
}

const FileImportExportBar: React.FC<FileImportExportBarProps> = React.memo(({
  mode,
  onImport,
  onExport,
  exportFilename = 'export.txt',
  exportContent = '',
  compact = false,
  accept,
  exportMimeType
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const showStatus = useCallback((msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 2500);
  }, []);

  const handleImport = useCallback(async () => {
    if (!onImport || isImporting) return;
    setIsImporting(true);
    try {
      const result = await castFS.importFromFile(accept);
      if (result && result.content) {
        onImport(result.content, result.name);
        showStatus(`Imported: ${result.name}`);
      }
    } catch (error) {
      console.error('[FileImportExportBar] Import failed:', error);
      showStatus('Import failed');
    } finally {
      setIsImporting(false);
    }
  }, [onImport, accept, isImporting, showStatus]);

  const handleExport = useCallback(async () => {
    if (!onExport || isExporting) return;
    setIsExporting(true);
    try {
      onExport(exportContent);
      const success = await castFS.exportAsFile(
        exportContent,
        exportFilename,
        exportMimeType
      );
      if (success) {
        showStatus(`Exported: ${exportFilename}`);
      } else {
        showStatus('Export failed');
      }
    } catch (error) {
      console.error('[FileImportExportBar] Export failed:', error);
      showStatus('Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [onExport, exportContent, exportFilename, exportMimeType, isExporting, showStatus]);

  const showImportBtn = mode === 'import' || mode === 'both';
  const showExportBtn = mode === 'export' || mode === 'both';

  const btnBaseStyle: React.CSSProperties = compact
    ? {
        padding: '2px 6px',
        fontSize: 10,
        borderRadius: 4,
        border: '1px solid var(--border-color, #333)',
        background: 'var(--bg-secondary, #1a1a2e)',
        color: 'var(--text-primary, #e0e0e0)',
        cursor: isImporting || isExporting ? 'wait' : 'pointer',
        opacity: isImporting || isExporting ? 0.6 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3
      }
    : {
        padding: '4px 12px',
        fontSize: 11,
        borderRadius: 4,
        border: '1px solid var(--border-color, #333)',
        background: 'var(--bg-secondary, #1a1a2e)',
        color: 'var(--text-primary, #e0e0e0)',
        cursor: isImporting || isExporting ? 'wait' : 'pointer',
        opacity: isImporting || isExporting ? 0.6 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4
      };

  return (
    <div className="cast-fs-ie-bar" style={{
      display: 'flex',
      alignItems: 'center',
      gap: compact ? 4 : 8,
      flexWrap: 'wrap'
    }}>
      {showImportBtn && (
        <button
          className="cast-fs-ie-btn-import"
          style={btnBaseStyle}
          onClick={handleImport}
          disabled={isImporting || !onImport}
          title="Import file"
        >
          <span style={{ fontSize: compact ? 10 : 12 }}>{'\u{1F4E5}'}</span>
          {!compact && <span>{isImporting ? '...' : 'Import'}</span>}
        </button>
      )}

      {showExportBtn && (
        <button
          className="cast-fs-ie-btn-export"
          style={{ ...btnBaseStyle }}
          onClick={handleExport}
          disabled={isExporting || !onExport}
          title={`Export as ${exportFilename}`}
        >
          <span style={{ fontSize: compact ? 10 : 12 }}>{'\u{1F4E4}'}</span>
          {!compact && <span>{isExporting ? '...' : 'Export'}</span>}
        </button>
      )}

      {statusMsg && (
        <span className="cast-fs-ie-status" style={{
          fontSize: 9,
          color: '#10b981',
          opacity: 0.8,
          maxWidth: compact ? 120 : 200,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {statusMsg}
        </span>
      )}
    </div>
  );
});

FileImportExportBar.displayName = 'FileImportExportBar';
export default FileImportExportBar;
