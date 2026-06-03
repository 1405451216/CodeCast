import { useSyncExternalStore } from 'react';

/**
 * Hook that subscribes to window resize events using useSyncExternalStore.
 * Returns the current window width and height.
 */
function subscribe(callback: () => void) {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
}

function getSnapshot() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function getServerSnapshot() {
  return { width: 1024, height: 768 };
}

export function useWindowSize() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useWindowWidth() {
  return useSyncExternalStore(
    subscribe,
    () => window.innerWidth,
    () => 1024
  );
}
