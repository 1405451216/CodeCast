import { useState } from 'react';
import { AutocompleteItem } from '../components/InputArea/TabAutocomplete';

interface UseAutocompleteReturn {
  visible: boolean;
  items: AutocompleteItem[];
  selectedIndex: number;
  setVisible: (v: boolean) => void;
  setItems: (items: AutocompleteItem[]) => void;
  setSelectedIndex: (i: number | ((prev: number) => number)) => void;
  close: () => void;
}

export function useAutocomplete(): UseAutocompleteReturn {
  const [visible, setVisible] = useState(false);
  const [items, setItems] = useState<AutocompleteItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const close = () => {
    setVisible(false);
    setItems([]);
    setSelectedIndex(0);
  };

  return { visible, items, selectedIndex, setVisible, setItems, setSelectedIndex, close };
}
