import type { Store } from "./EngineStore";
import type { NetworkAdapter } from "./EngineNetworkAdapter";
import type { VirtualEvent, VirtualState, WindowSnapshot } from "../types/types";
import type { EngineLayout } from "./EngineLayout";

// ==========================================
// Network System
// ==========================================

export class EngineNetwork {
  constructor(
    private store: Store<VirtualState>,
    private layoutSystem: EngineLayout,
    private getNetwork: () => NetworkAdapter | undefined,
    private getIdentity: () => { windowId: string; createdAt: number }
  ) {}

  /**
   * @brief Handles incoming network messages from peers.
   * @param event The received virtual event.
   */
  handleMessage(event: VirtualEvent) {
    const state = this.store.get();
    const now = Date.now();
    const { windowId } = this.getIdentity();

    switch (event.type) {
      case "HELLO":
      case "HEARTBEAT": {
        const win = event.payload;
        if (win.id === windowId) return; // Ignore echoes

        this.store.update((s) => {
          s.windows[win.id] = { ...win, lastSeen: now };
        });
        
        // If Leader, refresh world layout
        // Note: We check current state again or use the reference 'state' we just got?
        // 'state' was fetched at start of handleMessage, might be stale if store updated sync?
        // Store.update is sync notify? Store implementations usually are.
        // It's safer to check store.get().isLeader
        if (this.store.get().isLeader) {
           this.layoutSystem.recalculateWorld();
        }
        break;
      }
      case "GOODBYE": {
        const { id } = event.payload;
        this.store.update((s) => {
          delete s.windows[id];
        });
        // If Leader, refresh world layout (removed window)
        if (this.store.get().isLeader) {
           this.layoutSystem.recalculateWorld();
        }
        break;
      }
      case "LAYOUT_UPDATE": {
        if (!state.isLeader) {
          this.store.set({ layout: event.payload });
          this.layoutSystem.recalculateLocalView();
        }
        break;
      }
      case "SHARED_DATA_UPDATE": {
        const { key, value } = event.payload;
        this.store.update((s) => {
          s.sharedData[key] = value;
        });
        break;
      }
      case "LEADER_CLAIM": {
        // If I thought I was leader, I stand down
        this.store.set({ isLeader: false });
        break;
      }
    }
  }

  /**
   * @brief Broadcasts the current window's state (heartbeat) to the network.
   */
  publishSelf() {
    const network = this.getNetwork();
    if (!network) return;

    const state = this.store.get();
    const { createdAt, windowId } = this.getIdentity();

    const snapshot: WindowSnapshot = {
      id: windowId,
      createdAt: createdAt,
      rect: state.winRect,
      lastSeen: Date.now(),
      assignedScreenId: state.assignedScreenId,
      virtualRect: state.virtualRect,
      timestamp: Date.now(),
    };

    // Update self in local registry too
    if (state.windows[windowId]?.timestamp !== snapshot.timestamp) {
      this.store.update((s) => {
        s.windows[windowId] = snapshot;
      });
    }

    network.broadcast({ type: "HEARTBEAT", payload: snapshot });
  }
}
