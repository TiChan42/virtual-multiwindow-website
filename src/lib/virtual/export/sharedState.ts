import { getThisWindowID } from "../windowId";

type SharedStateEvent =
  | { t: "state_update"; key: string; value: any; timestamp: number }
  | { t: "state_delete"; key: string; timestamp: number };

const STATE_CHANNEL = "vwin:state";
const STATE_STORAGE_KEY = "vwin:sharedState";

export class SharedState {
  private bc: BroadcastChannel | null = null;
  private state: Map<string, any> = new Map();
  private onStateChange: ((key: string, value: any) => void) | null = null;
  private storageListener: ((ev: StorageEvent) => void) | null = null;

  constructor(onStateChange?: (key: string, value: any) => void) {
    this.onStateChange = onStateChange || null;
    this.bc = new BroadcastChannel(STATE_CHANNEL);
    this.bc.onmessage = (ev) => this.handle(ev.data as SharedStateEvent);

    // Load from localStorage
    this.loadFromStorage();

    // Listen for storage changes
    this.storageListener = (ev) => {
      if (ev.key === STATE_STORAGE_KEY && ev.newValue) {
        try {
          const stored = JSON.parse(ev.newValue);
          this.state = new Map(Object.entries(stored));
          // Notify about changes
          this.onStateChange && this.state.forEach((value, key) => this.onStateChange!(key, value));
        } catch (e) {
          console.warn("Failed to parse stored state:", e);
        }
      }
    };
    window.addEventListener("storage", this.storageListener);
  }

  /**
   * @brief Sets a value in the shared state.
   * @param key The key for the value.
   * @param value The value to set.
   */
  set(key: string, value: any) {
    this.state.set(key, value);
    this.saveToStorage();
    const timestamp = Date.now();
    this.bc?.postMessage({ t: "state_update", key, value, timestamp });
    this.onStateChange?.(key, value);
  }

  /**
   * @brief Gets a value from the shared state.
   * @param key The key of the value.
   * @return The value associated with the key.
   */
  get(key: string): any {
    return this.state.get(key);
  }

  /**
   * @brief Gets all values from the shared state.
   * @return An object containing all key-value pairs.
   */
  getAll(): Record<string, any> {
    return Object.fromEntries(this.state);
  }

  /**
   * @brief Deletes a value from the shared state.
   * @param key The key of the value to delete.
   */
  delete(key: string) {
    this.state.delete(key);
    this.saveToStorage();
    const timestamp = Date.now();
    this.bc?.postMessage({ t: "state_delete", key, timestamp });
    this.onStateChange?.(key, undefined);
  }

  private handle(event: SharedStateEvent) {
    if (event.t === "state_update") {
      this.state.set(event.key, event.value);
      this.onStateChange?.(event.key, event.value);
    } else if (event.t === "state_delete") {
      this.state.delete(event.key);
      this.onStateChange?.(event.key, undefined);
    }
  }

  private saveToStorage() {
    try {
      const obj = Object.fromEntries(this.state);
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn("Failed to save state to storage:", e);
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STATE_STORAGE_KEY);
      if (stored) {
        const obj = JSON.parse(stored);
        this.state = new Map(Object.entries(obj));
      }
    } catch (e) {
      console.warn("Failed to load state from storage:", e);
    }
  }

  destroy() {
    this.bc?.close();
    window.removeEventListener("storage", this.storageListener!);
  }
}