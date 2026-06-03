import { useState, useRef } from 'react';

interface UseContextSelectorReturn {
  visible: boolean;
  filter: string;
  setVisible: (v: boolean) => void;
  setFilter: (f: string) => void;
  menuRef: React.RefObject<HTMLDivElement>;
}

export function useContextSelector(): UseContextSelectorReturn {
  const [visible, setVisible] = useState(false);
  const [filter, setFilter] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  return { visible, filter, setVisible, setFilter, menuRef };
}
