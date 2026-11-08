export type ContextMenuPoint = { x: number; y: number }

/** Keep a fixed-position context menu inside the visible viewport. */
export function clampContextMenuPoint(
  point: ContextMenuPoint,
  menuWidth: number,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = 8
): ContextMenuPoint {
  return {
    x: Math.max(margin, Math.min(point.x, viewportWidth - menuWidth - margin)),
    y: Math.max(margin, Math.min(point.y, viewportHeight - menuHeight - margin)),
  }
}
