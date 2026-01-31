import { getThisWindowID } from "../windowId";

type CustomEventData = { type: string; data?: any; timestamp: number; senderId: string };

const EVENT_CHANNEL = "vwin:events";

export class EventManager {
  private bc: BroadcastChannel | null = null;
  private listeners: Map<string, ((event: CustomEventData) => void)[]> = new Map();

  constructor() {
    this.bc = new BroadcastChannel(EVENT_CHANNEL);
    this.bc.onmessage = (ev) => this.handle(ev.data as CustomEventData);
  }

  /**
   * @brief Adds an event listener for a specific event type.
   * @param type The event type to listen for.
   * @param listener The callback function to invoke when the event occurs.
   */
  addEventListener(type: string, listener: (event: CustomEventData) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  /**
   * @brief Removes an event listener for a specific event type.
   * @param type The event type.
   * @param listener The callback function to remove.
   */
  removeEventListener(type: string, listener: (event: CustomEventData) => void) {
    const list = this.listeners.get(type);
    if (list) {
      const index = list.indexOf(listener);
      if (index > -1) {
        list.splice(index, 1);
      }
    }
  }

  /**
   * @brief Dispatches a custom event to all listeners and broadcasts it.
   * @param type The event type.
   * @param data Optional data associated with the event.
   */
  dispatchEvent(type: string, data?: any) {
    const event: CustomEventData = {
      type,
      data,
      timestamp: Date.now(),
      senderId: getThisWindowID()
    };
    this.bc?.postMessage(event);
    this.handle(event); // Auch lokal auslösen
  }

  private handle(event: CustomEventData) {
    const list = this.listeners.get(event.type);
    if (list) {
      list.forEach(listener => listener(event));
    }
  }

  destroy() {
    this.bc?.close();
    this.listeners.clear();
  }
}