import { useState } from 'react';
import { DrawerTabs, type TabId } from '../components/drawer/DrawerTabs';
import { FileTree } from '../components/drawer/FileTree';
import { GitPanel } from '../components/drawer/GitPanel';
import { MCPPanel } from '../components/drawer/MCPPanel';
import { MemoryPanel } from '../components/drawer/MemoryPanel';

const panels: Record<TabId, () => JSX.Element> = {
  files: FileTree,
  git: GitPanel,
  mcp: MCPPanel,
  memory: MemoryPanel,
};

export function Drawer() {
  const [active, setActive] = useState<TabId>('files');
  const Panel = panels[active];
  return <div style={{ fontSize: 13 }}>
    <DrawerTabs active={active} onChange={setActive} />
    <Panel />
  </div>;
}
