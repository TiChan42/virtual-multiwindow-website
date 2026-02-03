import { NetworkAdapter } from "./NetworkAdapter";
import { Store } from "./Store";
import { 
  VirtualState, 
  VirtualEvent, 
  WindowSnapshot, 
  VflLayout,
  Rect 
} from "../types/types";
import { normalizeLayout } from "../utils/vfl";
import { generateSessionId } from "./sessionUtils";
import { 
    getStaticLayoutFromUrl, 
    calculateAssignedScreen, 
    calculateRelativePosition, 
    calculateGlobalPosition 
} from "./positioning"; 

const HEARTBEAT_INTERVAL = 1000;
const LEADER_TIMEOUT = Math.max(HEARTBEAT_INTERVAL * 2, 3000);
const CLEANUP_INTERVAL = 5000;
const WINDOW_TIMEOUT = 5000;

export class VirtualEngine {
  public store: Store<VirtualState>;
  private network!: NetworkAdapter; 
  private heartbeatTimer: number | null = null; 
  private cleanupTimer: number | null = null;
  private lastLeaderHeartbeat: number = Date.now();
  private leaderId: string | null = null;
  private createdAt: number = Date.now();
  
  // Initialization & Age Logic
  private ageLocked = false;
  private ticksSinceStart = 0;

  // Static Layout (if provided by URL)
  private staticLayout: VflLayout | null = null;
  private sessionId: string = "default";

  constructor(windowId: string, initialRect: Rect) {
    this.staticLayout = getStaticLayoutFromUrl();
    
    // Calculate Session ID purely from static layout if exists
    // This part is tricky because constructor is sync.
    // For now we use the Layout String hash or default.
    const layoutStr = typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get("layout") || "" : "";
    
    // We initialize Store first
     const initialState: VirtualState = {
      windowId,
      winRect: initialRect,
      windows: {},
      layout: this.staticLayout || null, // Start with static layout if available
      assignedScreenId: undefined,
      viewportOffset: { x: 0, y: 0 },
      isLeader: false,
      permissionGranted: false,
      sharedData: {}
    };
    this.store = new Store(initialState);

    // Initialize Network (Async ID generation handled by wrapping/promising?)
    // To keep it simple, we generate ID synchronously or use a non-async hash for now in sessionUtils
    // But hashing text should be fast. 
    this.initializeNetwork(windowId, layoutStr);
  }

  private async initializeNetwork(windowId: string, layoutStr: string) {
      this.sessionId = await generateSessionId(layoutStr);
      console.log(`[VirtualEngine] Session ID: ${this.sessionId}`);
      
      this.network = new NetworkAdapter(windowId, this.sessionId);
      this.network.onMessage(this.handleMessage.bind(this));

      // Start Loops after network is ready
      this.heartbeatTimer = setInterval(this.tick.bind(this), HEARTBEAT_INTERVAL) as unknown as number;
      this.cleanupTimer = setInterval(this.cleanupFn.bind(this), CLEANUP_INTERVAL) as unknown as number;
      
      // Initial calculations using the static layout if present
      if (this.staticLayout) {
          this.recalculateLocalView();
      }

      this.publishSelf();
      console.log(`[VirtualEngine] Started ${windowId} in session ${this.sessionId}`);
  }

  public updateRect(rect: Rect) {
    this.store.set(prev => ({ ...prev, winRect: rect }));
    
    // Immediate Recalculation of OWN position based on rules
    this.recalculateLocalView();
    
    this.publishSelf(); 

    if (this.store.get().isLeader && !this.staticLayout) {
      this.recalculateWorld();
    }
  }

  public setSharedData(key: string, value: unknown) {
    // Optimistic update
    this.store.update(s => {
      s.sharedData[key] = value;
    });
    // Broadcast
    this.network.broadcast({
      type: 'SHARED_DATA_UPDATE',
      payload: { key, value }
    });
  }

  public dispose() {
    if (this.heartbeatTimer !== null) clearInterval(this.heartbeatTimer);
    if (this.cleanupTimer !== null) clearInterval(this.cleanupTimer);
    if(this.network) {
        this.network.close();
        this.network.broadcast({ 
        type: 'GOODBYE', 
        payload: { id: this.store.get().windowId } 
        });
    }
  }

