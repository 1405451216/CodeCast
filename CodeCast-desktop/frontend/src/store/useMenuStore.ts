import { ActiveMenu } from './types';
import type { SliceSet } from './storeTypes';

interface MenuSlice {
  activeMenu: ActiveMenu;
  setActiveMenu: (menu: ActiveMenu) => void;
  closeMenus: () => void;
}

const createMenuSlice = (set: SliceSet): MenuSlice => ({
  activeMenu: null,
  setActiveMenu: (menu) => set({ activeMenu: menu }),
  closeMenus: () => set({ activeMenu: null }),
});

export { type MenuSlice, createMenuSlice };
