// frontend/src/v2/components/orchestration/OrchestrationRunner.tsx
//
// Renders the four orchestration workflows (codeReview, refactoring,
// testPipeline, parallelAnalysis) as inline cards. Each card accepts a
// code/input string and triggers the corresponding orchestrationSlice
// action. The most recent result is shown beneath the cards.

import { useState, useCallback } from 'react';
import { useAppStore } from '../../store';
import { useI18n } from '../../lib/useI18n';
import type { AppState } from '../../store';
import type { I18nData } from '../../lib/useI18n';

type WorkflowKey = 'codeReview' | 'refactoring' | 'testPipeline' | 'parallelAnalysis';

interface WorkflowDef {
  key: WorkflowKey;
  title: string;
  description: string;
  inputLabel: string;
  inputPlaceholder: string;
}

function getWorkflows(t: I18nData): WorkflowDef[] {
  return [
    { key: 'codeReview',       title: t.orchestration.codeReview,       description: t.orchestration.codeReviewDesc,  inputLabel: t.orchestration.pasteCode,     inputPlaceholder: 'function foo() {...}' },
    { key: 'refactoring',      title: t.orchestration.refactoring,      description: t.orchestration.refactoringDesc, inputLabel: t.orchestration.pasteCode,     inputPlaceholder: 'function bar() {...}' },
    { key: 'testPipeline',     title: t.orchestration.testPipeline,     description: t.orchestration.testPipelineDesc, inputLabel: t.orchestration.pasteCode,   inputPlaceholder: 'function baz() {...}' },
    { key: 'parallelAnalysis', title: t.orchestration.parallelAnalysis, description: t.orchestration.parallelAnalysisDesc, inputLabel: t.orchestration.inputContent, inputPlaceholder: t.orchestration.parallelPlaceholder },
  ];
}

export function OrchestrationRunner() {
  const t = useI18n();
  const WORKFLOWS = getWorkflows(t);
  const orchestrationLoading = useAppStore((s) => s.orchestrationLoading);
  const lastResult = useAppStore((s: AppState) => s.lastResult);
  const runCodeReview = useAppStore((s: AppState) => s.runCodeReview);
  const runRefactoring = useAppStore((s: AppState) => s.runRefactoring);
  const runTestPipeline = useAppStore((s: AppState) => s.runTestPipeline);
  const runParallelAnalysis = useAppStore((s: AppState) => s.runParallelAnalysis);
  const currentSessionId = useAppStore((s: AppState) => s.currentSessionId);

  const [inputs, setInputs] = useState<Record<WorkflowKey, string>>({
    codeReview: '',
    refactoring: '',
    testPipeline: '',
    parallelAnalysis: '',
  });
  const [runningKey, setRunningKey] = useState<WorkflowKey | null>(null);

  const handleRun = useCallback(async (key: WorkflowKey) => {
    const input = inputs[key].trim();
    if (!input || !currentSessionId) return;
    setRunningKey(key);
    try {
      switch (key) {
        case 'codeReview':       await runCodeReview(currentSessionId, input); break;
        case 'refactoring':      await runRefactoring(currentSessionId, input); break;
        case 'testPipeline':     await runTestPipeline(currentSessionId, input); break;
        case 'parallelAnalysis': await runParallelAnalysis(currentSessionId, input); break;
      }
    } finally {
      setRunningKey(null);
    }
  }, [inputs, currentSessionId, runCodeReview, runRefactoring, runTestPipeline, runParallelAnalysis]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', margin: 0 }}>
        {t.orchestration.title}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {WORKFLOWS.map((wf) => {
          const isRunning = runningKey === wf.key || (orchestrationLoading && runningKey === null);
          const value = inputs[wf.key];
          return (
            <div
              key={wf.key}
              style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                padding: 12,
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                borderRadius: 'var(--r-md)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text)' }}>{wf.title}</span>
                <span style={{ fontSize: 11, color: 'var(--c-textSub)', marginTop: 2 }}>{wf.description}</span>
              </div>
              <textarea
                value={value}
                onChange={(e) => setInputs((s) => ({ ...s, [wf.key]: e.target.value }))}
                placeholder={wf.inputPlaceholder}
                style={{
                  minHeight: 80,
                  padding: '6px 8px',
                  background: 'var(--c-bg)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-sm)',
                  color: 'var(--c-text)',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
              <button
                onClick={() => void handleRun(wf.key)}
                disabled={!value.trim() || isRunning || !currentSessionId}
                style={{
                  alignSelf: 'flex-end',
                  padding: '5px 12px',
                  background: !value.trim() || isRunning || !currentSessionId ? 'var(--c-bgSub)' : 'var(--c-accent)',
                  color: !value.trim() || isRunning || !currentSessionId ? 'var(--c-textMute)' : '#fff',
                  border: 'none',
                  borderRadius: 'var(--r-sm)',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  cursor: !value.trim() || isRunning || !currentSessionId ? 'not-allowed' : 'pointer',
                }}
              >
                {runningKey === wf.key ? t.orchestration.running : t.orchestration.run}
              </button>
            </div>
          );
        })}
      </div>

      {lastResult && (
        <div
          style={{
            padding: 12,
            background: 'var(--c-bgSub)',
            border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-md)',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--c-textSub)', marginBottom: 6 }}>{t.orchestration.lastResult}</div>
          <pre
            style={{
              margin: 0,
              padding: 10,
              background: 'var(--c-bg)',
              border: '1px solid var(--c-border)',
              borderRadius: 'var(--r-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--c-text)',
              overflow: 'auto',
              maxHeight: 300,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
