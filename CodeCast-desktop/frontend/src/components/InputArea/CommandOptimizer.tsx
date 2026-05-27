import React, { useState, useMemo, useCallback } from 'react';
import { CommandSuggestion } from '../../store/types';

interface CommandOptimizerProps {
  input: string;
  visible: boolean;
  onApplySuggestion: (optimizedText: string) => void;
  onClose: () => void;
}

const CommandOptimizer: React.FC<CommandOptimizerProps> = ({
  input,
  visible,
  onApplySuggestion,
  onClose,
}) => {
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const suggestions = useMemo((): CommandSuggestion[] => {
    if (!input.trim()) return [];

    const results: CommandSuggestion[] = [];
    const trimmed = input.trim();

    if (trimmed.length < 5) {
      results.push({
        type: 'clarity',
        severity: 'warning',
        title: '指令过短',
        description: '建议提供更详细的描述，以便 AI 更准确地理解你的需求',
        originalText: trimmed,
        suggestedText: trimmed + '，请详细说明具体需求和预期结果',
        applied: false,
      });
    }

    if (!/[？?。！!]$/.test(trimmed) && !trimmed.includes('请') && !trimmed.includes('帮我') && !trimmed.includes('帮助')) {
      results.push({
        type: 'clarity',
        severity: 'suggestion',
        title: '缺少礼貌用语',
        description: '添加礼貌用语可以让 AI 的回复更加友好和详细',
        originalText: trimmed,
        suggestedText: '请' + trimmed,
        applied: false,
      });
    }

    if (/写|创建|实现|开发|生成/.test(trimmed) && !/功能|模块|组件|接口|页面/.test(trimmed)) {
      results.push({
        type: 'parameters',
        severity: 'info',
        title: '补充技术细节',
        description: '建议指定使用的技术栈、框架或具体的实现方式',
        originalText: trimmed,
        suggestedText: trimmed + '（使用 TypeScript + React）',
        applied: false,
      });
    }

    if (trimmed.includes('bug') || trimmed.includes('错误') || trimmed.includes('问题') || trimmed.includes('修复')) {
      if (!trimmed.includes('错误信息') && !trimmed.includes('日志') && !trimmed.includes('报错')) {
        results.push({
          type: 'parameters',
          severity: 'info',
          title: '提供错误详情',
          description: '建议附上相关的错误信息、日志或复现步骤，以便更快定位问题',
          originalText: trimmed,
          suggestedText: trimmed + '，错误信息：[粘贴你的错误日志]',
          applied: false,
        });
      }
    }

    if (!/[\n]/.test(trimmed) && trimmed.length > 50) {
      const hasMultipleTasks = /[,，;；]/.test(trimmed) && trimmed.split(/[,，;；]/).filter(s => s.trim().length > 3).length > 1;
      if (hasMultipleTasks) {
        results.push({
          type: 'structure',
          severity: 'suggestion',
          title: '拆分多个任务',
          description: '检测到多个任务，建议分条列出以提高执行准确性',
          originalText: trimmed,
          suggestedText: formatAsList(trimmed),
          applied: false,
        });
      }
    }

    if (/优化|改进|重构|提升/.test(trimmed) && !/性能|速度|内存|体验/.test(trimmed)) {
      results.push({
        type: 'clarity',
        severity: 'suggestion',
        title: '明确优化目标',
        description: '建议说明具体的优化方向：性能、代码质量、用户体验等',
        originalText: trimmed,
        suggestedText: trimmed + '，目标：提升代码可读性和运行效率',
        applied: false,
      });
    }

    return results.map(s => ({ ...s, applied: appliedIds.has(`${s.type}-${s.title}`) }));
  }, [input, appliedIds]);

  const handleApply = useCallback((suggestion: CommandSuggestion) => {
    setAppliedIds(prev => new Set([...prev, `${suggestion.type}-${suggestion.title}`]));
    onApplySuggestion(suggestion.suggestedText);
  }, [onApplySuggestion]);

  const handleApplyAll = useCallback(() => {
    let optimized = input;
    suggestions.forEach(s => {
      if (!appliedIds.has(`${s.type}-${s.title}`)) {
        optimized = s.suggestedText;
        setAppliedIds(prev => new Set([...prev, `${s.type}-${s.title}`]));
      }
    });
    onApplySuggestion(optimized);
  }, [input, suggestions, appliedIds, onApplySuggestion]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'warning':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      case 'info':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c7cff" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
      default:
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        );
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'clarity': return '清晰度';
      case 'parameters': return '参数';
      case 'format': return '格式';
      case 'structure': return '结构';
      default: return type;
    }
  };

  if (!visible || suggestions.length === 0) return null;

  return (
    <div className="command-optimizer">
      <div className="optimizer-header">
        <div className="optimizer-title-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <span>智能指令优化</span>
          <span className="optimizer-badge">{suggestions.length} 条建议</span>
        </div>
        {suggestions.length > 1 && (
          <button className="optimizer-apply-all" onClick={handleApplyAll}>
            全部应用
          </button>
        )}
      </div>

      <div className="optimizer-suggestions">
        {suggestions.map((suggestion, index) => (
          <div key={`${suggestion.type}-${index}`} className={`optimizer-item ${suggestion.severity}`}>
            <div className="optimizer-item-header">
              <span className="optimizer-severity-icon">{getSeverityIcon(suggestion.severity)}</span>
              <span className="optimizer-type">{getTypeLabel(suggestion.type)}</span>
              <span className="optimizer-title">{suggestion.title}</span>
            </div>

            <p className="optimizer-description">{suggestion.description}</p>

            {!suggestion.applied ? (
              <div className="optimizer-actions">
                <button
                  className="optimizer-apply-btn"
                  onClick={() => handleApply(suggestion)}
                >
                  应用建议
                </button>
                <div className="optimizer-preview">
                  <span className="preview-label">预览：</span>
                  <code>{suggestion.suggestedText.slice(0, 80)}{suggestion.suggestedText.length > 80 ? '...' : ''}</code>
                </div>
              </div>
            ) : (
              <div className="optimizer-applied">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                已应用
              </div>
            )}
          </div>
        ))}
      </div>

      <button className="optimizer-close" onClick={onClose}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
};

function formatAsList(text: string): string {
  const parts = text.split(/[,，;；]/).filter(s => s.trim());
  if (parts.length <= 1) return text;
  return parts.map((part, i) => `${i + 1}. ${part.trim()}`).join('\n');
}

export default CommandOptimizer;