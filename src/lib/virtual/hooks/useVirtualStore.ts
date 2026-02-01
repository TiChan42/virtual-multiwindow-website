import { useSyncExternalStore } from 'react';
import type { VirtualEngine } from '../core/VirtualEngine';
import type { VirtualState } from '../types';

export function useVirtualStore<SelectorOutput>(
  engine: VirtualEngine | null,
  selector: (state: VirtualState) => SelectorOutput
): SelectorOutput | null {
  return useSyncExternalStore(
    (callback) => engine?.store.subscribe(() => callback()) || (() => {}),
    () => engine ? selector(engine.store.get()) : null as any,
    () => null // Server snapshot
  );
}

export function useVirtualState(engine: VirtualEngine | null) {
  return useSyncExternalStore(
    (cb) => engine?.store.subscribe(cb) || (() => {}),
    () => engine?.store.get() || null,
    () => null // Server snapshot
  );
}
