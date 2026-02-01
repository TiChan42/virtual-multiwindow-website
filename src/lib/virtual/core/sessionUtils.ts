import { Rect } from "../types/types";

/**
 * Generates a deterministic hash from a string.
 * Used to create a Session ID from the Layout JSON.
 */
export async function generateSessionId(layoutString: string): Promise<string> {
  if (!layoutString) return "default";
  
  // Simple hash for older browsers or non-secure contexts
  let hash = 0;
  for (let i = 0; i < layoutString.length; i++) {
    const char = layoutString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return "vwin:" + (hash >>> 0).toString(16);
}

// Helper to check if a rect is mostly valid
export function isValidRect(r: Rect): boolean {
  return r.w > 0 && r.h > 0;
}