  private tick() {
    if (!this.network) return; // Wait for async init

    // 1. Publish Self immediately so others know about us (and our Age)
    this.publishSelf();

    const state = this.store.get();
    const now = Date.now();
    const allWindows = Object.values(state.windows);
    
    // 2. Age Check Phase (only once at the beginning)
    if (!this.ageLocked) {
        // "falls bereits ein gleichalter oder jüngerer Browser existiert wird dessen alter + eine Zufällige Zahl verwendet"
        // Meaning: If there is any window W where W.createdAt >= My.createdAt
        // Then I am actually "younger" (arrived later), so I must increase my createdAt number to be > W.createdAt
        
        let maxCreatedAt = this.createdAt;
        let conflictFound = false;

        for (const w of allWindows) {
            // Check for conflict or younger window
            if (w.createdAt >= this.createdAt) {
                if (w.createdAt > maxCreatedAt) {
                     maxCreatedAt = w.createdAt;
                }
                conflictFound = true;
            }
        }

        if (conflictFound) {
            // Adjust my age to be strictly younger (larger number) than the "youngest" found
            const buffer = Math.floor(Math.random() * 100) + 10;
            this.createdAt = maxCreatedAt + buffer;
            console.log(`[VirtualEngine] Age conflict/adjustment: New createdAt = ${this.createdAt}`);
            
            // Publish updated age immediately
            this.publishSelf();
        }

        // If list was empty, we are "Temporary Leader" for heartbeats
        if (allWindows.length === 0) {
             // We are effectively alone, so we proceed directly
             // But we still wait the mandatory ticks for stability
             console.log(`[VirtualEngine] No other windows found. Assuming interim duties.`);
        }
        
        this.ageLocked = true;
    }

    // 3. Increment Tick Counter
    this.ticksSinceStart++;

    // 4. Wait Phase (2 Heartbeats)
    // "Anschließend wird noch 2 Heartbeats gewartet"
    if (this.ticksSinceStart < 3) {
        // Just waiting, broadcasting presence
        return;
    }

    // 5. Leader Decision
    // "nun wird geprüft, ob er der älteste ist"
    
    // Candidates = Active Windows + Me
    const me: WindowSnapshot = {
        id: state.windowId,
        createdAt: this.createdAt,
        lastSeen: now,
        rect: state.winRect,
        timestamp: now
    };
    
    const candidates = [...allWindows, me].filter(w => (now - w.lastSeen) < WINDOW_TIMEOUT);
    
    // Sort by Age ASC (Smallest number = Oldest = Leader)
    candidates.sort((a, b) => a.createdAt - b.createdAt);

    if (candidates.length === 0) return; // Should not happen as 'me' is there

    const oldest = candidates[0];
    const isNowLeader = (oldest.id === state.windowId);

    if (isNowLeader) {
        if (!state.isLeader) {
            console.log(`[VirtualEngine] I am the Oldest (${this.createdAt}). Taking Leadership.`);
            this.store.set({ isLeader: true });
        }
        this.leaderId = state.windowId;
        this.recalculateWorld();
    } else {
        // If I was leader but am no longer oldest (e.g. huge clock skew or someone woke up)
        if (state.isLeader) {
            console.log(`[VirtualEngine] Stepping down. Leader is ${oldest.id} (${oldest.createdAt})`);
            this.store.set({ isLeader: false });
        }
        this.leaderId = oldest.id;
    }
  }

  // Removed old becomeLeader since logic is now in tick()
  // private becomeLeader() ... 

  private handleMessage(event: VirtualEvent) {
    const state = this.store.get();
    const now = Date.now();

    switch (event.type) {
      case 'HELLO':
      case 'HEARTBEAT': {
        const win = event.payload;
        if (win.id === state.windowId) return; // Ignore self-echo

        this.store.update(s => {
          s.windows[win.id] = { ...win, lastSeen: now };
        });
        
        // Passive leader logic handles the rest in tick()
        break;
      }
      case 'GOODBYE': {
        const { id } = event.payload;
        this.store.update(s => {
          delete s.windows[id];
        });
        // If leader left, tick() will naturally pick the next oldest in next cycle
        break;
      }
      case 'LAYOUT_UPDATE': {
        if (!state.isLeader) {
          // Accept layout from leader
          this.store.set({ layout: event.payload });
          this.recalculateLocalView();
        }
        break;
      }
      // LEADER_CLAIM is no longer authoritative but can be ignored or treated as hint
      case 'LEADER_CLAIM': {
         // with new logic we ignore claims, we trust data (age)
         break;
      }
      case 'SHARED_DATA_UPDATE': {
        const { key, value } = event.payload;
        this.store.update(s => {
          s.sharedData[key] = value;
        });
        break;
      }
    }
  }

