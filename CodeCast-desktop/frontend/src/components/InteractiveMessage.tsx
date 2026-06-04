import React, { useState, useCallback, useMemo } from 'react';
import InlineCodeEditor from './InlineCodeEditor';
import * as api from '../api';
import { formatContent } from '../utils';

interface CodeBlockData {
  id: string;
  code: string;
  language: string;
  fileName?: string;
  filePath?: string;
  originalCode?: string;
}

interface InteractiveMessageProps {
  content: string;
  isUser?: boolean;
  onApplyChange?: (filePath: string, newContent: string) => Promise<void>;
}

const InteractiveMessage: React.FC<InteractiveMessageProps> = React.memo(({
  content,
  isUser = false,
  onApplyChange
}) => {
  const [codeBlocks, setCodeBlocks] = useState<CodeBlockData[]>([]);
  const [activeEditors, setActiveEditors] = useState<Set<string>>(new Set());

  const parseCodeBlocks = useCallback((markdown: string): CodeBlockData[] => {
    const blocks: CodeBlockData[] = [];
    const codeBlockRegex = /```(\w+)?\s*\n([\s\S]*?)```/g;
    let match;
    let index = 0;

    while ((match = codeBlockRegex.exec(markdown)) !== null) {
      const language = match[1] || 'plaintext';
      const code = match[2].trim();
      const id = `code-block-${index++}`;

      let fileName: string | undefined;
      let filePath: string | undefined;

      const fileMatch = code.match(/^\/\/?\s*File:\s*(.+)$/m) ||
                       code.match(/^#\s*File:\s*(.+)$/m);
      if (fileMatch) {
        fileName = fileMatch[1].trim();
        filePath = fileMatch[1].trim().startsWith('/') ? fileMatch[1].trim() : undefined;
      }

      blocks.push({
        id,
        code,
        language,
        fileName,
        filePath
      });
    }

    return blocks;
  }, []);

  const parsedBlocks = useMemo(() => parseCodeBlocks(content), [content, parseCodeBlocks]);

  const renderContentWithEditableCode = useCallback((text: string): React.ReactNode[] => {
    if (isUser || parsedBlocks.length === 0) {
      return [<span key="content" dangerouslySetInnerHTML={{ __html: formatContent(text) }} />];
    }

    const parts: React.ReactNode[] = [];
    const codeBlockRegex = /```(\w+)?\s*\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let blockIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span
            key={`text-${lastIndex}`}
            dangerouslySetInnerHTML={{ __html: formatContent(text.slice(lastIndex, match.index)) }}
          />
        );
      }

      const block = parsedBlocks[blockIndex];
      if (block) {
        const isEditing = activeEditors.has(block.id);

        parts.push(
          <div key={block.id} className={`interactive-code-block ${isEditing ? 'editing' : ''}`}>
            <InlineCodeEditor
              code={block.code}
              language={block.language}
              fileName={block.fileName}
              filePath={block.filePath}
              readOnly={false}
              onAccept={(editedCode) => {
                console.log('[InteractiveMessage] Accepted code for:', block.fileName || block.id);
              }}
              onReject={() => {
                console.log('[InteractiveMessage] Rejected code for:', block.fileName || block.id);
              }}
              onApplyToFile={async (filePath, editedCode) => {
                try {
                  await api.writeFile(filePath, editedCode);
                  if (onApplyChange) {
                    await onApplyChange(filePath, editedCode);
                  }
                  console.log(`[InteractiveMessage] Applied changes to ${filePath}`);
                } catch (error) {
                  console.error(`[InteractiveMessage] Failed to apply to ${filePath}:`, error);
                  throw error;
                }
              }}
              showDiff={true}
            />
          </div>
        );

        blockIndex++;
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(
        <span
          key={`text-end-${lastIndex}`}
          dangerouslySetInnerHTML={{ __html: formatContent(text.slice(lastIndex)) }}
        />
      );
    }

    return parts;
  }, [isUser, parsedBlocks, activeEditors, onApplyChange]);

  const handleToggleEdit = useCallback((blockId: string) => {
    setActiveEditors(prev => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  }, []);

  if (isUser) {
    return (
      <div className="msg-content user-content" dangerouslySetInnerHTML={{ __html: formatContent(content) }} />
    );
  }

  return (
    <div className="interactive-message">
      {renderContentWithEditableCode(content)}
    </div>
  );
});

InteractiveMessage.displayName = 'InteractiveMessage';

export default InteractiveMessage;
