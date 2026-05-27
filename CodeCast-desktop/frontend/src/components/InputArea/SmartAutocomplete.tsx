import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

type AutocompleteType = 'text' | 'command' | 'context' | 'code' | 'smart' | 'inline';

interface AutocompleteItem {
  type: AutocompleteType;
  text: string;
  display: string;
  description?: string;
  icon?: string;
  confidence?: number;
}

interface SmartAutocompleteProps {
  visible: boolean;
  items: AutocompleteItem[];
  selectedIndex: number;
  onSelect: (item: AutocompleteItem) => void;
  onNavigate: (index: number) => void;
  onClose: () => void;
  position: { top: number; left: number };
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  inputValue: string;
  cursorPosition: number;
  autoTrigger?: boolean;
  debounceMs?: number;
}

const SMART_PATTERNS: Array<{ pattern: RegExp; suggestions: AutocompleteItem[] }> = [
  {
    pattern: /const\s+\w+\s*=\s*$/,
    suggestions: [
      { type: 'smart', text: '[]', display: '空数组', description: '初始化数组', icon: '📦', confidence: 0.95 },
      { type: 'smart', text: '{}', display: '空对象', description: '初始化对象', icon: '📋', confidence: 0.9 },
      { type: 'smart', text: "''", display: '空字符串', description: '初始化字符串', icon: '📝', confidence: 0.85 },
      { type: 'smart', text: 'null', display: 'Null', description: 'Null 值', icon: '⭕', confidence: 0.8 },
      { type: 'smart', text: 'undefined', display: 'Undefined', description: '未定义值', icon: '❓', confidence: 0.75 }
    ]
  },
  {
    pattern: /import\s+\w*\s*from\s*['"]?$/,
    suggestions: [
      { type: 'smart', text: "'react'", display: 'react', description: 'React 库', icon: '⚛️', confidence: 0.98 },
      { type: 'smart', text: "'react-dom'", display: 'react-dom', description: 'React DOM', icon: '🌐', confidence: 0.9 },
      { type: 'smart', text: "../", display: '../ 相对路径', description: '相对路径导入', icon: '📁', confidence: 0.85 },
      { type: 'smart', text: './', display: './ 当前目录', description: '当前目录导入', icon: '📂', confidence: 0.85 }
    ]
  },
  {
    pattern: /\.(map|filter|reduce|find|some|every|forEach)\s*\(.*\)\s*$/,
    suggestions: [
      { type: 'smart', text: '.chain()', display: '.chain()', description: '链式调用', icon: '🔗', confidence: 0.88 },
      { type: 'smart', text: '\n\treturn ', display: 'Return 语句', description: '添加返回值', icon: '↩️', confidence: 0.92 }
    ]
  },
  {
    pattern: /async\s+function\s+\w+\s*\([^)]*\)\s*\{?\s*$/,
    suggestions: [
      { type: 'smart', text: '\n  try {\n    const result = await \n    return result;\n  } catch (error) {\n    console.error(error);\n    throw error;\n  }', display: 'Try-Catch 模板', description: '异步错误处理', icon: '🛡️', confidence: 0.96 },
      { type: 'smart', text: '\n  const response = await fetch(url);', display: 'Fetch 调用', description: 'HTTP 请求', icon: '🌐', confidence: 0.9 }
    ]
  },
  {
    pattern: /console\.(log|warn|error|info)\s*\(\s*$/,
    suggestions: [
      { type: 'smart', text: "'[Debug]':", display: '[Debug] 前缀', description: '调试前缀', icon: '🔍', confidence: 0.87 },
      { type: 'smart', text: '{ variableName }:', display: '对象解构日志', description: '结构化日志', icon: '📊', confidence: 0.84 },
      { type: 'smart', text: "`${}`:", display: '模板字符串', description: '模板输出', icon: '✨', confidence: 0.82 }
    ]
  },
  {
    pattern: /\b(if|else if|while|for)\s*\(.*\)\s*\{?\s*$/,
    suggestions: [
      { type: 'smart', text: '\n  // TODO: implement\n', display: 'TODO 注释', description: '待实现标记', icon: '📌', confidence: 0.89 },
      { type: 'smart', text: '\n  console.log();', display: 'Console.log', description: '调试输出', icon: '💻', confidence: 0.78 }
    ]
  },
  {
    pattern: /class\s+\w+\s+(extends\s+\w+)?\s*\{?\s*$/,
    suggestions: [
      { type: 'smart', text: '\n  constructor() {\n    super();\n    \n  }\n', display: 'Constructor', description: '构造函数模板', icon: '🏗️', confidence: 0.94 },
      { type: 'smart', text: '\n  static className = \'\';', display: '静态属性', description: '类静态属性', icon: '📎', confidence: 0.86 }
    ]
  },
  {
    pattern: /use(State|Effect|Callback|Memo|Ref|Context|Reducer)\s*\(\s*$/,
    suggestions: [
      { type: 'smart', text: '', display: '(初始值)', description: 'Hook 初始值', icon: '🪝', confidence: 0.91 },
      { type: 'smart', text: '() => {\n    \n  }, []', display: 'Effect 依赖', description: 'Effect 回调和依赖', icon: '⚡', confidence: 0.87 }
    ]
  },
  {
    pattern: /export\s+(default\s+)?(function|const|class|async)?\s*$/,
    suggestions: [
      { type: 'smart', text: 'function ', display: '导出函数', description: '命名导出函数', icon: '📤', confidence: 0.92 },
      { type: 'smart', text: 'const ', display: '导出常量', description: '导出常量/变量', icon: '📦', confidence: 0.88 },
      { type: 'smart', text: 'class ', display: '导出类', description: '导出类定义', icon: '🏛️', confidence: 0.86 }
    ]
  },
  {
    pattern: /\/\/\s*@todo|@fixme|@hack|@optimize/i,
    suggestions: [
      { type: 'smart', text: ': 实现此功能', display: ': 实现此功能', description: 'TODO 描述模板', icon: '✅', confidence: 0.93 },
      { type: 'smart', text: ': 需要优化性能', display: ': 需要优化性能', description: '优化标记', icon: '⚡', confidence: 0.88 }
    ]
  }
];

const INLINE_COMPLETIONS: Record<string, string[]> = {
  'log': ['log(', 'warn(', 'error(', 'info(', 'debug(', 'table(', 'group(', 'groupEnd('],
  'conso': ['console.', 'console.log(', 'console.error(', 'console.warn('],
  'docum': ['document.', 'document.getElementById(', 'document.querySelector(', 'document.createElement('],
  'windo': ['window.', 'window.addEventListener(', 'window.location', 'window.fetch('],
  'promi': ['Promise.resolve(', 'Promise.reject(', 'new Promise((resolve, reject) => {'],
  'json.': ['JSON.parse(', 'JSON.stringify(', 'JSON.parse(localStorage.getItem('],
  'math.': ['Math.floor(', 'Math.ceil(', 'Math.round(', 'Math.random(', 'Math.max(', 'Math.min('],
  'date.': ['new Date(', 'Date.now(', 'Date.parse('],
  'array': ['Array.from(', 'Array.isArray(', 'Array.prototype.'],
  'object': ['Object.keys(', 'Object.values(', 'Object.entries(', 'Object.assign(']
};

const SmartAutocomplete: React.FC<SmartAutocompleteProps> = ({
  visible,
  items,
  selectedIndex,
  onSelect,
  onNavigate,
  onClose,
  position,
  textareaRef,
  inputValue,
  cursorPosition,
  autoTrigger = true,
  debounceMs = 300
}) => {
  const [smartSuggestions, setSmartSuggestions] = useState<AutocompleteItem[]>([]);
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInputValue = useRef('');
  const containerRef = useRef<HTMLDivElement>(null);

  const getInlineCompletions = useCallback((input: string): AutocompleteItem[] => {
    const completions: AutocompleteItem[] = [];
    
    for (const [prefix, matches] of Object.entries(INLINE_COMPLETIONS)) {
      if (input.toLowerCase().includes(prefix.toLowerCase())) {
        matches.forEach(match => {
          completions.push({
            type: 'inline',
            text: match,
            display: match.replace(/[()]$/, ''),
            description: `${prefix} 相关方法`,
            icon: '💡',
            confidence: 0.82 + Math.random() * 0.1
          });
        });
      }
    }

    return completions.slice(0, 5);
  }, []);

  const getContextualSuggestions = useCallback((input: string): AutocompleteItem[] => {
    const allSuggestions: AutocompleteItem[] = [];
    const lines = input.split('\n');
    const currentLine = lines[lines.length - 1] || '';

    for (const { pattern, suggestions } of SMART_PATTERNS) {
      if (pattern.test(currentLine)) {
        allSuggestions.push(...suggestions);
      }
    }

    if (currentLine.trim().endsWith('{') || currentLine.trim().endsWith('(')) {
      allSuggestions.push({
        type: 'smart',
        text: '\n  ',
        display: '缩进换行',
        description: '添加缩进和新行',
        icon: '↵',
        confidence: 0.79
      });
    }

    return allSuggestions.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  }, []);

  useEffect(() => {
    if (!autoTrigger || !visible) return;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (inputValue !== lastInputValue.current && inputValue.length > 2) {
        const smart = getContextualSuggestions(inputValue);
        const inline = getInlineCompletions(inputValue);
        
        const combined = [...smart, ...inline].slice(0, 8);
        
        if (combined.length > 0) {
          setSmartSuggestions(combined);
          setShowSmartSuggestions(true);
        } else {
          setShowSmartSuggestions(false);
        }
        
        lastInputValue.current = inputValue;
      }
    }, debounceMs);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [inputValue, autoTrigger, debounceMs, getContextualSuggestions, getInlineCompletions, visible]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSmartSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectItem = useCallback((item: AutocompleteItem) => {
    onSelect(item);
    setShowSmartSuggestions(false);
  }, [onSelect]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!showSmartSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        onNavigate(Math.min(selectedIndex + 1, smartSuggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        onNavigate(Math.max(selectedIndex - 1, 0));
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (smartSuggestions[selectedIndex]) {
          handleSelectItem(smartSuggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSmartSuggestions(false);
        onClose();
        break;
    }
  }, [showSmartSuggestions, selectedIndex, smartSuggestions, onNavigate, onSelect, handleSelectItem, onClose]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.addEventListener('keydown', handleKeyDown as EventListener);
    return () => {
      textarea.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [textareaRef, handleKeyDown]);

  const displayItems = showSmartSuggestions && smartSuggestions.length > 0 
    ? smartSuggestions 
    : items;

  if (!visible || displayItems.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={`smart-autocomplete ${showSmartSuggestions ? 'smart-mode' : ''}`}
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        zIndex: 1000
      }}
      role="listbox"
      aria-label="智能补全建议"
    >
      {showSmartSuggestions && (
        <div className="autocomplete-header">
          <span className="header-icon">✨</span>
          <span className="header-text">智能建议</span>
          <span className="header-count">{displayItems.length} 个</span>
        </div>
      )}
      
      <div className="autocomplete-list">
        {displayItems.map((item, index) => (
          <div
            key={`${item.type}-${item.text}-${index}`}
            className={`autocomplete-item ${index === selectedIndex ? 'selected' : ''} ${item.type}`}
            onClick={() => handleSelectItem(item)}
            onMouseEnter={() => onNavigate(index)}
            role="option"
            aria-selected={index === selectedIndex}
          >
            <div className="item-main">
              <span className="item-icon">{item.icon || '💡'}</span>
              <span className="item-text">{item.display}</span>
              {item.confidence && item.confidence > 0.9 && (
                <span className="item-badge hot">热门</span>
              )}
            </div>
            
            {item.description && (
              <div className="item-description">{item.description}</div>
            )}
            
            {item.type === 'smart' && (
              <div className="item-preview">
                {item.text.split('\n')[0].slice(0, 40)}
                {item.text.length > 40 ? '...' : ''}
              </div>
            )}
          </div>
        ))}
      </div>

      {showSmartSuggestions && (
        <div className="autocomplete-footer">
          <span className="footer-hint">
            <kbd>↑↓</kbd> 选择 · <kbd>Tab</kbd> 应用 · <kbd>Esc</kbd> 关闭
          </span>
        </div>
      )}
    </div>
  );
};

export default SmartAutocomplete;
export type { AutocompleteItem, AutocompleteType };
