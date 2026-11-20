// Landmark → pose and face measurements (browser only, uses three math).
import * as THREE from "three";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { FaceMeasures } from "@/lib/face-analysis";

export interface FacePose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  faceWidth: number;
  yawDeg: number;
  pitchDeg: number;
}

export function landmarkToWorld(l: NormalizedLandmark, w: number, h: number) {
  return new THREE.Vector3((l.x - 0.5) * w, -(l.y - 0.5) * h, -l.z * w);
}

export function poseFromLandmarks(lms: NormalizedLandmark[], w: number, h: number): FacePose | null {
  const P = (i: number) => {
    const l = lms[i];
    return l ? landmarkToWorld(l, w, h) : null;
  };
  const rOut = P(33), rIn = P(133), lOut = P(263), lIn = P(362), top = P(10), chin = P(152), sideR = P(127), sideL = P(356), bridge = P(168);
  if (!rOut || !rIn || !lOut || !lIn || !top || !chin || !sideR || !sideL || !bridge) return null;

  const x = lOut.clone().sub(rOut).normalize();
  const yApprox = top.clone().sub(chin).normalize();
  const z = new THREE.Vector3().crossVectors(x, yApprox).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(m);

  const faceWidth = sideR.distanceTo(sideL);
  const eyes = rOut.clone().add(rIn).add(lOut).add(lIn).multiplyScalar(0.25);
  const position = eyes.lerp(bridge, 0.25).add(z.clone().multiplyScalar(faceWidth * 0.07));

  const yawDeg = THREE.MathUtils.radToDeg(Math.atan2(z.x, z.z));
  const pitchDeg = THREE.MathUtils.radToDeg(Math.atan2(-z.y, z.z));
  return { position, quaternion, faceWidth, yawDeg, pitchDeg };
}

export function measuresFromLandmarks(lms: NormalizedLandmark[], w: number, h: number): FaceMeasures | null {
  const d = (a: number, b: number) => {
    const p = lms[a], q = lms[b];
    if (!p || !q) return 0;
    return Math.hypot((p.x - q.x) * w, (p.y - q.y) * h);
  };
  const m: FaceMeasures = {
    faceLength: d(10, 152),
    cheekWidth: d(234, 454),
    foreheadWidth: d(54, 284),
    jawWidth: d(172, 397),
    chinWidth: d(149, 378),
  };
  return Object.values(m).every((v) => v > 1) ? m : null;
}

export function medianMeasures(list: FaceMeasures[]): FaceMeasures {
  const med = (k: keyof FaceMeasures) => {
    const s = list.map((m) => m[k]).sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)] ?? 0;
  };
  return { faceLength: med("faceLength"), cheekWidth: med("cheekWidth"), foreheadWidth: med("foreheadWidth"), jawWidth: med("jawWidth"), chinWidth: med("chinWidth") };
}

/** Average RGB of small patches around cheek and forehead landmarks. */
export function sampleSkin(
  source: CanvasImageSource,
  sw: number,
  sh: number,
  lms: NormalizedLandmark[],
): [number, number, number] | null {
  const c = document.createElement("canvas");
  c.width = 160;
  c.height = Math.round((160 * sh) / sw);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, c.width, c.height);
  let r = 0, g = 0, b = 0, n = 0;
  for (const idx of [50, 280, 151, 101, 330]) {
    const l = lms[idx];
    if (!l) continue;
    const px = Math.round(l.x * c.width), py = Math.round(l.y * c.height);
    const data = ctx.getImageData(Math.max(0, px - 3), Math.max(0, py - 3), 6, 6).data;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i] ?? 0;
      g += data[i + 1] ?? 0;
      b += data[i + 2] ?? 0;
      n++;
    }
  }
  return n ? [r / n, g / n, b / n] : null;
}
