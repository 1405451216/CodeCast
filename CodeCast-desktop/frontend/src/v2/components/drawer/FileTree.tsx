import { useState, useEffect } from 'react';
import { useAppStore } from '../../store';
import { Files } from '../../wails/adapter';

export function FileTree() {
  const currentProject = useAppStore((s) => s.currentProject);
  const [tree, setTree] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [children, setChildren] = useState<Record<string, string[]>>({});

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
          {tree.map((item) => {
            const fullPath = rootPath + '/' + item;
            const isDir = !item.includes('.');
            const isExpanded = expanded.has(fullPath);
            const subItems = children[fullPath] || [];
            return (
              <div key={item}>
                <div
                  onClick={() => isDir && toggleDir(fullPath)}
                  style={{
                    padding: '2px 4px', cursor: isDir ? 'pointer' : 'default',
                    borderRadius: 'var(--r-sm)', color: 'var(--c-text)',
                  }}
                  onMouseEnter={(e) => { if (isDir) e.currentTarget.style.background = 'var(--c-surface-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {isDir ? (isExpanded ? '📂' : '📁') : '📄'} {item}
                </div>
                {isExpanded && subItems.length > 0 && (
                  <div style={{ paddingLeft: 16 }}>
                    {subItems.map((sub) => (
                      <div key={sub} style={{ padding: '2px 4px', color: 'var(--c-textSub)' }}>
                        {sub.includes('.') ? '📄' : '📁'} {sub}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
