export type Rect = { x: number; y: number; w: number; h: number };

export type VflScreen = Rect & {
  id: string;
  scale?: number;
};

export type VflLayout = {
  v: 1;
  frame: Rect;
  screens: VflScreen[];
};

export type WindowSnapshot = {
  id: string;
  lastSeen: number;
  rect: Rect;
  assignedScreenId?: string;
  virtualRect?: Rect; // Global virtual coordinates
  viewportOffset?: { x: number; y: number }; 
  timestamp: number;
};

export type VirtualState = {
  windowId: string;
  winRect: Rect;
  windows: Record<string, WindowSnapshot>;
  layout: VflLayout | null;
  assignedScreenId?: string;
  viewportOffset: { x: number; y: number };
  virtualRect?: Rect;
  isLeader: boolean;
  permissionGranted: boolean;
  sharedData: Record<string, any>; // Arbitrary shared data (replaces SharedState)
};

export type VirtualEvent = 
  | { type: 'HELLO'; payload: WindowSnapshot }
  | { type: 'HEARTBEAT'; payload: WindowSnapshot }
  | { type: 'GOODBYE'; payload: { id: string } }
  | { type: 'LAYOUT_UPDATE'; payload: VflLayout }
  | { type: 'LEADER_CLAIM'; payload: { id: string, timestamp: number } }
  | { type: 'SHARED_DATA_UPDATE'; payload: { key: string, value: any } }; // New event

export type VirtualContext = VirtualState & {
  // Method Dispatches
  requestPermission: () => Promise<void>;
  computeWithoutPermission: () => void;
  // Access to core engine
  engine: any; // Type as VirtualEngine in implementation but avoid circular dep here if possible or just use 'any' / 'object'
};
