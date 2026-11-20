// Lens outlines shared by the 2D catalog art and the 3D try-on model.
// Units: one lens is ~1 wide, centred at 0. The nose side is x < 0.
import type { FrameShape, FrameMaterial } from "./eyewear";

export type Pt = [number, number];

function superellipse(a: number, b: number, n: number, steps = 72): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push([a * Math.sign(c) * Math.abs(c) ** (2 / n), b * Math.sign(s) * Math.abs(s) ** (2 / n)]);
  }
  return pts;
}

export function lensOutline(shape: FrameShape): Pt[] {
  switch (shape) {
    case "round":
      return superellipse(0.46, 0.44, 2);
    case "oval":
      return superellipse(0.5, 0.34, 2.2);
    case "square":
      return superellipse(0.5, 0.43, 4.5);
    case "rectangle":
      return superellipse(0.52, 0.3, 4);
    case "browline":
      return superellipse(0.5, 0.36, 3).map(([x, y]) => [x, y > 0 ? y * 0.85 : y * 1.05]);
    case "geometric": {
      const pts: Pt[] = [];
      for (let i = 0; i < 6; i++) {
        const t = (i / 6) * Math.PI * 2 + Math.PI / 6;
        pts.push([Math.cos(t) * 0.52, Math.sin(t) * 0.44]);
      }
      // densify edges so offsets stay smooth
      const out: Pt[] = [];
      for (let i = 0; i < 6; i++) {
        const a = pts[i]!;
        const b = pts[(i + 1) % 6]!;
        for (let k = 0; k < 8; k++) out.push([a[0] + ((b[0] - a[0]) * k) / 8, a[1] + ((b[1] - a[1]) * k) / 8]);
      }
      return out;
    }
    case "cat_eye":
      return superellipse(0.52, 0.34, 3).map(([x, y]) => {
        const outer = Math.max(0, x / 0.52);
        return [x * (1 + 0.08 * outer), y > 0 ? y + 0.16 * outer ** 2 : y * (1 - 0.15 * outer)];
      });
    case "aviator":
      return superellipse(0.52, 0.42, 2.6).map(([x, y]) => {
        const nasal = Math.max(0, -x / 0.52);
        return [x, y > 0 ? y * 0.72 : y * (1 + 0.25 * (1 - nasal)) - 0.03];
      });
  }
}

/** Shrink an outline toward its centroid by an absolute distance. */
export function insetOutline(pts: Pt[], d: number): Pt[] {
  return pts.map(([x, y]) => {
    const r = Math.hypot(x, y) || 1;
    const k = Math.max(0.1, (r - d) / r);
    return [x * k, y * k];
  });
}

export const BRIDGE = 0.2;
export const LENS_OFFSET = 0.5 + BRIDGE / 2 + 0.02; // lens centre x
export const FRAME_HALF_WIDTH = LENS_OFFSET + 0.58;

export function rimThickness(material: FrameMaterial): number {
  return material === "acetate" ? 0.085 : material === "tr90" ? 0.07 : 0.035;
}
