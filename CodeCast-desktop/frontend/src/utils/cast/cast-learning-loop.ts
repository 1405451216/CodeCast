import type {
  OperationLogEntry,
  PatternMatch,
  OperationPattern,
  CompositeSkill,
  LearningStats
} from '../../types/cast-learning';
import { CastToolRegistry } from '../../tools/CastToolRegistry';
import { CastAgentExecutor } from './cast-agent-executor';

const MAX_LOGS = 10000;
const MIN_PATTERN_FREQUENCY = 3;
const MIN_SKILL_FREQUENCY = 5;
const MIN_CONFIDENCE = 0.7;
const SESSION_GAP_MS = 5 * 60 * 1000;
const OUTPUT_PREVIEW_MAX_LENGTH = 500;

const STORAGE_KEYS = {
  LOGS: 'cast_learning_logs',
  PATTERNS: 'cast_learning_patterns',
  SKILLS: 'cast_learning_skills',
  FEEDBACK: 'cast_learning_feedback'
} as const;

function generateId(prefix: string = 'cl'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

function truncateOutput(output: string, maxLength: number = OUTPUT_PREVIEW_MAX_LENGTH): string {
  if (output.length <= maxLength) return output;
  return output.substring(0, maxLength) + '...';
}

function getTimeOfDay(timestamp: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date(timestamp).getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

function inferContextTags(toolId: string, sourcePanel: string): string[] {
  const tags: string[] = [sourcePanel];

  const toolCategoryMap: Record<string, string[]> = {
    write_document: ['writing', 'document', 'creative'],
    translate_text: ['translation', 'language', 'communication'],
    search_knowledge: ['knowledge', 'search', 'research'],
    create_schedule: ['schedule', 'planning', 'management'],
    draft_email: ['email', 'communication', 'writing'],
    analyze_data: ['analysis', 'data', 'report'],
    summarize_meeting: ['meeting', 'summary', 'notes'],
    create_todo: ['todo', 'task', 'productivity'],
    brainstorm: ['brainstorm', 'creative', 'ideas'],
    extract_keywords: ['keywords', 'analysis', 'extraction'],
    compare_texts: ['comparison', 'analysis'],
    format_convert: ['format', 'conversion', 'utility']
  };

  const extraTags = toolCategoryMap[toolId] || [];
  tags.push(...extraTags);

  return [...new Set(tags)];
}

class CastLearningLoop {
  private operationLogs: OperationLogEntry[] = [];
  private patterns: Map<string, PatternMatch> = new Map();
  private compositeSkills: Map<string, CompositeSkill> = new Map();
  private feedbackBuffer: Array<{ logId: string; feedback: 'positive' | 'negative'; timestamp: number }> = [];
  private sessionContext: {
    currentSessionOps: OperationLogEntry[];
    sessionStartTime: number;
    currentToolsUsed: Set<string>;
  } = {
    currentSessionOps: [],
    sessionStartTime: 0,
    currentToolsUsed: new Set()
  };

  constructor() {
    this.loadFromStorage();
  }

  logOperation(entry: Omit<OperationLogEntry, 'id' | 'timestamp'>): string {
    const id = generateId('log');
    const now = Date.now();

    const contextTags = entry.contextTags || inferContextTags(entry.toolId, entry.sourcePanel);

    const logEntry: OperationLogEntry = {
      ...entry,
      id,
      timestamp: now,
      outputPreview: truncateOutput(entry.outputPreview),
      contextTags
    };

    this.operationLogs.push(logEntry);

    if (this.operationLogs.length > MAX_LOGS) {
      this.operationLogs = this.operationLogs.slice(-MAX_LOGS);
    }

    this.sessionContext.currentSessionOps.push(logEntry);
    this.sessionContext.currentToolsUsed.add(entry.toolId);

    CastToolRegistry.incrementUsage(entry.toolId);

    this.saveToStorage();

    console.log(`[CastLearningLoop] Logged operation: ${entry.toolName} (${entry.toolId})`);

    return id;
  }

  batchLog(entries: Omit<OperationLogEntry, 'id' | 'timestamp'>[]): string[] {
    return entries.map(entry => this.logOperation(entry));
  }

  recordFeedback(logId: string, feedback: 'positive' | 'negative'): void {
    this.feedbackBuffer.push({
      logId,
      feedback,
      timestamp: Date.now()
    });

    const logIndex = this.operationLogs.findIndex(l => l.id === logId);
    if (logIndex !== -1) {
      this.operationLogs[logIndex].userFeedback = feedback;
    }

    this.saveToStorage();
  }

  getFeedbackSummary(): { positive: number; negative: number; neutral: number; rate: number } {
    let positive = 0;
    let negative = 0;
    let neutral = 0;

    for (const log of this.operationLogs) {
      switch (log.userFeedback) {
        case 'positive': positive++; break;
        case 'negative': negative++; break;
        default: neutral++; break;
      }
    }

    const total = positive + negative;
    const rate = total > 0 ? positive / total : 0;

    return { positive, negative, neutral, rate };
  }

  detectPatterns(timeWindow?: number): PatternMatch[] {
    const windowStart = timeWindow ? Date.now() - timeWindow : 0;
    const recentLogs = this.operationLogs.filter(l => l.timestamp >= windowStart);

    if (recentLogs.length < MIN_PATTERN_FREQUENCY * 2) {
      console.log('[CastLearningLoop] Not enough data for pattern detection');
      return [];
    }

    const sessions = this.groupOperationsBySession(recentLogs);
    const minedPatterns = this.mineFrequentSequences(sessions);
    const newPatterns: PatternMatch[] = [];

    for (const [patternKey, pattern] of minedPatterns) {
      const existingPattern = this.findExistingPattern(pattern);

      if (existingPattern) {
        existingPattern.frequency += pattern.steps.length > 0 ? 1 : 0;
        existingPattern.lastSeen = Date.now();
        existingPattern.confidence = Math.min(1, existingPattern.confidence + 0.05);
        this.patterns.set(existingPattern.id, existingPattern);
      } else {
        const stats = this.calculatePatternStats(pattern, recentLogs);
        if (stats.frequency >= MIN_PATTERN_FREQUENCY && stats.successRate > 0.8) {
          const newMatch: PatternMatch = {
            id: generateId('pat'),
            pattern,
            frequency: stats.frequency,
            lastSeen: Date.now(),
            confidence: Math.min(0.9, stats.successRate),
            avgExecutionTime: stats.avgTime,
            successRate: stats.successRate,
            suggestedName: this.generatePatternName(pattern),
            suggestedDescription: this.generatePatternDescription(pattern)
          };

          this.patterns.set(newMatch.id, newMatch);
          newPatterns.push(newMatch);
        }
      }
    }

    this.saveToStorage();
    return newPatterns;
  }

  private groupOperationsBySession(ops: OperationLogEntry[]): OperationLogEntry[][] {
    const sessions: OperationLogEntry[][] = [];
    let currentSession: OperationLogEntry[] = [];

    const sortedOps = [...ops].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < sortedOps.length; i++) {
      const op = sortedOps[i];

      if (currentSession.length === 0) {
        currentSession.push(op);
        continue;
      }

      const lastOp = currentSession[currentSession.length - 1];
      const sameSession = op.sessionId && op.sessionId === lastOp.sessionId;
      const timeClose = (op.timestamp - lastOp.timestamp) < SESSION_GAP_MS;

      if (sameSession || timeClose) {
        currentSession.push(op);
      } else {
        if (currentSession.length >= 2) {
          sessions.push(currentSession);
        }
        currentSession = [op];
      }
    }

    if (currentSession.length >= 2) {
      sessions.push(currentSession);
    }

    return sessions;
  }

  private mineFrequentSequences(sessions: OperationLogEntry[][]): Map<string, OperationPattern> {
    const sequenceCounts: Map<string, {
      count: number;
      steps: Array<{ toolId: string; order: number; typicalParams: Record<string, unknown>; paramVariability: number }>;
      contexts: Array<{ sourcePanels: string[]; timeOfDay: OperationPattern['context']['timeOfDay']; dayOfWeek: number }>;
      executions: number[];
      successes: number;
    }> = new Map();

    for (const session of sessions) {
      for (let len = 2; len <= Math.min(session.length, 5); len++) {
        for (let start = 0; start <= session.length - len; start++) {
          const sequence = session.slice(start, start + len);
          const key = sequence.map(s => s.toolId).join('->');

          const existing = sequenceCounts.get(key);
          if (existing) {
            existing.count++;
            this.updateTypicalParams(existing.steps, sequence);
            existing.executions.push(sequence.reduce((sum, s) => sum + s.executionTime, 0));
            existing.successes += sequence.every(s => s.success) ? 1 : 0;
          } else {
            const steps = sequence.map((s, idx) => ({
              toolId: s.toolId,
              order: idx,
              typicalParams: { ...s.inputParams },
              paramVariability: 0
            }));

            sequenceCounts.set(key, {
              count: 1,
              steps,
              contexts: [{
                sourcePanels: [...new Set(sequence.map(s => s.sourcePanel))],
                timeOfDay: getTimeOfDay(sequence[0].timestamp),
                dayOfWeek: new Date(sequence[0].timestamp).getDay()
              }],
              executions: [sequence.reduce((sum, s) => sum + s.executionTime, 0)],
              successes: sequence.every(s => s.success) ? 1 : 0
            });
          }
        }
      }
    }

    const resultPatterns = new Map<string, OperationPattern>();

    for (const [key, data] of sequenceCounts) {
      if (data.count >= MIN_PATTERN_FREQUENCY) {
        const avgSuccessRate = data.successes / data.count;
        if (avgSuccessRate > 0.8) {
          const sourcePanels = [...new Set(data.contexts.flatMap(c => c.sourcePanels))];
          const mostCommonTime = this.getMostCommon(data.contexts.map(c => c.timeOfDay));
          const mostCommonDay = this.getMostCommon(data.contexts.map(c => c.dayOfWeek));

          let sessionType: OperationPattern['context']['sessionType'] = 'single_task';
          if (data.steps.length >= 4) sessionType = 'batch_process';
          else if (sourcePanels.length > 2) sessionType = 'exploration';

          resultPatterns.set(key, {
            steps: data.steps,
            context: {
              sourcePanels,
              timeOfDay: mostCommonTime,
              dayOfWeek: mostCommonDay,
              sessionType
            }
          });
        }
      }
    }

    return resultPatterns;
  }

  private updateTypicalParams(
    existingSteps: Array<{ toolId: string; order: number; typicalParams: Record<string, unknown>; paramVariability: number }>,
    newSequence: OperationLogEntry[]
  ): void {
    for (let i = 0; i < existingSteps.length && i < newSequence.length; i++) {
      const existing = existingSteps[i];
      const newOp = newSequence[i];

      if (existing.toolId === newOp.toolId) {
        const keys = new Set([...Object.keys(existing.typicalParams), ...Object.keys(newOp.inputParams)]);
        let diffCount = 0;
        let totalParams = 0;

        for (const key of keys) {
          const existingVal = JSON.stringify(existing.typicalParams[key]);
          const newVal = JSON.stringify(newOp.inputParams[key as keyof typeof newOp.inputParams]);

          if (existingVal !== newVal) diffCount++;
          totalParams++;

          if (!existing.typicalParams[key as keyof typeof existing.typicalParams] || Math.random() > 0.7) {
            existing.typicalParams[key] = newOp.inputParams[key as keyof typeof newOp.inputParams];
          }
        }

        existing.paramVariability = totalParams > 0 ? diffCount / totalParams : 0;
      }
    }
  }

  private calculatePatternStats(pattern: OperationPattern, allLogs: OperationLogEntry[]): {
    frequency: number;
    avgTime: number;
    successRate: number;
  } {
    const toolSequence = pattern.steps.map(s => s.toolId);
    let frequency = 0;
    let totalTime = 0;
    let successes = 0;

    const sessions = this.groupOperationsBySession(allLogs);

    for (const session of sessions) {
      for (let i = 0; i <= session.length - toolSequence.length; i++) {
        const window = session.slice(i, i + toolSequence.length);
        const match = window.every((op, idx) => op.toolId === toolSequence[idx]);

        if (match) {
          frequency++;
          totalTime += window.reduce((sum, op) => sum + op.executionTime, 0);
          if (window.every(op => op.success)) successes++;
        }
      }
    }

    return {
      frequency,
      avgTime: frequency > 0 ? totalTime / frequency : 0,
      successRate: frequency > 0 ? successes / frequency : 0
    };
  }

  private findExistingPattern(pattern: OperationPattern): PatternMatch | undefined {
    const toolSequence = pattern.steps.map(s => s.toolId).join('->');

    for (const [, existing] of this.patterns) {
      const existingSequence = existing.pattern.steps.map(s => s.toolId).join('->');
      if (existingSequence === toolSequence) {
        return existing;
      }
    }

    return undefined;
  }

  private generatePatternName(pattern: OperationPattern): string {
    const toolNames = pattern.steps.map(s => {
      const tool = CastToolRegistry.get(s.toolId);
      return tool ? tool.name : s.toolId;
    });

    if (toolNames.length <= 3) {
      return toolNames.join('+');
    }

    return `${toolNames[0]}+${toolNames[1]}+...等${toolNames.length}步`;
  }

  private generatePatternDescription(pattern: OperationPattern): string {
    const toolNames = pattern.steps.map(s => {
      const tool = CastToolRegistry.get(s.toolId);
      return tool ? tool.name : s.toolId;
    });

    if (toolNames.length === 2) {
      return `自动完成${toolNames[0]}后执行${toolNames[1]}`;
    }

    return `自动完成工作流：${toolNames.join(' -> ')}`;
  }

  generateCompositeSkill(pattern: PatternMatch): CompositeSkill | null {
    if (pattern.frequency < MIN_SKILL_FREQUENCY || pattern.confidence < MIN_CONFIDENCE) {
      return null;
    }

    const existingSkill = this.findExistingSkillForPattern(pattern);
    if (existingSkill) {
      return existingSkill;
    }

    const toolSequence = pattern.pattern.steps.map(s => s.toolId);
    const executionSteps = pattern.pattern.steps.map(step => {
      const paramsMapping: Record<string, string> = {};
      if (step.order === 0) {
        paramsMapping['userInput'] = 'input';
      } else {
        paramsMapping['previousOutput'] = 'input';
      }
      return {
        toolId: step.toolId,
        paramsMapping,
        condition: step.order > 0 ? 'previousStepSuccess' : undefined
      };
    });

    const keywords = this.extractKeywordsFromPattern(pattern);

    const skill: CompositeSkill = {
      id: generateId('skill'),
      name: pattern.suggestedName,
      description: pattern.suggestedDescription,
      version: '1.0.0',
      sourcePattern: pattern.pattern,
      generatedFrom: 'auto_learned',
      triggerConditions: {
        keywordPatterns: keywords,
        toolSequence,
        minFrequency: MIN_SKILL_FREQUENCY
      },
      executionSteps,
      stats: {
        timesUsed: 0,
        avgTimeSaved: pattern.avgExecutionTime * (pattern.pattern.steps.length - 1),
        successRate: pattern.successRate,
        lastUsedAt: 0,
        createdAt: Date.now()
      },
      enabled: false,
      userApproved: false
    };

    this.compositeSkills.set(skill.id, skill);
    this.saveToStorage();

    console.log(`[CastLearningLoop] Generated composite skill: ${skill.name}`);

    return skill;
  }

  private findExistingSkillForPattern(pattern: PatternMatch): CompositeSkill | undefined {
    const toolSequence = pattern.pattern.steps.map(s => s.toolId).join('->');

    for (const [, skill] of this.compositeSkills) {
      const skillSequence = skill.triggerConditions.toolSequence.join('->');
      if (skillSequence === toolSequence) {
        return skill;
      }
    }

    return undefined;
  }

  private extractKeywordsFromPattern(pattern: PatternMatch): string[] {
    const keywords: Set<string> = new Set();

    for (const step of pattern.pattern.steps) {
      const tool = CastToolRegistry.get(step.toolId);
      if (tool) {
        keywords.add(tool.name.toLowerCase());
        keywords.add(tool.description.toLowerCase());

        for (const tag of tool.tags) {
          keywords.add(tag.toLowerCase());
        }
      }

      for (const [key, value] of Object.entries(step.typicalParams)) {
        if (typeof value === 'string' && value.length > 2) {
          keywords.add(value.toLowerCase());
        }
      }
    }

    keywords.add(pattern.suggestedName.toLowerCase());

    return Array.from(keywords)
      .filter(k => k.length > 1 && !STOP_WORDS.has(k))
      .slice(0, 10);
  }

  autoGenerateSkills(): CompositeSkill[] {
    const newSkills: CompositeSkill[] = [];

    for (const [, pattern] of this.patterns) {
      const skill = this.generateCompositeSkill(pattern);
      if (skill && !newSkills.includes(skill)) {
        newSkills.push(skill);
      }
    }

    this.saveToStorage();
    return newSkills;
  }

  getSkill(id: string): CompositeSkill | undefined {
    return this.compositeSkills.get(id);
  }

  getAllSkills(): CompositeSkill[] {
    return Array.from(this.compositeSkills.values())
      .sort((a, b) => b.stats.createdAt - a.stats.createdAt);
  }

  getEnabledSkills(): CompositeSkill[] {
    return this.getAllSkills().filter(s => s.enabled && s.userApproved);
  }

  async executeSkill(skillId: string, userInput: string): Promise<unknown> {
    const skill = this.compositeSkills.get(skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    if (!skill.enabled || !skill.userApproved) {
      throw new Error(`Skill "${skill.name}" is not approved or enabled`);
    }

    let previousOutput: string = userInput;
    const results: unknown[] = [];

    for (const step of skill.executionSteps) {
      if (step.condition === 'previousStepSuccess' && !previousOutput) {
        console.warn(`[CastLearningLoop] Skipping step ${step.toolId} due to condition`);
        continue;
      }

      const tool = CastToolRegistry.get(step.toolId);
      if (!tool) {
        throw new Error(`Tool not found in skill execution: ${step.toolId}`);
      }

      const params: Record<string, unknown> = {};
      for (const [mappingKey, paramKey] of Object.entries(step.paramsMapping)) {
        if (mappingKey === 'userInput') {
          params[paramKey] = userInput;
        } else if (mappingKey === 'previousOutput') {
          params[paramKey] = previousOutput;
        }
      }

      try {
        const startTime = Date.now();
        const result = await tool.execute(params, {});
        const executionTime = Date.now() - startTime;

        previousOutput = result.output || '';
        results.push(result.output);

        this.logOperation({
          toolId: step.toolId,
          toolName: tool.name,
          category: tool.category,
          inputParams: params,
          outputPreview: result.output || '',
          outputLength: (result.output || '').length,
          executionTime,
          success: result.success,
          error: result.error,
          sourcePanel: 'agent'
        });
      } catch (error: any) {
        console.error(`[CastLearningLoop] Skill execution error at step ${step.toolId}:`, error.message);
        throw error;
      }
    }

    skill.stats.timesUsed++;
    skill.stats.lastUsedAt = Date.now();
    this.saveToStorage();

    return results;
  }

  enableSkill(id: string): void {
    const skill = this.compositeSkills.get(id);
    if (skill) {
      skill.enabled = true;
      this.saveToStorage();
    }
  }

  disableSkill(id: string): void {
    const skill = this.compositeSkills.get(id);
    if (skill) {
      skill.enabled = false;
      this.saveToStorage();
    }
  }

  deleteSkill(id: string): void {
    this.compositeSkills.delete(id);
    this.saveToStorage();
  }

  approveSkill(id: string): void {
    const skill = this.compositeSkills.get(id);
    if (skill) {
      skill.userApproved = true;
      skill.enabled = true;
      this.saveToStorage();
    }
  }

  rejectSkill(id: string, _reason?: string): void {
    const skill = this.compositeSkills.get(id);
    if (skill) {
      skill.userApproved = false;
      skill.enabled = false;
      this.saveToStorage();
    }
  }

  getStats(): LearningStats {
    const allSkills = this.getAllSkills();
    const enabledSkills = allSkills.filter(s => s.enabled && s.userApproved);
    const topPatterns = Array.from(this.patterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)
      .map(p => ({ name: p.suggestedName, freq: p.frequency }));

    const timestamps = this.operationLogs.map(l => l.timestamp);
    const coverageDays = timestamps.length > 0
      ? Math.ceil((Math.max(...timestamps) - Math.min(...timestamps)) / (1000 * 60 * 60 * 24))
      : 0;

    const skillsCreatedInLastWeek = allSkills.filter(
      s => s.stats.createdAt > Date.now() - 7 * 24 * 60 * 60 * 1000
    ).length;

    const learningRate = skillsCreatedInLastWeek / 7;

    const totalTimeSaved = enabledSkills.reduce(
      (sum, s) => sum + s.stats.avgTimeSaved * s.stats.timesUsed, 0
    );
    const totalManualTime = this.operationLogs.reduce(
      (sum, l) => sum + l.executionTime, 0
    );
    const efficiencyGain = totalManualTime > 0
      ? Math.min(99, (totalTimeSaved / totalManualTime) * 100)
      : 0;

    return {
      totalOperationsLogged: this.operationLogs.length,
      totalPatternsDetected: this.patterns.size,
      totalSkillsGenerated: allSkills.length,
      activeSkillsCount: enabledSkills.length,
      topPatterns,
      learningRate: Math.round(learningRate * 100) / 100,
      efficiencyGain: Math.round(efficiencyGain * 10) / 10,
      dataCoverageDays: coverageDays
    };
  }

  getRecentPatterns(limit: number = 10): PatternMatch[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, limit);
  }

  getTopSkills(limit: number = 10): CompositeSkill[] {
    return this.getAllSkills()
      .sort((a, b) => b.stats.timesUsed - a.stats.timesUsed)
      .slice(0, limit);
  }

  getLearningInsights(): string[] {
    const insights: string[] = [];

    const panelUsage = new Map<string, number>();
    const hourlyUsage = new Map<number, number>();
    const dailyUsage = new Map<number, number>();

    for (const log of this.operationLogs.slice(-500)) {
      const count = panelUsage.get(log.sourcePanel) || 0;
      panelUsage.set(log.sourcePanel, count + 1);

      const hour = new Date(log.timestamp).getHours();
      const hourCount = hourlyUsage.get(hour) || 0;
      hourlyUsage.set(hour, hourCount + 1);

      const day = new Date(log.timestamp).getDay();
      const dayCount = dailyUsage.get(day) || 0;
      dailyUsage.set(day, dayCount + 1);
    }

    const topPanels = Array.from(panelUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (topPanels.length >= 2) {
      insights.push(`你最常使用"${topPanels[0][0]}"和"${topPanels[1][0]}"面板`);
    }

    const peakHour = Array.from(hourlyUsage.entries())
      .sort((a, b) => b[1] - a[1])[0];

    if (peakHour) {
      const period = peakHour[0] < 12 ? '上午' : peakHour[0] < 18 ? '下午' : '晚上';
      insights.push(`你活跃时间集中在${period}（${peakHour[0]}点左右使用最频繁）`);
    }

    const topDay = Array.from(dailyUsage.entries())
      .sort((a, b) => b[1] - a[1])[0];

    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    if (topDay) {
      insights.push(`${dayNames[topDay[0]]}是你最活跃的工作日`);
    }

    for (const pattern of this.getRecentPatterns(3)) {
      if (pattern.frequency >= 5) {
        const toolNames = pattern.pattern.steps.map(s => {
          const tool = CastToolRegistry.get(s.toolId);
          return tool ? tool.name : s.toolId;
        });
        insights.push(`你经常在完成"${toolNames[0]}"后紧接着使用"${toolNames[1]}"（已发现${pattern.frequency}次）`);
      }
    }

    const pendingSkills = this.getAllSkills().filter(s => !s.userApproved);
    if (pendingSkills.length > 0) {
      insights.push(`推荐审批"${pendingSkills[0].name}"技能以提升效率（可节省约${Math.round(pendingSkills[0].stats.avgTimeSaved / 1000)}秒/次）`);
    }

    const feedbackSummary = this.getFeedbackSummary();
    if (feedbackSummary.positive + feedbackSummary.negative > 10) {
      if (feedbackSummary.rate > 0.8) {
        insights.push(`你的操作质量很高，正向反馈率${Math.round(feedbackSummary.rate * 100)}%`);
      } else if (feedbackSummary.rate < 0.5) {
        insights.push(`近期操作遇到一些问题，建议检查失败的操作记录`);
      }
    }

    return insights.slice(0, 8);
  }

  saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(this.operationLogs.slice(-5000)));
      localStorage.setItem(STORAGE_KEYS.PATTERNS, JSON.stringify(Array.from(this.patterns.entries())));
      localStorage.setItem(STORAGE_KEYS.SKILLS, JSON.stringify(Array.from(this.compositeSkills.entries())));
      localStorage.setItem(STORAGE_KEYS.FEEDBACK, JSON.stringify(this.feedbackBuffer.slice(-1000)));
    } catch (error) {
      console.error('[CastLearningLoop] Save to storage failed:', error);
    }
  }

  loadFromStorage(): void {
    try {
      const logsRaw = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (logsRaw) {
        this.operationLogs = JSON.parse(logsRaw);
      }

      const patternsRaw = localStorage.getItem(STORAGE_KEYS.PATTERNS);
      if (patternsRaw) {
        const entries = JSON.parse(patternsRaw);
        this.patterns = new Map(entries);
      }

      const skillsRaw = localStorage.getItem(STORAGE_KEYS.SKILLS);
      if (skillsRaw) {
        const entries = JSON.parse(skillsRaw);
        this.compositeSkills = new Map(entries);
      }

      const feedbackRaw = localStorage.getItem(STORAGE_KEYS.FEEDBACK);
      if (feedbackRaw) {
        this.feedbackBuffer = JSON.parse(feedbackRaw);
      }
    } catch (error) {
      console.error('[CastLearningLoop] Load from storage failed:', error);
    }
  }

  exportData(): string {
    return JSON.stringify({
      version: '1.0.0',
      exportTime: new Date().toISOString(),
      operationLogs: this.operationLogs,
      patterns: Array.from(this.patterns.entries()),
      compositeSkills: Array.from(this.compositeSkills.entries()),
      feedbackBuffer: this.feedbackBuffer
    }, null, 2);
  }

  importData(json: string): { logsImported: number; skillsImported: number } {
    try {
      const data = JSON.parse(json);

      const importedLogs: OperationLogEntry[] = data.operationLogs || [];
      const importedPatterns = data.patterns || [];
      const importedSkills = data.compositeSkills || [];

      const existingLogIds = new Set(this.operationLogs.map(l => l.id));
      const newLogs = importedLogs.filter((l: OperationLogEntry) => !existingLogIds.has(l.id));

      this.operationLogs = [...this.operationLogs, ...newLogs].slice(-MAX_LOGS);

      for (const [id, pattern] of importedPatterns) {
        if (!this.patterns.has(id)) {
          this.patterns.set(id, pattern as PatternMatch);
        }
      }

      let skillsImported = 0;
      for (const [id, skill] of importedSkills) {
        if (!this.compositeSkills.has(id)) {
          this.compositeSkills.set(id, skill as CompositeSkill);
          skillsImported++;
        }
      }

      this.saveToStorage();

      return {
        logsImported: newLogs.length,
        skillsImported
      };
    } catch (error) {
      console.error('[CastLearningLoop] Import failed:', error);
      return { logsImported: 0, skillsImported: 0 };
    }
  }

  clearAll(): void {
    this.operationLogs = [];
    this.patterns.clear();
    this.compositeSkills.clear();
    this.feedbackBuffer = [];
    this.sessionContext = {
      currentSessionOps: [],
      sessionStartTime: 0,
      currentToolsUsed: new Set()
    };

    try {
      localStorage.removeItem(STORAGE_KEYS.LOGS);
      localStorage.removeItem(STORAGE_KEYS.PATTERNS);
      localStorage.removeItem(STORAGE_KEYS.SKILLS);
      localStorage.removeItem(STORAGE_KEYS.FEEDBACK);
    } catch (error) {
      console.error('[CastLearningLoop] Clear storage failed:', error);
    }
  }

  startSession(): void {
    this.sessionContext = {
      currentSessionOps: [],
      sessionStartTime: Date.now(),
      currentToolsUsed: new Set()
    };
  }

  endSession(): OperationLogEntry[] {
    const ops = [...this.sessionContext.currentSessionOps];
    this.sessionContext.currentSessionOps = [];
    return ops;
  }

  getCurrentSessionOps(): OperationLogEntry[] {
    return this.sessionContext.currentSessionOps;
  }

  private getMostCommon<T>(values: T[]): T | undefined {
    if (values.length === 0) return undefined;

    const counts = new Map<T, number>();
    for (const v of values) {
      counts.set(v, (counts.get(v) || 0) + 1);
    }

    let maxCount = 0;
    let mostCommon: T | undefined;

    for (const [value, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = value;
      }
    }

    return mostCommon;
  }
}

