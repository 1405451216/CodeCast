import { useState, useEffect, useRef } from 'react';

interface UseSlashMenuReturn {
  visible: boolean;
  filter: string;
  selectedIndex: number;
  setVisible: (v: boolean) => void;
  setFilter: (f: string) => void;
  setSelectedIndex: (i: number | ((prev: number) => number)) => void;
  menuRef: React.RefObject<HTMLDivElement>;
}

export function useSlashMenu(): UseSlashMenuReturn {
  const [visible, setVisible] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  return { visible, filter, selectedIndex, setVisible, setFilter, setSelectedIndex, menuRef };
}
