import React, { useState, useCallback, useEffect, useRef } from 'react';
import * as api from '../api';
import { useAppStore } from '../store';

import { toError } from '../utils/errors';

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflict';
  staged: boolean;
  additions?: number;
  deletions?: number;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
  filesChanged?: number;
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
}

export interface GitDiffLine {
  type: 'added' | 'removed' | 'context' | 'header' | 'conflict-ours' | 'conflict-theirs' | 'conflict-marker';
  content: string;
  lineNumber?: { old?: number; new?: number };
}

export interface RebaseCommit {
  hash: string;
  message: string;
  action: 'pick' | 'reword' | 'edit' | 'squash' | 'drop' | 'fixup';
  originalMessage: string;
}

export interface ConflictFile {
  path: string;
  conflictCount: number;
  status: 'unresolved' | 'resolved';
  oursContent: string;
  theirsContent: string;
  baseContent: string;
}

export interface PRTemplate {
  title: string;
  description: string;
  issueRefs: string[];
  labels: string[];
  reviewers: string[];
}

type ConventionalCommitType = 'feat' | 'fix' | 'docs' | 'style' | 'refactor' | 'test' | 'chore' | 'perf' | 'ci' | 'build';

interface GitWorkflowProps {
  onCommandExecute?: (command: string) => void;
  onFileChange?: (filePath: string) => void;
  compact?: boolean;
}

function shellEscape(s: string): string {
  return `"${s.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`')}"`;
}

const CONVENTIONAL_TYPES: Record<ConventionalCommitType, { label: string; description: string; color: string }> = {
  feat: { label: 'feat', description: '新功能', color: '#2ea44f' },
  fix: { label: 'fix', description: 'Bug 修复', color: '#cf222e' },
  docs: { label: 'docs', description: '文档变更', color: '#0969da' },
  style: { label: 'style', description: '代码格式（不影响功能）', color: '#8250df' },
  refactor: { label: 'refactor', description: '重构（非新功能、非修复）', color: '#bf5700' },
  test: { label: 'test', description: '测试相关', color: '#1a7f37' },
  chore: { label: 'chore', description: '构建/工具/辅助', color: '#6e7781' },
  perf: { label: 'perf', description: '性能优化', color: '#0598d0' },
  ci: { label: 'ci', description: 'CI 配置', color: '#6e7781' },
  build: { label: 'build', description: '构建系统/依赖', color: '#6e7781' }
};

const DEFAULT_PR_TEMPLATE: PRTemplate = {
  title: '',
  description: `## 变更概述

<!-- 简要描述本次 PR 的主要变更内容 -->

## 变更类型

- [ ] Bug 修复
- [ ] 新功能
- [ ] 重构
- [ ] 文档更新
- [ ] 性能优化
- [ ] 其他：_____

## 测试说明

<!-- 描述如何测试这些变更 -->

## 截图（如适用）

<!-- 添加截图或 GIF -->

## 关联 Issue

Closes #XXX`,
  issueRefs: [],
  labels: [],
  reviewers: []
};

