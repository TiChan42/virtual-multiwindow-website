import { VflLayout, VflScreen, Rect } from "../types/types";
import { decodeVflFromUrlParam, assignScreenForWindow } from "../utils/vfl";
import { getScreenIdFromUrl, getScreenPositionFromUrl } from "../utils/screenUtils"; // We need to make sure these exist or reimplement cleanly

/**
 * 1. Extract static layout from URL
 */
export function getStaticLayoutFromUrl(): VflLayout | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const layoutParam = url.searchParams.get("layout");
  if (!layoutParam) return null;
  return decodeVflFromUrlParam(layoutParam);
}

/**
 * 2. Calculate Screen Assignment (Central Method)
 * Priority: URL > Geometry
 */
export function calculateAssignedScreen(
  windowId: string,
  winRect: Rect,
  screens: VflScreen[]
): VflScreen {
  // A. URL Check
  const urlScreenId = getScreenIdFromUrl();
  if (urlScreenId) {
    const match = screens.find(s => s.id === urlScreenId);
    if (match) return match;
  }

  // B. Geometry Check (Fallback)
  let physicalScreenSize: { w: number, h: number } | undefined;
  if (typeof window !== "undefined" && window.screen) {
    physicalScreenSize = { w: window.screen.width, h: window.screen.height };
  }

  const assignment = assignScreenForWindow({ 
    windowId, 
    winRect, 
    screens,
    physicalScreenSize
  });
  return screens.find(s => s.id === assignment.screenId) || screens[0];
}

/**
 * 3. Calculate Relative Position (Central Method)
 * Priority: URL > Geometry
 */
export function calculateRelativePosition(
  winRect: Rect,
  screen: VflScreen
): { x: number; y: number } {
  // A. URL Check
  const urlPos = getScreenPositionFromUrl();
  if (urlPos) {
    return urlPos;
  }

  // B. Geometry Calculation
  // We need to calculate the position relative to the assigned screen's top-left corner.
  // The `screen.x` and `screen.y` from the VFL layout are *virtual* coordinates.
  // We assume that broadly speaking, the OS layout matches the VFL layout for auto-detection to work.
  // Therefore, subtracting the screen's virtual origin from the window's absolute OS coordinate 
  // generally gives the relative position on that screen.
  
  // Example:
  // Screen 2 starts at x=1920. Window is at x=2020.
  // Relative X = 2020 - 1920 = 100. Correct.
  
  // BUT: This fails if the Virtual Layout differs from Physical (e.g. Virtual Vertical vs Physical Horizontal).
  // In that case, we can't guess relative position easily without explicit "offset" params.
  // However, for the standard case (User Bug Report):
  // "y Positionen Statisch unabhängig von der y-Position des eigen Bildschirms"
  // This implies if I move the window down (y increases), the virtual y doesn't change?
  // Or relative y is calculated wrong.
  
  // Let's verify `calculateGlobalPosition`.
  // Global = Screen.x + Relative.x
  // If Relative = Win.x - Screen.x
  // Global = Screen.x + (Win.x - Screen.x) = Win.x
  // So effectively Global = Win.x.
  
  // This is tautological if Screen.x in VFL == Screen.x in OS.
  // If they differ (e.g. Screen 1 is at 0,0 physically, but placed at 5000,5000 virtually):
  // We need: Relative = PhysicalWin - PhysicalScreenOrigin.
  // Global = VirtualScreenOrigin + Relative.
  
  // Since we don't know PhysicalScreenOrigin of the abstract VFL Screen, 
  // we must rely on `winRect` being correct relative to the screen if we assume Screen = (0,0) based relative?
  // No, `winRect` is global OS coordinates.
  
  // Let's TRY to just use the raw Window coordinates for relative calculation 
  // IF we assume the screen assignment is just a logical container.
  // But if we want precise placement:
  // Relative Pos should be: The offset inside the monitor.
  // If I maximise a window on Monitor 2, relative should be 0,0.
  // If Monitor 2 is at 1920,0. Window is at 1920,0.
  // 1920 - 1920 = 0. Correct.
  
  // What if Monitor 2 is at 0, -1080 (Stacked on top)?
  // Window at 0, -1080.
  // Screen at 0, -1080.
  // Relative = 0, 0. Correct.
  
  return {
    x: winRect.x - screen.x,
    y: winRect.y - screen.y
  };
}

/**
 * 4. Calculate Global Virtual Position (Central Method)
 * Logic: Screen Virtual Pos + Relative Pos
 */
export function calculateGlobalPosition(
  screen: VflScreen,
  relativePos: { x: number; y: number },
  winW: number,
  winH: number
): Rect {
    // Note: VflScreen currently is just a rect. 
    // In a complex VFL, checks for `vx` / `vy` (virtual coordinates) of the screen might be needed.
    // For now, we assume linear mapping as per `vfl.ts` standard (screens are placed in the frame).
    
    return {
        x: screen.x + relativePos.x,
        y: screen.y + relativePos.y,
        w: winW,
        h: winH
    };
}
