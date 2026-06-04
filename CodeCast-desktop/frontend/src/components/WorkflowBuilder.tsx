import React, { useEffect, useState } from 'react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import * as api from '../api';
import type { WorkflowDefinition, WorkflowType } from '../api/types';

const PRESET_LINEAR: WorkflowDefinition = {
  type: 'linear',
  name: '示例线性工作流',
  description: '先后执行两个任务',
  startNodeId: 'step1',
  errorHandling: { onError: 'fail', maxRetries: 1, continueOnError: false },
  maxIterations: 100,
  timeoutSec: 600,
  nodes: [
    { id: 'step1', name: '步骤1-分析', type: 'task', systemPrompt: '你是分析师，简要分析输入。' },
    { id: 'step2', name: '步骤2-总结', type: 'task', systemPrompt: '你是总结者，基于步骤1输出给出最终结论。' },
  ],
  transitions: [
    { from: 'step1', to: 'step2' },
  ],
};

const PRESET_CONDITIONAL: WorkflowDefinition = {
  type: 'conditional',
  name: '示例条件分支工作流',
  description: '根据字段值选择 A/B 分支',
  startNodeId: 'check',
  errorHandling: { onError: 'skip', maxRetries: 1, continueOnError: true },
  maxIterations: 100,
  timeoutSec: 600,
  nodes: [
    { id: 'check', name: '条件检查', type: 'condition', condition: { field: 'should_branch_a', operator: '==', value: true } },
    { id: 'branchA', name: '分支A', type: 'task', systemPrompt: '执行分支A逻辑。' },
    { id: 'branchB', name: '分支B', type: 'task', systemPrompt: '执行分支B逻辑。' },
  ],
  transitions: [
    { from: 'check', to: 'branchA', type: 'condition', condition: { field: 'should_branch_a', operator: '==', value: true } },
    { from: 'check', to: 'branchB', type: 'condition', condition: { field: 'should_branch_a', operator: '!=', value: true } },
  ],
};

const PRESET_LOOP: WorkflowDefinition = {
  type: 'loop',
  name: '示例循环工作流',
  description: '重复执行任务3次',
  startNodeId: 'loop_task',
  errorHandling: { onError: 'fail', maxRetries: 1, continueOnError: false },
  maxIterations: 3,
  timeoutSec: 600,
  nodes: [
    { id: 'loop_task', name: '循环任务', type: 'task', promptTemplate: '当前迭代 {{_iteration}}，处理输入' },
    { id: 'loop_end', name: '循环结束', type: 'loop_end', condition: { field: '_iteration', operator: '>=', value: 3 } },
  ],
  transitions: [
    { from: 'loop_task', to: 'loop_end' },
    { from: 'loop_end', to: 'loop_task' },
  ],
};

const PRESETS: Record<string, WorkflowDefinition> = {
  linear: PRESET_LINEAR,
  conditional: PRESET_CONDITIONAL,
  loop: PRESET_LOOP,
};

const WorkflowBuilder: React.FC = () => {
  const { runs, events, isLoading, error, loadRuns, submitWorkflow, pauseRun, resumeRun, cancelRun, clearEvents, activeRunId } = useWorkflowStore();
  const [defJson, setDefJson] = useState<string>(JSON.stringify(PRESET_LINEAR, null, 2));
  const [type, setType] = useState<WorkflowType>('linear');

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const loadPreset = (t: WorkflowType) => {
    setType(t);
    setDefJson(JSON.stringify(PRESETS[t], null, 2));
  };

  const handleSubmit = async () => {
    clearEvents();
    await submitWorkflow(defJson);
  };

  return (
    <div className="workflow-builder" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3>AP WorkflowExecution 工作流构建器</h3>

      <div className="preset-bar" style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => loadPreset('linear')}>线性</button>
        <button onClick={() => loadPreset('conditional')}>条件分支</button>
        <button onClick={() => loadPreset('loop')}>循环</button>
        <span style={{ color: 'var(--text-muted)', alignSelf: 'center', fontSize: 12 }}>
          支持 5 种类型: linear / conditional / loop / parallel_fork_join / state_machine
        </span>
      </div>

      <textarea
        value={defJson}
        onChange={(e) => setDefJson(e.target.value)}
        spellCheck={false}
        style={{
          width: '100%', minHeight: 200, fontFamily: 'monospace', fontSize: 12,
          padding: 8, border: '1px solid var(--border)', borderRadius: 4,
        }}
      />

      <div className="actions" style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          style={{ padding: '6px 16px', cursor: isLoading ? 'not-allowed' : 'pointer' }}
        >
          {isLoading ? '提交中...' : '运行工作流'}
        </button>
        {activeRunId && (
          <>
            <button onClick={() => pauseRun(activeRunId)} style={{ padding: '6px 12px' }}>暂停</button>
            <button onClick={() => resumeRun(activeRunId)} style={{ padding: '6px 12px' }}>恢复</button>
            <button onClick={() => cancelRun(activeRunId)} style={{ padding: '6px 12px' }}>取消</button>
          </>
        )}
      </div>

      {error && (
        <div style={{ color: '#e74c3c', padding: 8, background: 'rgba(231,76,60,0.1)', borderRadius: 4 }}>
          错误: {error}
        </div>
      )}

      <div className="runs-section">
        <h4>运行历史 ({runs.length})</h4>
        {runs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>暂无工作流运行</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {runs.map((run) => (
              <div
                key={run.id}
                style={{
                  padding: 8,
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  background: activeRunId === run.id ? 'var(--bg-selected, #e3f2fd)' : 'transparent',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{run.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {run.type} · {run.status} · {run.id}
                  </div>
                  {run.error && (
                    <div style={{ fontSize: 11, color: '#e74c3c', marginTop: 4 }}>{run.error}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {run.status === 'running' && (
                    <>
                      <button onClick={() => pauseRun(run.id)} style={{ fontSize: 11 }}>暂停</button>
                      <button onClick={() => cancelRun(run.id)} style={{ fontSize: 11 }}>取消</button>
                    </>
                  )}
                  {run.status === 'paused' && (
                    <button onClick={() => resumeRun(run.id)} style={{ fontSize: 11 }}>恢复</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="events-section">
        <h4>事件流 ({events.length})</h4>
        <div
          style={{
            maxHeight: 240, overflowY: 'auto',
            background: 'var(--bg-secondary, #f5f5f5)', padding: 8, borderRadius: 4,
            fontFamily: 'monospace', fontSize: 11,
          }}
        >
          {events.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>暂无事件</div>
          ) : (
            events.map((evt, idx) => (
              <div key={idx} style={{ padding: '2px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>{evt.timestamp.split('T')[1]?.slice(0, 12)}</span>
                {' '}<strong>{evt.type}</strong>
                {evt.nodeId && <> · node: {evt.nodeId}</>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilder;
