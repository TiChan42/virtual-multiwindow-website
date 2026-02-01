import { WindowSnapshot, VflLayout } from "../types";

type Listener<T> = (state: T) => void;

export class Store<T> {
  private state: T;
  private listeners: Set<Listener<T>> = new Set();

  constructor(initialState: T) {
    this.state = initialState;
  }

  get(): T {
    return this.state;
  }

  set(newState: Partial<T> | ((prev: T) => Partial<T>)) {
    const changes = typeof newState === 'function' 
      ? (newState as Function)(this.state) 
      : newState;

    this.state = { ...this.state, ...changes };
    this.emit();
  }

  // Atomically update a nested property to avoid deep cloning everything manually
  // This is a simple helper, in a real app we might use immer
  update(updater: (draft: T) => void) {
    // For now, shallow copy is enough if we are careful, 
    // but specific nested updates should be handled carefully.
    // Let's stick to .set() with spreads for safety in this simple implementation.
    const nextState = { ...this.state };
    updater(nextState);
    this.state = nextState;
    this.emit();
  }

  subscribe(listener: Listener<T>) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.listeners.forEach(l => l(this.state));
  }
}
