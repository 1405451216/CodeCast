import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAppStore } from '../../store';
import { SlashCommands } from '../../wails/adapter';
export interface SlashCommand { id: string; label: string; description: string; aliases?: string[] }

/** Built-in defaults shown until backend data loads */
const FALLBACK_COMMANDS: SlashCommand[] = [];

export function SlashCommandMenu({ query, onSelect }: { query: string; onSelect: (cmd: SlashCommand) => void }) {
  const settingsCmds = useAppStore((s) => s.settings?.slash_commands);
  const [loaded, setLoaded] = useState<SlashCommand[] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load commands from adapter on mount; fall back to settings slice
  useEffect(() => {
    let cancelled = false;
    SlashCommands.list().then((res: unknown) => {
      if (cancelled) return;
      const arr = Array.isArray(res) ? res : [];
      setLoaded(arr.map((c: Record<string, string>) => ({
        id: c.id ?? c.name,
        label: c.name ? `/${c.name}` : c.id,
        description: c.description ?? '',
        aliases: c.name ? [`/${c.name}`] : [],
      })));
    }).catch(() => {
      if (cancelled) return;
      if (settingsCmds && settingsCmds.length > 0) {
        setLoaded(settingsCmds.map((c) => ({
          id: c.id,
          label: `/${c.name}`,
          description: c.description ?? '',
          aliases: [`/${c.name}`],
        })));
      } else {
        setLoaded(FALLBACK_COMMANDS);
      }
    });
    return () => { cancelled = true; };
  }, [settingsCmds]);

  const commands = loaded ?? FALLBACK_COMMANDS;
  const [activeIdx, setActiveIdx] = useState(0);
  const q = query.toLowerCase().replace(/^\//, '');
  const filtered = useMemo(
    () => commands.filter(c => c.label.toLowerCase().includes(q) || c.aliases?.some(a => a.toLowerCase().includes(q))),
    [commands, q],
  );
  useEffect(() => { setActiveIdx(0); }, [q]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[activeIdx]) onSelect(filtered[activeIdx]);
    }
  }, [filtered, activeIdx, onSelect]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!filtered.length) return null;
  return (
    <div
      ref={listRef}
      role="listbox"
      onKeyDown={handleKeyDown}
      style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', maxHeight: 200, overflow: 'auto' }}
    >
      {filtered.map((c, i) => (
        <div
          key={c.id}
          data-idx={i}
          role="option"
          aria-selected={i === activeIdx}
          onClick={() => onSelect(c)}
          onMouseEnter={() => setActiveIdx(i)}
          style={{ padding: '6px 12px', fontSize: 13, cursor: 'pointer', background: i === activeIdx ? 'var(--c-bgSub)' : 'transparent', display: 'flex', justifyContent: 'space-between' }}
        >
          <span>{c.label}</span>
          <span style={{ color: 'var(--c-textMute)', fontSize: 11 }}>{c.description}</span>
        </div>
      ))}
    </div>
  );
}
export { FALLBACK_COMMANDS as COMMANDS };
