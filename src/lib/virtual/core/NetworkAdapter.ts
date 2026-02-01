import { VirtualEvent } from "../types/types";

type MessageHandler = (event: VirtualEvent) => void;

const DEFAULT_CHANNEL = "vwin:network";

export class NetworkAdapter {
  private bc: BroadcastChannel;
  private listeners: Set<MessageHandler> = new Set();
  private windowId: string;

  constructor(windowId: string, channelName: string = DEFAULT_CHANNEL) {
    this.windowId = windowId;
    this.bc = new BroadcastChannel(channelName);
    this.bc.onmessage = this.handleMessage.bind(this);
    console.log(`[NetworkAdapter] Connected to channel: ${channelName}`);
    
    // Optional: Add storage event listener here for cross-browser support if needed
    // currently sticking to BroadcastChannel for simplicity/performance in same-origin
  }

  public broadcast(event: VirtualEvent) {
    this.bc.postMessage(event);
  }

  public onMessage(handler: MessageHandler) {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  private handleMessage(ev: MessageEvent) {
    const data = ev.data as VirtualEvent;
    if (!data || !data.type) return;

    this.listeners.forEach(l => {
      try {
        l(data);
      } catch (err) {
        console.error('[NetworkAdapter] Listener error:', err);
      }
    });
  }

  public close() {
    this.bc.close();
    this.listeners.clear();
  }
}
