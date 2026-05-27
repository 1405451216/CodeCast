export interface FuzzyMatchResult {
  item: string;
  score: number;
  matches: Array<{ start: number; end: number }>;
}

export class FuzzyMatcher {
  private static readonly SCORE_MATCH = 1;
  private static readonly SCORE_CONSECUTIVE = 2;
  private static readonly SCORE_START_WORD = 3;
  private static readonly SCORE_CAPITAL = 2;
  private static readonly SCORE_DOT_SEPARATOR = 4;

  static match(query: string, target: string): FuzzyMatchResult | null {
    if (!query || !target) return null;

    const queryLower = query.toLowerCase();
    const targetLower = target.toLowerCase();

    let score = 0;
    const matches: Array<{ start: number; end: number }> = [];
    let queryIndex = 0;
    let consecutiveCount = 0;

    for (let i = 0; i < targetLower.length && queryIndex < queryLower.length; i++) {
      if (targetLower[i] === queryLower[queryIndex]) {
        const isStartWord = i === 0 || target[i - 1] === ' ' || target[i - 1] === '_' || target[i - 1] === '-';
        const isCapital = target[i] !== targetLower[i];
        const isDotSeparator = target[i] === '.' && i > 0;
        const isConsecutive = matches.length > 0 && 
          matches[matches.length - 1].end === i;

        let charScore = this.SCORE_MATCH;
        
        if (isConsecutive) {
          charScore += this.SCORE_CONSECUTIVE + consecutiveCount * 0.5;
          consecutiveCount++;
        } else {
          consecutiveCount = 0;
        }

        if (isStartWord) charScore += this.SCORE_START_WORD;
        if (isCapital) charScore += this.SCORE_CAPITAL;
        if (isDotSeparator) charScore += this.SCORE_DOT_SEPARATOR;

        score += charScore;

        if (matches.length > 0 && matches[matches.length - 1].end === i) {
          matches[matches.length - 1].end = i + 1;
        } else {
          matches.push({ start: i, end: i + 1 });
        }

        queryIndex++;
      }
    }

    if (queryIndex < query.length) return null;

    const coverageRatio = query.length / target.length;
    score *= (1 + coverageRatio * 0.1);

    if (queryLower === targetLower) {
      score += 100;
    }

    return { item: target, score, matches };
  }

  static filter<T>(
    items: T[],
    query: string,
    extractor: (item: T) => string
  ): Array<{ item: T; result: FuzzyMatchResult }> {
    if (!query) {
      return items.map(item => ({
        item,
        result: { item: extractor(item), score: 0, matches: [] }
      }));
    }

    const results: Array<{ item: T; result: FuzzyMatchResult }> = [];

    for (const item of items) {
      const text = extractor(item);
      const match = this.match(query, text);
      
      if (match) {
        results.push({ item, result: match });
      }
    }

    results.sort((a, b) => b.result.score - a.result.score);

    return results;
  }

  static highlight(text: string, matches: Array<{ start: number; end: number }>): string {
    if (!matches.length) return text;

    let result = '';
    let lastIndex = 0;

    for (const match of matches) {
      result += text.slice(lastIndex, match.start);
      result += `<mark>${text.slice(match.start, match.end)}</mark>`;
      lastIndex = match.end;
    }

    result += text.slice(lastIndex);

    return result;
  }

  // ==================== Enhanced Features ====================

  static splitCamelCase(text: string): string[] {
    const result: string[] = [];
    let current = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === char.toUpperCase() && char !== char.toLowerCase() && current.length > 0) {
        if (i > 0 && text[i - 1] !== text[i - 1].toUpperCase()) {
          result.push(current);
          current = char;
        } else {
          current += char;
        }
      } else {
        current += char;
      }
    }

    if (current) result.push(current);

    return result.map(s => s.toLowerCase());
  }

  static getAcronym(text: string): string {
    const words = text.split(/[\s_-]/);
    return words.map(w => w[0] || '').join('').toLowerCase();
  }

  static levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  static enhancedMatch(query: string, target: string): FuzzyMatchResult | null {
    const exactMatch = this.match(query, target);
    if (exactMatch && exactMatch.score > 50) return exactMatch;

    const queryLower = query.toLowerCase();
    const targetLower = target.toLowerCase();

    // Try acronym matching (e.g., "js" matches "JavaScript")
    const acronym = this.getAcronym(target);
    if (acronym.includes(queryLower)) {
      return { item: target, score: 40 + (queryLower.length * 2), matches: [] };
    }

    // Try camel case split matching
    const camelParts = this.splitCamelCase(target);
    const camelJoined = camelParts.join(' ');
    if (camelJoined.includes(queryLower)) {
      return { item: target, score: 35 + (queryLower.length * 1.5), matches: [] };
    }

    // Try fuzzy substring matching with edit distance tolerance
    if (targetLower.includes(queryLower)) {
      return { item: target, score: 30 + (queryLower.length), matches: [] };
    }

    // Tolerate small spelling errors (edit distance <= 2)
    if (queryLower.length >= 3 && this.levenshteinDistance(queryLower, targetLower) <= 2) {
      return { item: target, score: 20, matches: [] };
    }

    // Partial word matching
    const words = targetLower.split(/[\s_-]/);
    for (const word of words) {
      if (word.startsWith(queryLower) || queryLower.startsWith(word)) {
        return { item: target, score: 25 + (queryLower.length * 0.5), matches: [] };
      }
    }

    return null;
  }

  static filterEnhanced<T>(
    items: T[],
    query: string,
    extractor: (item: T) => string,
    usageStats?: Map<string, number>
  ): Array<{ item: T; result: FuzzyMatchResult }> {
    if (!query) {
      return items.slice(0, 15).map(item => ({
        item,
        result: { item: extractor(item), score: 0, matches: [] }
      }));
    }

    const results: Array<{ item: T; result: FuzzyMatchResult }> = [];

    for (const item of items) {
      const text = extractor(item);
      
      // Try exact match first (highest priority)
      const exactMatch = this.match(query, text);
      if (exactMatch && exactMatch.score > 60) {
        results.push({ item, result: exactMatch });
        continue;
      }

      // Try enhanced matching
      const enhancedMatch = this.enhancedMatch(query, text);
      if (enhancedMatch) {
        // Boost by usage frequency
        if (usageStats) {
          const usageCount = usageStats.get(enhancedMatch.item) || 0;
          enhancedMatch.score += usageCount * 0.05;
        }
        
        results.push({ item, result: enhancedMatch });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.result.score - a.result.score);

    // Return top results
    return results.slice(0, 15);
  }
}

// Common aliases/synonyms for code terms
export const CODE_ALIASES: Record<string, string[]> = {
  'js': ['javascript', 'ecmascript'],
  'ts': ['typescript'],
  'py': ['python'],
  'go': ['golang'],
  'rb': ['ruby'],
  'func': ['function', 'fn', 'method'],
  'var': ['variable', 'let', 'const'],
  'arr': ['array', 'list'],
  'obj': ['object', 'dict', 'hash'],
  'str': ['string'],
  'num': ['number', 'int', 'float'],
  'bool': ['boolean'],
  'async': ['await', 'promise'],
  'comp': ['component', 'widget'],
  'hook': ['useEffect', 'useState', 'customHook'],
  'api': ['rest', 'graphql', 'endpoint'],
  'db': ['database', 'sql', 'query'],
  'test': ['spec', 'unit', 'integration', 'jest', 'pytest']
};