export const castLearning = new CastLearningLoop();

const STOP_WORDS: Set<string> = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
  'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also',
  'no', 'yes', 'it', 'its', 'this', 'that', 'these', 'those',
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'they', 'them', 'their', 'theirs', 'themselves',
  'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'any', 'only', 'own', 'same', 'than', 'too',
  '的', '了', '是', '在', '和', '与', '或', '但', '而', '也', '就',
  '都', '这', '那', '有', '不', '要', '会', '能', '可以', '把',
  '被', '让', '给', '从', '到', '对', '为', '以', '及', '等',
  '很', '非常', '更', '最', '已', '已经', '正在', '将', '关于'
]);

export function extractKeywords(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));

  const wordFreq = new Map<string, number>();
  for (const word of words) {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  }

  return Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}

export function suggestActionsBasedOnHistory(): Array<{ action: string; confidence: number; reason: string }> {
  const suggestions: Array<{ action: string; confidence: number; reason: string }> = [];

  const recentLogs = castLearning.getCurrentSessionOps();
  if (recentLogs.length === 0) return suggestions;

  const lastTool = recentLogs[recentLogs.length - 1];
  const patterns = castLearning.getRecentPatterns(5);

  for (const pattern of patterns) {
    const firstStep = pattern.pattern.steps[0];
    if (firstStep.toolId === lastTool.toolId && pattern.pattern.steps.length > 1) {
      const nextTool = CastToolRegistry.get(pattern.pattern.steps[1].toolId);
      if (nextTool) {
        suggestions.push({
          action: `使用${nextTool.name}`,
          confidence: Math.min(0.95, 0.6 + pattern.confidence * 0.3),
          reason: `根据历史模式，完成"${lastTool.toolName}"后通常接下来会使用"${nextTool.name}"（已发现${pattern.frequency}次）`
        });
      }
    }
  }

  const topSkills = castLearning.getTopSkills(3).filter(s => s.enabled && s.userApproved);
  for (const skill of topSkills) {
    const matchesKeyword = skill.triggerConditions.keywordPatterns.some(keyword =>
      lastTool.toolName.toLowerCase().includes(keyword.toLowerCase()) ||
      lastTool.toolId.toLowerCase().includes(keyword.toLowerCase())
    );

    if (matchesKeyword) {
      suggestions.push({
        action: `执行复合技能"${skill.name}"`,
        confidence: 0.7 + (skill.stats.successRate * 0.2),
        reason: `"${skill.name}"技能与当前操作匹配，历史成功率${Math.round(skill.stats.successRate * 100)}%`
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}
