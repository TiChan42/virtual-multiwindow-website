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
  rect: Rect; // window rect in global coords (screenX/screenY + inner)
  assignedScreenId?: string;
  viewportOffset?: { x: number; y: number }; // relative to frame
  timestamp?: number;
};