  private publishSelf() {
    if (!this.network) return;

    const state = this.store.get();
    const snapshot: WindowSnapshot = {
      id: state.windowId,
      createdAt: this.createdAt,
      rect: state.winRect,
      lastSeen: Date.now(),
      assignedScreenId: state.assignedScreenId,
      virtualRect: state.virtualRect,
      timestamp: Date.now()
    };
    
    // Self-update
    if (state.windows[state.windowId]?.timestamp !== snapshot.timestamp) {
        this.store.update(s => {
            s.windows[state.windowId] = snapshot;
        });
    }

    this.network.broadcast({ type: 'HEARTBEAT', payload: snapshot });
  }

  private cleanupFn() {
    const state = this.store.get();
    const now = Date.now();
    let changed = false;
    const nextWindows = { ...state.windows };

    Object.keys(nextWindows).forEach(key => {
      // Remove windows we haven't seen in a while (except ourselves)
      if (key !== state.windowId && (now - nextWindows[key].lastSeen > WINDOW_TIMEOUT)) {
        // console.log(`[VirtualEngine] Pruning lost window ${key}`);
        delete nextWindows[key];
        changed = true;
      }
    });

    if (changed) {
      this.store.set({ windows: nextWindows });
      if (state.isLeader && !this.staticLayout) {
          this.recalculateWorld();
      }
    }
  }

  private recalculateWorld() {
    // If we have a Static Layout (from URL), that is the source of truth.
    // The leader simply ensures everyone knows about it.
    if (this.staticLayout) {
        // Enforce static layout
        this.network?.broadcast({ type: 'LAYOUT_UPDATE', payload: this.staticLayout });
        // Ensure local store matches
        if (this.store.get().layout !== this.staticLayout) {
            this.store.set({ layout: this.staticLayout });
        }
        return;
    }

    // Dynamic Mode (Mesh) Logic
    const state = this.store.get();
    const allWindows = Object.values(state.windows);
    
    // Filter windows that map to screens or valid rects
    const screens = allWindows
        .filter(w => w.rect && w.rect.w > 0)
        .map(w => ({
            id: w.id, 
            x: w.rect.x,
            y: w.rect.y,
            w: w.rect.w,
            h: w.rect.h
        }));

    if (screens.length === 0) return;

    const layout = normalizeLayout({ v: 1, screens });
    this.store.set({ layout });
    this.network?.broadcast({ type: 'LAYOUT_UPDATE', payload: layout });

    // We also need to recalc our own local view if the dynamic layout changed
    this.recalculateLocalView();
  }

  /**
   * Run by everyone.
   * Calculates "Where am I regarding the active Layout?"
   * Steps:
   * 1. Check URL for explicit Screen ID override -> if match, use it.
   * 2. Check overlap/geometry to find Screen.
   * 3. Calculate Relative Position (URL override > geometry).
   * 4. Calculate Global Position.
   */
  private recalculateLocalView() {
    const state = this.store.get();
    // Layout priority: Static (URL) > Leader Provided > Null
    const activeLayout = this.staticLayout || state.layout;

    if (!activeLayout || activeLayout.screens.length === 0) return;

    // 1 & 2. Assign Screen
    const assignedScreen = calculateAssignedScreen(
        state.windowId, 
        state.winRect, 
        activeLayout.screens
    );

    // 3. Relative Position
    const relativePos = calculateRelativePosition(
        state.winRect, 
        assignedScreen
    );

    // 4. Global Position (Virtual Rect)
    // Note: virtualRect includes the correct X/Y in the global coordinate space
    const globalVirtualRect = calculateGlobalPosition(
        assignedScreen, 
        relativePos, 
        state.winRect.w, 
        state.winRect.h
    );

    // Update Store
    // ViewportOffset = How much to shift the "World" so that `globalVirtualRect` 
    // aligns with the browser window (0,0) concept.
    // Actually, VirtualViewportProvider uses `viewportOffset` to translate 
    // the global frame.
    // transform: translate(-offset.x, -offset.y)
    // If GlobalRect.x = 100, and Frame.x = 0
    // We want the pixel at Global 100 to be at Window 0.
    // So shift = 100.
    // viewportOffset = globalVirtualRect.x - frame.x
    
    const frameX = activeLayout.frame.x;
    const frameY = activeLayout.frame.y;
    
    // Recalculating everything ensures consistency
    this.store.set({
        assignedScreenId: assignedScreen.id,
        viewportOffset: { 
            x: globalVirtualRect.x - frameX, 
            y: globalVirtualRect.y - frameY 
        },
        virtualRect: globalVirtualRect
    });
  }
}