const GitWorkflow: React.FC<GitWorkflowProps> = ({
  onCommandExecute,
  onFileChange,
  compact = false
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'commits' | 'branches' | 'diff' | 'ai-commit' | 'pr' | 'rebase' | 'conflicts'>('status');
  const [files, setFiles] = useState<GitFileStatus[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [diffContent, setDiffContent] = useState<GitDiffLine[]>([]);
  const [selectedDiffFile, setSelectedDiffFile] = useState<string>('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [actionLog, setActionLog] = useState<Array<{ time: string; action: string; status: 'success' | 'error' | 'info' | 'warning' }>>([]);

  const [aiCommitType, setAiCommitType] = useState<ConventionalCommitType>('feat');
  const [aiCommitScope, setAiCommitScope] = useState('');
  const [isGeneratingCommit, setIsGeneratingCommit] = useState(false);
  const [aiCommitSuggestions, setAiCommitSuggestions] = useState<string[]>([]);
  const [showAiCommitPreview, setShowAiCommitPreview] = useState(false);

  const [prTemplate, setPrTemplate] = useState<PRTemplate>(DEFAULT_PR_TEMPLATE);
  const [isGeneratingPR, setIsGeneratingPR] = useState(false);
  const [issueNumber, setIssueNumber] = useState('');

  const [rebaseCommits, setRebaseCommits] = useState<RebaseCommit[]>([]);
  const [isLoadingRebase, setIsLoadingRebase] = useState(false);
  const [showRebasePreview, setShowRebasePreview] = useState(false);
  const [selectedRebaseAction, setSelectedRebaseAction] = useState<'pick' | 'squash' | 'reword' | 'drop' | 'edit'>('pick');

  const [conflictFiles, setConflictFiles] = useState<ConflictFile[]>([]);
  const [selectedConflictFile, setSelectedConflictFile] = useState<string>('');
  const [conflictContent, setConflictContent] = useState<GitDiffLine[]>([]);
  const [isLoadingConflicts, setIsLoadingConflicts] = useState(false);
  const [conflictResolution, setConflictResolution] = useState<'ours' | 'theirs' | 'manual'>('ours');

  const addLog = useCallback((action: string, status: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setActionLog(prev => [{
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      action,
      status
    }, ...prev].slice(0, 50));
  }, []);

  const loadGitStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const status = await api.getGitStatus();

      if (status) {
        setCurrentBranch(status.branch || '');

        const gitFiles: GitFileStatus[] = (status.files || []).map((file: any) => ({
          path: file.path || '',
          status: mapGitStatus(file.status),
          staged: file.staged || false
        }));

        setFiles(gitFiles);
        addLog(`加载 Git 状态: ${gitFiles.length} 个文件变更`, 'info');
      }
    } catch (error: unknown) {
      addLog(`获取 Git 状态失败: ${toError(error).message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addLog]);

  const loadCommits = useCallback(async () => {
    try {
      setIsLoading(true);
      addLog('📜 正在加载提交历史...', 'info');

      if (onCommandExecute) {
        onCommandExecute('git log --oneline --decorate -20');
      }

      try {
        const logOutput = await api.executeCommand('git log --pretty=format:"%H%x00%s%x00%an%x00%ai" -20', 15);

        if (logOutput && logOutput.trim()) {
          const commitLines = logOutput.trim().split('\n').filter(line => line.trim());
          const parsedCommits: GitCommit[] = commitLines.map(line => {
            const [hash, message, author, date] = line.split('\x00');
            return {
              hash: hash ? hash.substring(0, 7) : '',
              message: message || '(空消息)',
              author: author || 'Unknown',
              date: date || new Date().toISOString()
            };
          }).filter(c => c.hash);

          setCommits(parsedCommits);
          addLog(`✅ 加载最近 ${parsedCommits.length} 条提交记录`, 'success');
        } else {
          setCommits([]);
          addLog('⚠️ 没有找到提交记录', 'warning');
        }
      } catch (execError: unknown) {
        addLog(`⚠️ 获取 Git 日志失败: ${toError(execError).message}，显示空列表`, 'warning');
        setCommits([]);
      }
    } catch (error: unknown) {
      addLog(`加载提交历史失败: ${toError(error).message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [onCommandExecute, addLog]);

  const loadBranches = useCallback(async () => {
    try {
      setIsLoading(true);
      addLog('🌿 正在加载分支列表...', 'info');

      if (onCommandExecute) {
        onCommandExecute('git branch -a');
      }

      try {
        const branchOutput = await api.executeCommand('git branch -a --format="%(refname:short)|%(upstream:short)"', 10);

        if (branchOutput && branchOutput.trim()) {
          const currentBranchOutput = await api.executeCommand('git rev-parse --abbrev-ref HEAD', 5);
          const currentBranchName = currentBranchOutput?.trim() || 'main';

          const branchLines = branchOutput.trim().split('\n').filter(line => line.trim());
          const parsedBranches: GitBranch[] = branchLines.map(line => {
            const [name, remote] = line.split('|').map(s => s.trim());
            const isCurrent = name === currentBranchName || name.replace('* ', '') === currentBranchName;
            const cleanName = name.replace('* ', '').trim();

            return {
              name: cleanName,
              current: isCurrent,
              remote: remote && remote !== '' ? remote : undefined
            };
          }).filter(b => b.name && !b.name.startsWith('HEAD'));

          setBranches(parsedBranches);
          addLog(`✅ 加载 ${parsedBranches.length} 个分支`, 'success');
        } else {
          setBranches([]);
          addLog('⚠️ 没有找到分支信息', 'warning');
        }
      } catch (execError: unknown) {
        addLog(`⚠️ 获取分支列表失败: ${toError(execError).message}`, 'warning');
        setBranches([]);
      }
    } catch (error: unknown) {
      addLog(`加载分支列表失败: ${toError(error).message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [onCommandExecute, addLog]);

  const mapGitStatus = (status: string): GitFileStatus['status'] => {
    const statusMap: Record<string, GitFileStatus['status']> = {
      'M': 'modified',
      'A': 'added',
      'D': 'deleted',
      'R': 'renamed',
      '?': 'untracked',
      'U': 'conflict'
    };
    return statusMap[status] || 'modified';
  };

  const handleStageFile = useCallback(async (filePath: string) => {
    try {
      await api.executeCommand(`git add ${shellEscape(filePath)}`);
      setFiles(prev => prev.map(f =>
        f.path === filePath ? { ...f, staged: true } : f
      ));
      addLog(`暂存文件: ${filePath}`, 'success');

      if (onFileChange) {
        onFileChange(filePath);
      }
    } catch (error: unknown) {
      addLog(`暂存失败: ${toError(error).message}`, 'error');
    }
  }, [addLog, onFileChange]);

  const handleUnstageFile = useCallback(async (filePath: string) => {
    try {
      await api.executeCommand(`git reset HEAD ${shellEscape(filePath)}`);
      setFiles(prev => prev.map(f =>
        f.path === filePath ? { ...f, staged: false } : f
      ));
      addLog(`取消暂存: ${filePath}`, 'success');
    } catch (error: unknown) {
      addLog(`取消暂存失败: ${toError(error).message}`, 'error');
    }
  }, [addLog]);

  const handleDiscardChanges = useCallback(async (filePath: string) => {
    try {
      await api.executeCommand(`git checkout -- ${shellEscape(filePath)}`);
      setFiles(prev => prev.filter(f => f.path !== filePath));
      addLog(`丢弃更改: ${filePath}`, 'success');
    } catch (error: unknown) {
      addLog(`丢弃更改失败: ${toError(error).message}`, 'error');
    }
  }, [addLog]);

  const handleStageAll = useCallback(async () => {
    try {
      await api.executeCommand('git add -A');
      setFiles(prev => prev.map(f => ({ ...f, staged: true })));
      addLog('暂存所有变更', 'success');
    } catch (error: unknown) {
      addLog(`暂存全部失败: ${toError(error).message}`, 'error');
    }
  }, [addLog]);

  const handleCommit = useCallback(async () => {
    if (!commitMessage.trim()) {
      addLog('提交消息不能为空', 'error');
      return;
    }

    try {
      setIsLoading(true);

      await api.executeCommand(`git commit -m ${shellEscape(commitMessage)}`);

      addLog(`提交成功: ${commitMessage.slice(0, 50)}${commitMessage.length > 50 ? '...' : ''}`, 'success');
      setCommitMessage('');

      await loadGitStatus();
      await loadCommits();
    } catch (error: unknown) {
      addLog(`提交失败: ${toError(error).message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [commitMessage, addLog, loadGitStatus, loadCommits]);

  const handleCreateBranch = useCallback(async () => {
    if (!newBranchName.trim()) {
      addLog('分支名不能为空', 'error');
      return;
    }

    try {
      setIsCreatingBranch(false);
      await api.executeCommand(`git checkout -b ${shellEscape(newBranchName)}`);
      addLog(`创建并切换到新分支: ${newBranchName}`, 'success');
      setNewBranchName('');
      await loadBranches();
    } catch (error: unknown) {
      addLog(`创建分支失败: ${toError(error).message}`, 'error');
    }
  }, [newBranchName, addLog, loadBranches]);

  const handleSwitchBranch = useCallback(async (branchName: string) => {
    try {
      setIsLoading(true);
      await api.executeCommand(`git checkout ${shellEscape(branchName)}`);
      addLog(`切换到分支: ${branchName}`, 'success');
      await loadBranches();
      await loadGitStatus();
    } catch (error: unknown) {
      addLog(`切换分支失败: ${toError(error).message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addLog, loadBranches, loadGitStatus]);

  const handleViewDiff = useCallback(async (filePath: string) => {
    try {
      setSelectedDiffFile(filePath);
      setActiveTab('diff');

      const diffOutput = await api.executeCommand(`git diff ${shellEscape(filePath)}`);

      if (diffOutput) {
        const lines = diffOutput.split('\n');
        const diffLines: GitDiffLine[] = [];
        let oldLineNum = 0;
        let newLineNum = 0;

        lines.forEach(line => {
          if (line.startsWith('@@')) {
            const match = line.match(/@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
            if (match) {
              oldLineNum = parseInt(match[1]) || 0;
              newLineNum = parseInt(match[3]) || 0;
            }
            diffLines.push({ type: 'header', content: line });
          } else if (line.startsWith('+') && !line.startsWith('+++')) {
            newLineNum++;
            diffLines.push({
              type: 'added',
              content: line.slice(1),
              lineNumber: { new: newLineNum }
            });
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            oldLineNum++;
            diffLines.push({
              type: 'removed',
              content: line.slice(1),
              lineNumber: { old: oldLineNum }
            });
          } else {
            oldLineNum++;
            newLineNum++;
            diffLines.push({
              type: 'context',
              content: line.slice(1),
              lineNumber: { old: oldLineNum, new: newLineNum }
            });
          }
        });

        setDiffContent(diffLines);
        addLog(`显示 Diff: ${filePath}`, 'info');
      }
    } catch (error: unknown) {
      addLog(`获取 Diff 失败: ${toError(error).message}`, 'error');
    }
  }, [addLog]);

  const generateAICommitMessage = useCallback(async () => {
    try {
      setIsGeneratingCommit(true);
      setShowAiCommitPreview(false);
      addLog('🤖 正在使用 AI 生成 Commit Message...', 'info');

      const sessionId = useAppStore.getState().currentSessionId;
      if (!sessionId) {
        addLog('没有活动会话，无法生成 AI Commit Message', 'error');
        return;
      }

      const changedFiles = files.filter(f => f.staged || f.status === 'untracked').map(f => f.path);
      if (changedFiles.length === 0) {
        addLog('没有可分析的文件变更，请先暂存文件', 'error');
        return;
      }

      let diffSummary = '';
      try {
        diffSummary = await api.executeCommand('git diff --cached --stat', 10);
      } catch {
        diffSummary = '';
      }

      let recentCommits = '';
      try {
        recentCommits = await api.executeCommand('git log --oneline -10', 10);
      } catch {
        recentCommits = '';
      }

      const prompt = `你是一个专业的 Git Commit Message 生成助手。请根据以下信息生成符合 Conventional Commits 规范的 commit message。

## 变更文件
${changedFiles.join('\n')}

## Diff 统计
${diffSummary || '(无法获取)'}

## 最近提交风格参考
${recentCommits || '(无历史记录)'}

## 要求
1. 类型使用: ${aiCommitType}
2. ${aiCommitScope ? `作用域: ${aiCommitScope}` : '无需作用域'}
3. 格式: type(scope): subject（英文，不超过72字符）
4. 使用祈使语气现在时态（如 "change" 而非 "changed"/"changes"）
5. 不加句号结尾
6. subject 首字母小写

请生成 3 个不同风格的建议（简洁型 / 详细型 / 技术型），每行一个，用 JSON 数组格式返回：
["建议1", "建议2", "建议3"]`;

      const messages = await api.sendMessageEx(
        sessionId,
        prompt,
        useAppStore.getState().selectedModel || 'deepseek-chat',
        false
      );

      const aiResponse = messages.find((m: { role: string; content: string }) => m.role === 'assistant')?.content || '';

      const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        try {
          const suggestions = JSON.parse(jsonMatch[0]) as string[];
          setAiCommitSuggestions(suggestions.filter((s: string) => typeof s === 'string' && s.trim()));
          setShowAiCommitPreview(true);
          addLog(`✅ AI 生成了 ${suggestions.length} 条 Commit Message 建议`, 'success');
        } catch {
          const fallbackSuggestions = aiResponse
            .split('\n')
            .map((l: string) => l.replace(/^[\d.\-#*]+\s*/, '').trim())
            .filter((l: string) => l.length > 5 && l.length < 100)
            .slice(0, 5);
          setAiCommitSuggestions(fallbackSuggestions.length > 0 ? fallbackSuggestions : [aiResponse.slice(0, 80)]);
          setShowAiCommitPreview(true);
          addLog('✅ AI 已生成建议（解析为自由文本）', 'success');
        }
      } else {
        const fallbackSuggestions = aiResponse
          .split('\n')
          .map((l: string) => l.replace(/^[\d.\-#*]+\s*/, '').trim())
          .filter((l: string) => l.length > 5 && l.length < 100)
          .slice(0, 5);
        setAiCommitSuggestions(fallbackSuggestions.length > 0 ? fallbackSuggestions : [aiResponse.slice(0, 80)]);
        setShowAiCommitPreview(true);
        addLog('✅ AI 已生成建议', 'success');
      }
    } catch (error: unknown) {
      addLog(`AI 生成失败: ${toError(error).message}`, 'error');
    } finally {
      setIsGeneratingCommit(false);
    }
  }, [files, aiCommitType, aiCommitScope, addLog]);

  const applySuggestion = useCallback((suggestion: string) => {
    setCommitMessage(suggestion);
    setShowAiCommitPreview(false);
    addLog(`已应用建议: ${suggestion}`, 'info');
  }, [addLog]);

  const generatePRTemplate = useCallback(async () => {
    try {
      setIsGeneratingPR(true);
      addLog('🤖 正在生成 PR 模板...', 'info');

      const sessionId = useAppStore.getState().currentSessionId;
      if (!sessionId) {
        addLog('没有活动会话', 'error');
        return;
      }

      const diffOutput = await api.executeCommand('git diff main...HEAD --stat 2>/dev/null || git diff origin/main...HEAD --stat 2>/dev/null || git diff --cached --stat', 15).catch(() => '');

      const recentCommitsForPR = await api.executeCommand('git log --oneline main..HEAD 2>/dev/null || git log --oneline -15', 15).catch(() => '');

      const prPrompt = `根据以下 Git 信息生成一个专业的 Pull Request 模板：

## 分支信息
当前分支: ${currentBranch}
目标分支: main

## 变更统计
${diffOutput || '(无法获取)'}

## 包含的提交
${recentCommitsForPR || '(无)'}

${issueNumber ? `\n关联 Issue: #${issueNumber}` : ''}

请返回 JSON 格式:
{
  "title": "简短标题（英文，< 70字符）",
  "description": "详细描述（Markdown 格式，包含变更概述、测试步骤等）",
  "labels": ["标签1", "标签2"],
  "reviewers": ["reviewer1"]
}`;

      const messages = await api.sendMessageEx(sessionId, prPrompt, useAppStore.getState().selectedModel || 'deepseek-chat', false);
      const response = messages.find((m: { role: string; content: string }) => m.role === 'assistant')?.content || '';

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const prData = JSON.parse(jsonMatch[0]);
          setPrTemplate(prev => ({
            ...prev,
            title: prData.title || prev.title,
            description: prData.description || prev.description,
            labels: prData.labels || [],
            reviewers: prData.reviewers || []
          }));
          addLog('✅ PR 模板已生成', 'success');
        }
      } catch {
        setPrTemplate(prev => ({
          ...prev,
          description: response
        }));
        addLog('✅ PR 描述已生成（原始格式）', 'success');
      }
    } catch (error: unknown) {
      addLog(`PR 模板生成失败: ${toError(error).message}`, 'error');
    } finally {
      setIsGeneratingPR(false);
    }
  }, [currentBranch, issueNumber, addLog]);

  const loadRebaseCommits = useCallback(async () => {
    try {
      setIsLoadingRebase(true);
      addLog('📋 加载最近的提交用于 Interactive Rebase...', 'info');

      const logOutput = await api.executeCommand('git log --oneline -15', 10);

      if (logOutput?.trim()) {
        const rebaseList: RebaseCommit[] = logOutput
          .trim()
          .split('\n')
          .filter(l => l.trim())
          .map(line => {
            const spaceIdx = line.indexOf(' ');
            const hash = line.substring(0, spaceIdx);
            const message = line.substring(spaceIdx + 1);
            return {
              hash,
              message,
              action: 'pick',
              originalMessage: message
            };
          });

        setRebaseCommits(rebaseList);
        addLog(`✅ 加载 ${rebaseList.length} 个提交用于 Rebase`, 'success');
      }
    } catch (error: unknown) {
      addLog(`加载 Rebase 提交失败: ${toError(error).message}`, 'error');
    } finally {
      setIsLoadingRebase(false);
    }
  }, [addLog]);

  const updateRebaseAction = useCallback((hash: string, action: RebaseCommit['action']) => {
    setRebaseCommits(prev =>
      prev.map(c => c.hash === hash ? { ...c, action } : c)
    );
  }, []);

  const previewRebaseCommands = useCallback((): string => {
    const pickOrFixup = rebaseCommits.filter(c => c.action === 'pick' || c.action === 'fixup');
    const commands = rebaseCommits
      .filter(c => c.action !== 'fixup')
      .map(c => `${c.action} ${c.hash} ${c.originalMessage}`)
      .join('\n');

    return commands;
  }, [rebaseCommits]);

  const executeRebase = useCallback(async () => {
    try {
      setIsLoading(true);
      const commands = previewRebaseCommands();

      if (!commands.trim()) {
        addLog('没有需要执行的 Rebase 操作', 'warning');
        return;
      }

      addLog('⚠️ 即将执行 Interactive Rebase，请确认操作预览:', 'info');
      addLog(commands, 'info');

      const commitCount = rebaseCommits.filter(c => c.action !== 'drop').length;
      await api.executeCommand(`git rebase -i HEAD~${commitCount}`);

      addLog('✅ Rebase 操作已执行（请在终端确认交互式操作）', 'success');
      setShowRebasePreview(false);
      await loadCommits();
    } catch (error: unknown) {
      addLog(`Rebase 执行失败: ${toError(error).message}（可能需要手动解决冲突）`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [previewRebaseCommands, rebaseCommits, addLog, loadCommits]);

  const detectConflicts = useCallback(async () => {
    try {
      setIsLoadingConflicts(true);
      addLog('🔍 正在检测合并冲突...', 'info');

      const conflictOutput = await api.executeCommand('git diff --name-only --diff-filter=U', 10);

      if (conflictOutput?.trim()) {
        const conflictedPaths = conflictOutput.trim().split('\n').filter(p => p.trim());

        const conflictData: ConflictFile[] = [];

        for (const path of conflictedPaths) {
          const fileContent = await api.readFileContent(path).catch(() => '');
          const conflictMarkers = (fileContent.match(/<<<<<<<|=======|>>>>>>>/g) || []).length;
          const conflictCount = Math.floor(conflictMarkers / 3);

          conflictData.push({
            path,
            conflictCount,
            status: 'unresolved',
            oursContent: '',
            theirsContent: '',
            baseContent: ''
          });
        }

        setConflictFiles(conflictData);
        addLog(`⚠️ 发现 ${conflictData.length} 个冲突文件`, 'warning');
      } else {
        setConflictFiles([]);
        addLog('✅ 当前没有检测到合并冲突', 'success');
      }
    } catch (error: unknown) {
      addLog(`冲突检测失败: ${toError(error).message}`, 'error');
    } finally {
      setIsLoadingConflicts(false);
    }
  }, [addLog]);

  const viewConflictDetails = useCallback(async (filePath: string) => {
    try {
      setSelectedConflictFile(filePath);

      const content = await api.readFileContent(filePath);
      const lines: GitDiffLine[] = content.split('\n').map(line => {
        if (line.includes('<<<<<<<')) {
          return { type: 'conflict-marker', content: line };
        } else if (line.includes('=======')) {
          return { type: 'conflict-marker', content: line };
        } else if (line.includes('>>>>>>>')) {
          return { type: 'conflict-marker', content: line };
        }
        return { type: 'context', content: line };
      });

      setConflictContent(lines);
      addLog(`显示冲突详情: ${filePath}`, 'info');
    } catch (error: unknown) {
      addLog(`读取冲突文件失败: ${toError(error).message}`, 'error');
    }
  }, [addLog]);

  const resolveConflictWithAI = useCallback(async (filePath: string, strategy: 'ours' | 'theirs' | 'manual') => {
    try {
      setIsLoading(true);
      addLog(`🤖 正在解决冲突: ${filePath} (${strategy})...`, 'info');

      const sessionId = useAppStore.getState().currentSessionId;
      if (!sessionId) {
        addLog('没有活动会话', 'error');
        return;
      }

      const content = await api.readFileContent(filePath);

      if (strategy === 'ours' || strategy === 'theirs') {
        await api.executeCommand(`git checkout --${strategy} -- ${shellEscape(filePath)}`);
        await api.executeCommand(`git add ${shellEscape(filePath)}`);
        addLog(`✅ 冲突已解决（采用 ${strategy === 'ours' ? '当前分支' : '传入分支'} 版本）: ${filePath}`, 'success');

        setConflictFiles(prev =>
          prev.map(f => f.path === filePath ? { ...f, status: 'resolved' as const } : f)
        );
      } else {
        const aiResolvePrompt = `以下是一个存在 Git 合并冲突的文件内容。请分析冲突并提供最佳合并方案。

文件路径: ${filePath}
冲突标记说明:
- <<<<<<< HEAD 到 ======= 之间是当前分支（ours）的内容
- ======= 到 >>>>>>> branch_name 之间是传入分支（theirs）的内容

文件内容:
\`\`\`
${content}
\`\`\`

请直接输出合并后的完整文件内容，不要任何解释。`;

        const messages = await api.sendMessageEx(sessionId, aiResolvePrompt, useAppStore.getState().selectedModel || 'deepseek-chat', false);
        const resolvedContent = messages.find((m: { role: string; content: string }) => m.role === 'assistant')?.content || '';

        if (resolvedContent) {
          await api.writeFile(filePath, resolvedContent);
          await api.executeCommand(`git add ${shellEscape(filePath)}`);
          addLog(`✅ AI 辅助合并完成: ${filePath}`, 'success');

          setConflictFiles(prev =>
            prev.map(f => f.path === filePath ? { ...f, status: 'resolved' as const } : f)
          );
        }
      }
    } catch (error: unknown) {
      addLog(`冲突解决失败: ${toError(error).message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addLog]);

  useEffect(() => {
    loadGitStatus();
  }, [loadGitStatus]);

  const toggleFileSelection = useCallback((filePath: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }, []);

  if (compact) {
    return (
      <div className="git-workflow compact">
        <div className="compact-header">
          <span className="branch-indicator">🌿 {currentBranch}</span>
          <span className="file-count">{files.length} 个文件变更</span>
        </div>
        <button className="quick-commit-btn" onClick={handleCommit} disabled={!commitMessage}>
          ✓ 提交
        </button>
      </div>
    );
  }

  return (
    <div className="git-workflow">
      <div className="workflow-header">
        <h3>🔀 Git 工作流</h3>
        <div className="workflow-tabs">
          {([
            { key: 'status' as const, icon: '📊', label: '状态' },
            { key: 'ai-commit' as const, icon: '🤖', label: 'AI提交' },
            { key: 'pr' as const, icon: '📋', label: 'PR模板' },
            { key: 'commits' as const, icon: '📝', label: '提交' },
            { key: 'rebase' as const, icon: '🔄', label: 'Rebase' },
            { key: 'branches' as const, icon: '🌿', label: '分支' },
            { key: 'diff' as const, icon: '🔍', label: 'Diff' },
            { key: 'conflicts' as const, icon: '⚠️', label: '冲突' }
          ]).map(tab => (
            <button
              key={tab.key}
              className={`wf-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="workflow-content">
        {activeTab === 'status' && (
          <div className="status-panel">
            <div className="status-toolbar">
              <span className="current-branch">📍 {currentBranch || 'main'}</span>
              <div className="toolbar-actions">
                <button onClick={handleStageAll} disabled={files.length === 0}>
                  全部暂存
                </button>
                <button onClick={() => { setActiveTab('ai-commit'); }} disabled={files.length === 0}>
                  ✨ AI智能提交
                </button>
                <button onClick={() => loadGitStatus()} disabled={isLoading}>
                  🔄 刷新
                </button>
              </div>
            </div>

            <div className="commit-input-area">
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="输入提交消息..."
                rows={2}
                maxLength={200}
              />
              <div className="commit-actions">
                <span className="char-count">{commitMessage.length}/200</span>
                <button
                  className="commit-btn"
                  onClick={handleCommit}
                  disabled={!commitMessage.trim() || isLoading}
                >
                  {isLoading ? '⏳ 提交中...' : '✅ 提交'}
                </button>
              </div>
            </div>

            <div className="files-list">
              {files.map(file => (
                <div
                  key={file.path}
                  className={`file-item ${file.status} ${file.staged ? 'staged' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(file.path)}
                    onChange={() => toggleFileSelection(file.path)}
                  />
                  <span className={`status-icon ${file.status}`}>
                    {getStatusIcon(file.status)}
                  </span>
                  <span
                    className="file-path"
                    onClick={() => handleViewDiff(file.path)}
                    title={file.path}
                  >
                    {file.path.split('/').pop() || file.path}
                  </span>

                  {!file.staged ? (
                    <button
                      className="stage-btn"
                      onClick={() => handleStageFile(file.path)}
                    >
                      暂存
                    </button>
                  ) : (
                    <button
                      className="unstage-btn"
                      onClick={() => handleUnstageFile(file.path)}
                    >
                      取消暂存
                    </button>
                  )}

                  <button
                    className="discard-btn"
                    onClick={() => handleDiscardChanges(file.path)}
                    title="丢弃更改"
                  >
                    🗑️
                  </button>
                </div>
              ))}

              {files.length === 0 && (
                <div className="empty-state">✨ 工作区干净，没有待提交的更改</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'ai-commit' && (
          <div className="ai-commit-panel">
            <div className="ai-commit-header">
              <h4>🤖 AI Commit Message 生成器</h4>
              <p className="panel-desc">基于 Git diff 分析自动生成符合 Conventional Commits 规范的提交消息</p>
            </div>

            <div className="ai-commit-options">
              <div className="option-group">
                <label>提交类型</label>
                <div className="type-selector">
                  {(Object.entries(CONVENTIONAL_TYPES) as [ConventionalCommitType, typeof CONVENTIONAL_TYPES[ConventionalCommitType]][]).map(([key, info]) => (
                    <button
                      key={key}
                      className={`type-btn ${aiCommitType === key ? 'active' : ''}`}
                      onClick={() => setAiCommitType(key)}
                      style={{ '--type-color': info.color } as React.CSSProperties}
                      title={info.description}
                    >
                      <span className="type-dot" style={{ background: info.color }} />
                      {info.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="option-group">
                <label>作用域 (可选)</label>
                <input
                  type="text"
                  value={aiCommitScope}
                  onChange={(e) => setAiCommitScope(e.target.value)}
                  placeholder="例如: auth, ui, api, db..."
                  className="scope-input"
                />
              </div>
            </div>

            <button
              className="generate-btn"
              onClick={generateAICommitMessage}
              disabled={isGeneratingCommit || files.length === 0}
            >
              {isGeneratingCommit ? '🤖 AI 思考中...' : '✨ 生成 Commit Message'}
            </button>

            {showAiCommitPreview && aiCommitSuggestions.length > 0 && (
              <div className="suggestions-panel">
                <h5>AI 生成的建议：</h5>
                <div className="suggestions-list">
                  {aiCommitSuggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      className="suggestion-item"
                      onClick={() => applySuggestion(suggestion)}
                    >
                      <span className="suggestion-index">{idx + 1}</span>
                      <span className="suggestion-text">{suggestion}</span>
                      <span className="apply-hint">点击应用</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="commit-input-area" style={{ marginTop: '16px' }}>
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="编辑后提交的消息将显示在这里..."
                rows={3}
                maxLength={200}
              />
              <div className="commit-actions">
                <span className="char-count">{commitMessage.length}/200</span>
                <button
                  className="commit-btn"
                  onClick={handleCommit}
                  disabled={!commitMessage.trim() || isLoading}
                >
                  {isLoading ? '⏳ 提交中...' : '✅ 提交'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pr' && (
          <div className="pr-template-panel">
            <div className="pr-header">
              <h4>📋 Pull Request 模板</h4>
              <button className="generate-pr-btn" onClick={generatePRTemplate} disabled={isGeneratingPR}>
                {isGeneratingPR ? '🤖 生成中...' : '🤖 AI 生成 PR'}
              </button>
            </div>

            <div className="pr-form">
              <div className="form-group">
                <label>关联 Issue</label>
                <div className="issue-input-row">
                  <input
                    type="text"
                    value={issueNumber}
                    onChange={(e) => setIssueNumber(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Issue 编号"
                    className="issue-number-input"
                  />
                  <span className="issue-preview">
                    {issueNumber ? `Fixes #${issueNumber}` : ''}
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label>PR 标题</label>
                <input
                  type="text"
                  value={prTemplate.title}
                  onChange={(e) => setPrTemplate(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="输入 PR 标题..."
                  className="pr-title-input"
                />
              </div>

              <div className="form-group">
                <label>描述 (Markdown)</label>
                <textarea
                  value={prTemplate.description}
                  onChange={(e) => setPrTemplate(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="PR 描述内容..."
                  rows={14}
                  className="pr-description-textarea"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>标签</label>
                  <input
                    type="text"
                    value={prTemplate.labels.join(', ')}
                    onChange={(e) => setPrTemplate(prev => ({
                      ...prev,
                      labels: e.target.value.split(',').map(l => l.trim()).filter(Boolean)
                    }))}
                    placeholder="bug, enhancement, docs..."
                    className="pr-meta-input"
                  />
                </div>
                <div className="form-group">
                  <label>Reviewers</label>
                  <input
                    type="text"
                    value={prTemplate.reviewers.join(', ')}
                    onChange={(e) => setPrTemplate(prev => ({
                      ...prev,
                      reviewers: e.target.value.split(',').map(r => r.trim()).filter(Boolean)
                    }))}
                    placeholder="username1, username2..."
                    className="pr-meta-input"
                  />
                </div>
              </div>
            </div>

            <div className="pr-preview-toggle">
              <details>
                <summary>📖 预览 PR 内容</summary>
                <div className="pr-preview">
                  <h5>{prTemplate.title || '(未设置标题)'}</h5>
                  <pre>{prTemplate.description}</pre>
                  {issueNumber && <p className="issue-ref">Closes #{issueNumber}</p>}
                </div>
              </details>
            </div>
          </div>
        )}

        {activeTab === 'commits' && (
          <div className="commits-panel">
            <div className="panel-toolbar">
              <button onClick={loadCommits} disabled={isLoading}>
                🔄 刷新历史
              </button>
            </div>

            <div className="commits-list">
              {commits.map(commit => (
                <div key={commit.hash} className="commit-item">
                  <div className="commit-hash">{commit.hash.slice(0, 7)}</div>
                  <div className="commit-message">{commit.message}</div>
                  <div className="commit-meta">
                    <span className="author">{commit.author}</span>
                    <span className="date">{commit.date}</span>
                  </div>
                </div>
              ))}

              {commits.length === 0 && (
                <div className="empty-state">暂无提交记录</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'rebase' && (
          <div className="rebase-panel">
            <div className="rebase-header">
              <h4>🔄 Interactive Rebase</h4>
              <p className="panel-desc">可视化编辑最近 N 次提交历史</p>
              <button onClick={loadRebaseCommits} disabled={isLoadingRebase}>
                📋 加载提交列表
              </button>
            </div>

            {rebaseCommits.length > 0 && (
              <>
                <div className="action-bar">
                  <span>批量操作:</span>
                  {(['pick', 'reword', 'edit', 'squash', 'drop'] as const).map(action => (
                    <button
                      key={action}
                      className={`rebase-action-btn ${selectedRebaseAction === action ? 'active' : ''}`}
                      onClick={() => setSelectedRebaseAction(action)}
                    >
                      {action.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="rebase-commits-list">
                  {rebaseCommits.map((rc, idx) => (
                    <div key={rc.hash} className={`rebase-commit-item ${rc.action}`}>
                      <select
                        value={rc.action}
                        onChange={(e) => updateRebaseAction(rc.hash, e.target.value as RebaseCommit['action'])}
                        className="rebase-action-select"
                      >
                        <option value="pick">pick</option>
                        <option value="reword">reword</option>
                        <option value="edit">edit</option>
                        <option value="squash">squash</option>
                        <option value="drop">drop</option>
                        <option value="fixup">fixup</option>
                      </select>
                      <span className="rebase-hash">{rc.hash}</span>
                      <span className="rebase-message">{rc.originalMessage}</span>
                      <span className={`action-badge ${rc.action}`}>{rc.action}</span>
                    </div>
                  ))}
                </div>

                <div className="rebase-preview-section">
                  <button
                    className="preview-toggle-btn"
                    onClick={() => setShowRebasePreview(!showRebasePreview)}
                  >
                    {showRebasePreview ? '隐藏操作预览' : '查看操作预览'}
                  </button>

                  {showRebasePreview && (
                    <pre className="rebase-command-preview">{previewRebaseCommands()}</pre>
                  )}
                </div>

                <button
                  className="execute-rebase-btn"
                  onClick={executeRebase}
                  disabled={isLoading}
                >
                  ⚡ 执行 Rebase
                </button>
              </>
            )}

            {rebaseCommits.length === 0 && !isLoadingRebase && (
              <div className="empty-state">点击上方按钮加载提交列表</div>
            )}
          </div>
        )}

        {activeTab === 'branches' && (
          <div className="branches-panel">
            <div className="panel-toolbar">
              <button onClick={loadBranches} disabled={isLoading}>
                🔄 刷新分支
              </button>
              <button onClick={() => setIsCreatingBranch(true)}>
                ➕ 新建分支
              </button>
            </div>

            {isCreatingBranch && (
              <div className="create-branch-form">
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="输入分支名称 (如: feature/new-feature)"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateBranch()}
                  autoFocus
                />
                <button onClick={handleCreateBranch}>创建</button>
                <button onClick={() => setIsCreatingBranch(false)}>取消</button>
              </div>
            )}

            <div className="branches-list">
              {branches.map(branch => (
                <div
                  key={branch.name}
                  className={`branch-item ${branch.current ? 'current' : ''}`}
                >
                  <span className="branch-icon">{branch.current ? '📍' : '🌿'}</span>
                  <span className="branch-name">{branch.name}</span>
                  {branch.remote && (
                    <span className="remote-badge">{branch.remote}</span>
                  )}
                  {!branch.current && (
                    <button
                      className="switch-btn"
                      onClick={() => handleSwitchBranch(branch.name)}
                      disabled={isLoading}
                    >
                      切换
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'diff' && (
          <div className="diff-panel">
            {selectedDiffFile ? (
              <>
                <div className="diff-header">
                  <span className="diff-file-path">{selectedDiffFile}</span>
                  <button onClick={() => setActiveTab('status')}>
                    ← 返回状态
                  </button>
                </div>

                <div className="diff-content">
                  {diffContent.map((line, idx) => (
                    <div key={idx} className={`diff-line ${line.type}`}>
                      {line.lineNumber && (
                        <span className="line-numbers">
                          <span className="old-line">{line.lineNumber.old || ''}</span>
                          <span className="new-line">{line.lineNumber.new || ''}</span>
                        </span>
                      )}
                      <span className="line-content">{line.content}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-diff">
                <p>选择一个文件查看 Diff</p>
                <button onClick={() => setActiveTab('status')}>
                  前往文件列表
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'conflicts' && (
          <div className="conflicts-panel">
            <div className="conflicts-header">
              <h4>⚠️ Git 冲突解决辅助</h4>
              <button onClick={detectConflicts} disabled={isLoadingConflicts}>
                🔍 检测冲突
              </button>
            </div>

            {conflictFiles.length > 0 && (
              <div className="conflicts-content">
                <div className="conflict-files-list">
                  {conflictFiles.map(cf => (
                    <div
                      key={cf.path}
                      className={`conflict-file-item ${cf.status} ${selectedConflictFile === cf.path ? 'selected' : ''}`}
                      onClick={() => viewConflictDetails(cf.path)}
                    >
                      <span className={`conflict-status-dot ${cf.status}`} />
                      <span className="conflict-file-path">{cf.path}</span>
                      <span className="conflict-count">{cf.conflictCount} 处冲突</span>
                      {cf.status === 'resolved' && <span className="resolved-badge">✅ 已解决</span>}
                    </div>
                  ))}
                </div>

                {selectedConflictFile && (
                  <div className="conflict-detail">
                    <div className="conflict-detail-header">
                      <span>📄 {selectedConflictFile}</span>
                      <div className="resolution-actions">
                        <button
                          className="resolve-btn ours"
                          onClick={() => resolveConflictWithAI(selectedConflictFile, 'ours')}
                          disabled={isLoading}
                        >
                          ✓ 接受我们的
                        </button>
                        <button
                          className="resolve-btn theirs"
                          onClick={() => resolveConflictWithAI(selectedConflictFile, 'theirs')}
                          disabled={isLoading}
                        >
                          ✓ 接受他们的
                        </button>
                        <button
                          className="resolve-btn ai-manual"
                          onClick={() => resolveConflictWithAI(selectedConflictFile, 'manual')}
                          disabled={isLoading}
                        >
                          🤖 AI 合并
                        </button>
                      </div>
                    </div>

                    <div className="conflict-diff-view">
                      {conflictContent.map((line, idx) => (
                        <div key={idx} className={`conflict-diff-line ${line.type}`}>
                          <span className="line-content">{line.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {conflictFiles.length === 0 && !isLoadingConflicts && (
              <div className="empty-conflicts">
                <span className="empty-icon">✨</span>
                <p>当前没有检测到合并冲突</p>
                <p className="empty-sub">执行 git merge 或 git pull 后如有冲突会在此显示</p>
                <button onClick={detectConflicts}>手动扫描冲突</button>
              </div>
            )}
          </div>
        )}
      </div>

      {actionLog.length > 0 && (
        <div className="action-log">
          <div className="log-header">操作日志</div>
          <div className="log-content">
            {actionLog.slice(0, 10).map((log, idx) => (
              <div key={idx} className={`log-entry ${log.status}`}>
                <span className="log-time">{log.time}</span>
                <span className="log-action">{log.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const getStatusIcon = (status: GitFileStatus['status']): string => {
  const icons: Record<GitFileStatus['status'], string> = {
    modified: '✏️',
    added: '➕',
    deleted: '❌',
    renamed: '🔄',
    untracked: '❓',
    conflict: '⚠️'
  };
  return icons[status] || '📄';
};

export default GitWorkflow;
