// Pure face-shape and skin-tone classification from face landmarks.
// No browser or three.js imports so it can be unit tested.
import type { FaceShape } from "./eyewear";

export interface FaceMeasures {
  /** forehead (top) to chin */
  faceLength: number;
  /** widest point across the cheekbones */
  cheekWidth: number;
  /** across the temples / upper forehead */
  foreheadWidth: number;
  /** across the jaw angles */
  jawWidth: number;
  /** chin width a little above the chin point */
  chinWidth: number;
}

export interface FaceShapeResult {
  shape: FaceShape;
  confidence: number; // 0..1
  scores: Record<FaceShape, number>;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const bell = (x: number, center: number, width: number) =>
  Math.exp(-((x - center) ** 2) / (2 * width * width));

export function classifyFaceShape(m: FaceMeasures): FaceShapeResult {
  const ratio = m.faceLength / m.cheekWidth; // elongation
  const jaw = m.jawWidth / m.cheekWidth;
  const forehead = m.foreheadWidth / m.cheekWidth;
  const chin = m.chinWidth / m.jawWidth;

  const scores: Record<FaceShape, number> = {
    // round: short face, soft jaw
    round: bell(ratio, 1.18, 0.1) * bell(jaw, 0.86, 0.07) * bell(chin, 0.62, 0.15),
    // square: short-to-medium face, wide strong jaw
    square: bell(ratio, 1.22, 0.12) * bell(jaw, 0.95, 0.05) * bell(chin, 0.72, 0.15),
    // oval: longer face, balanced forehead/jaw a bit narrower than cheeks
    oval: bell(ratio, 1.42, 0.12) * bell(jaw, 0.85, 0.07) * bell(forehead, 0.9, 0.08),
    // heart: wide forehead, narrow jaw and pointed chin
    heart: bell(forehead, 0.97, 0.06) * bell(jaw, 0.76, 0.07) * bell(chin, 0.5, 0.14),
    // diamond: cheeks clearly widest, forehead and jaw both narrow
    diamond: bell(forehead, 0.8, 0.06) * bell(jaw, 0.78, 0.07) * bell(ratio, 1.38, 0.15),
  };

  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  let best: FaceShape = "oval";
  for (const k of Object.keys(scores) as FaceShape[]) {
    scores[k] = scores[k] / total;
    if (scores[k] > scores[best]) best = k;
  }
  return { shape: best, confidence: clamp01(scores[best]), scores };
}

export type Undertone = "warm" | "cool" | "neutral";
export type Depth = "light" | "medium" | "deep";
export interface SkinTone {
  undertone: Undertone;
  depth: Depth;
  hex: string;
}

export const UNDERTONE_LABELS: Record<Undertone, string> = {
  warm: "دافئة",
  cool: "باردة",
  neutral: "محايدة",
};
export const DEPTH_LABELS: Record<Depth, string> = {
  light: "فاتحة",
  medium: "قمحية",
  deep: "سمراء",
};

export function classifySkinTone(r: number, g: number, b: number): SkinTone {
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const depth: Depth = lum > 175 ? "light" : lum > 110 ? "medium" : "deep";
  // warm skin leans yellow (r,g over b); cool leans pink/blue
  const warmth = (r - b) / Math.max(1, r) - (r - g) / Math.max(1, r) * 0.6;
  const undertone: Undertone = warmth > 0.28 ? "warm" : warmth < 0.18 ? "cool" : "neutral";
  const hex =
    "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  return { undertone, depth, hex };
}
