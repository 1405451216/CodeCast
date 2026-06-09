import { useState, useEffect } from 'react';
import { useAppStore } from '../../store';
import { Files } from '../../wails/adapter';
import { FilePreviewModal } from './FilePreviewModal';

function isLikelyDir(name: string): boolean {
  if (!name.includes('.')) return true;
  if (name.startsWith('.')) return true;
  if (/\.\w{1,5}$/.test(name)) return false;
  return true;
}

interface TreeNodeProps {
  name: string;
  path: string;
  depth: number;
  expanded: Set<string>;
  children: Record<string, string[]>;
  onToggle: (path: string) => void;
  onPreview: (path: string) => void;
}

function TreeNode({ name, path, depth, expanded, children, onToggle, onPreview }: TreeNodeProps) {
  const isDir = isLikelyDir(name);
  const isExpanded = expanded.has(path);
  const subItems = children[path] || [];

  return (
    <div>
      <div
        onClick={() => isDir ? onToggle(path) : onPreview(path)}
        style={{
          padding: '2px 4px',
          paddingLeft: 4 + depth * 16,
          cursor: 'pointer',
          borderRadius: 'var(--r-sm)',
          color: depth === 0 ? 'var(--c-text)' : 'var(--c-textSub)',
          fontSize: 12,
          lineHeight: '20px',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-surface-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        {isDir ? (isExpanded ? '📂' : '📁') : '📄'} {name}
      </div>
      {isDir && isExpanded && subItems.length > 0 && (
        subItems.map((sub) => (
          <TreeNode
            key={sub}
            name={sub}
            path={path + '/' + sub}
            depth={depth + 1}
            expanded={expanded}
            children={children}
            onToggle={onToggle}
            onPreview={onPreview}
          />
        ))
      )}
    </div>
  );
}

export function FileTree() {
  const currentProject = useAppStore((s) => s.currentProject);
  const [tree, setTree] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [children, setChildren] = useState<Record<string, string[]>>({});
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  const rootPath = currentProject?.path;

  useEffect(() => {
    if (!rootPath) { setTree([]); return; }
    Files.list(rootPath).then(setTree).catch(() => setTree([]));
  }, [rootPath]);

  const toggleDir = async (path: string) => {
    const next = new Set(expanded);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
      if (!children[path]) {
        try {
          const items = await Files.list(path);
          setChildren((c) => ({ ...c, [path]: items }));
        } catch { /* ignore */ }
      }
    }
    setExpanded(next);
  };

  if (!rootPath) {
    return <div style={{ padding: 8, fontSize: 12, color: 'var(--c-textMute)' }}>No project selected</div>;
  }

  return (
    <div style={{ padding: 8, fontSize: 12 }}>
      <div style={{ marginBottom: 4, fontWeight: 500, color: 'var(--c-text)' }}>Project Files</div>
      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-textSub)', marginBottom: 6, fontSize: 11, wordBreak: 'break-all' }}>
        {rootPath}
      </div>
      {tree.length === 0 ? (
        <div style={{ color: 'var(--c-textMute)' }}>Empty directory</div>
      ) : (
        <div>
          {tree.map((item) => (
            <TreeNode
              key={item}
              name={item}
              path={rootPath + '/' + item}
              depth={0}
              expanded={expanded}
              children={children}
              onToggle={toggleDir}
              onPreview={setPreviewPath}
            />
          ))}
        </div>
      )}
      {previewPath && (
        <FilePreviewModal path={previewPath} onClose={() => setPreviewPath(null)} />
      )}
    </div>
  );
}
