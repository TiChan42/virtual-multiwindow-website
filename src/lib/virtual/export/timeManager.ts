import { getThisWindowID } from "../windowId";

type TimeEvent =
  | { t: "timer_start"; id: string; duration: number; timestamp: number }
  | { t: "timer_end"; id: string; timestamp: number }
  | { t: "timestamp_update"; key: string; value: number };

const TIME_CHANNEL = "vwin:time";

export class TimeManager {
  private bc: BroadcastChannel | null = null;
  private timers: Map<string, { start: number; duration: number; timeoutId?: number }> = new Map();
  private timestamps: Map<string, number> = new Map();
  private onTimeEvent: ((event: TimeEvent) => void) | null = null;

  constructor(onTimeEvent?: (event: TimeEvent) => void) {
    this.onTimeEvent = onTimeEvent || null;
    this.bc = new BroadcastChannel(TIME_CHANNEL);
    this.bc.onmessage = (ev) => this.handle(ev.data as TimeEvent);
  }

  /**
   * @brief Starts a shared timer.
   * @param id The unique identifier for the timer.
   * @param duration The duration in milliseconds.
   */
  startTimer(id: string, duration: number) {
    const start = Date.now();
    this.timers.set(id, { start, duration });
    const timeoutId = setTimeout(() => {
      this.endTimer(id);
    }, duration);
    this.timers.get(id)!.timeoutId = timeoutId as any;
    this.bc?.postMessage({ t: "timer_start", id, duration, timestamp: start });
    this.onTimeEvent?.({ t: "timer_start", id, duration, timestamp: start });
  }

  /**
   * @brief Ends a timer.
   * @param id The unique identifier for the timer.
   */
  endTimer(id: string) {
    const timer = this.timers.get(id);
    if (timer) {
      if (timer.timeoutId) clearTimeout(timer.timeoutId);
      this.timers.delete(id);
      const timestamp = Date.now();
      this.bc?.postMessage({ t: "timer_end", id, timestamp });
      this.onTimeEvent?.({ t: "timer_end", id, timestamp });
    }
  }

  /**
   * @brief Sets a timestamp.
   * @param key The key for the timestamp.
   * @param value The timestamp value (defaults to current time if not provided).
   */
  setTimestamp(key: string, value?: number) {
    const timestamp = value || Date.now();
    this.timestamps.set(key, timestamp);
    this.bc?.postMessage({ t: "timestamp_update", key, value: timestamp });
    this.onTimeEvent?.({ t: "timestamp_update", key, value: timestamp });
  }

  /**
   * @brief Gets a timestamp.
   * @param key The key of the timestamp.
   * @return The timestamp value or undefined if not found.
   */
  getTimestamp(key: string): number | undefined {
    return this.timestamps.get(key);
  }

  /**
   * @brief Gets all timestamps.
   * @return An object containing all key-timestamp pairs.
   */
  getAllTimestamps(): Record<string, number> {
    return Object.fromEntries(this.timestamps);
  }

  private handle(event: TimeEvent) {
    if (event.t === "timer_start") {
      this.timers.set(event.id, { start: event.timestamp, duration: event.duration });
    } else if (event.t === "timer_end") {
      this.timers.delete(event.id);
    } else if (event.t === "timestamp_update") {
      this.timestamps.set(event.key, event.value);
    }
    this.onTimeEvent?.(event);
  }

  destroy() {
    this.bc?.close();
    this.timers.forEach(timer => {
      if (timer.timeoutId) clearTimeout(timer.timeoutId);
    });
    this.timers.clear();
  }
}