// Procedural 3D glasses built from the shared lens outlines (browser only).
import * as THREE from "three";
import type { FrameMaterial, FrameShape } from "@/lib/eyewear";
import { FRAME_HALF_WIDTH, LENS_OFFSET, insetOutline, lensOutline, rimThickness, type Pt } from "@/lib/frame-geometry";

export interface GlassesSpec {
  shape: FrameShape;
  material: FrameMaterial;
  color: string;
  tint: string | null;
}

/** Model width in model units, used to scale to the face. */
export const MODEL_WIDTH = FRAME_HALF_WIDTH * 2;

function shapeFrom(pts: Pt[], dx: number, mirror: boolean) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => {
    const px = (mirror ? -x : x) + dx;
    if (i === 0) s.moveTo(px, y);
    else s.lineTo(px, y);
  });
  s.closePath();
  return s;
}

function pathFrom(pts: Pt[], dx: number, mirror: boolean) {
  const p = new THREE.Path();
  // holes must wind the other way
  const list = [...pts].reverse();
  list.forEach(([x, y], i) => {
    const px = (mirror ? -x : x) + dx;
    if (i === 0) p.moveTo(px, y);
    else p.lineTo(px, y);
  });
  p.closePath();
  return p;
}

export function buildGlasses(spec: GlassesSpec): THREE.Group {
  const group = new THREE.Group();
  const metal = spec.material === "metal" || spec.material === "titanium";
  const frameMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(spec.color),
    metalness: metal ? 1 : 0.05,
    roughness: metal ? 0.22 : 0.32,
    clearcoat: metal ? 0.2 : 1,
    clearcoatRoughness: 0.15,
  });
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(spec.tint ?? "#f3f1ea"),
    metalness: 0,
    roughness: 0.04,
    transparent: true,
    opacity: spec.tint ? 0.78 : 0.14,
    clearcoat: 1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const outline = lensOutline(spec.shape);
  const t = rimThickness(spec.material) * (spec.shape === "browline" ? 0.6 : 1);
  const inner = insetOutline(outline, t);
  const depth = metal ? 0.035 : 0.07;
  const extrude = { depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2, curveSegments: 4 };

  for (const side of [1, -1] as const) {
    const dx = side * LENS_OFFSET;
    const mirror = side === -1;
    const rimShape = shapeFrom(outline, dx, mirror);
    rimShape.holes.push(pathFrom(inner, dx, mirror));
    const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(rimShape, extrude), frameMat);
    rim.position.z = -depth / 2;
    group.add(rim);

    const lens = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(inner, dx, mirror)), lensMat);
    lens.position.z = -0.005;
    lens.renderOrder = 2;
    group.add(lens);

    // hinge block + temple arm going back toward the ear
    const hingeX = side * (FRAME_HALF_WIDTH - 0.04);
    const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.12), frameMat);
    hinge.position.set(hingeX, 0.12, -0.04);
    group.add(hinge);

    const templeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hingeX, 0.12, -0.08),
      new THREE.Vector3(hingeX + side * 0.04, 0.1, -1.0),
      new THREE.Vector3(hingeX + side * 0.02, 0.06, -1.9),
      new THREE.Vector3(hingeX - side * 0.02, -0.25, -2.3),
    ]);
    const temple = new THREE.Mesh(new THREE.TubeGeometry(templeCurve, 32, metal ? 0.022 : 0.04, 8, false), frameMat);
    group.add(temple);
  }

  if (spec.shape === "browline") {
    for (const side of [1, -1] as const) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(side * 0.12, 0.26, 0),
        new THREE.Vector3(side * LENS_OFFSET, 0.46, 0.02),
        new THREE.Vector3(side * (LENS_OFFSET + 0.54), 0.2, 0),
      );
      const brow = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.065, 8, false), new THREE.MeshPhysicalMaterial({ color: new THREE.Color(spec.color).multiplyScalar(0.6), roughness: 0.3, clearcoat: 1 }));
      group.add(brow);
    }
  }

  // bridge
  const bridge = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-LENS_OFFSET + 0.44, 0.1, 0),
    new THREE.Vector3(0, 0.24, 0.03),
    new THREE.Vector3(LENS_OFFSET - 0.44, 0.1, 0),
  );
  group.add(new THREE.Mesh(new THREE.TubeGeometry(bridge, 20, metal ? 0.022 : 0.045, 8, false), frameMat));
  if (spec.shape === "aviator") {
    const bar = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-LENS_OFFSET + 0.3, 0.33, 0),
      new THREE.Vector3(0, 0.38, 0.02),
      new THREE.Vector3(LENS_OFFSET - 0.3, 0.33, 0),
    );
    group.add(new THREE.Mesh(new THREE.TubeGeometry(bar, 20, 0.018, 8, false), frameMat));
  }
  // nose pads for metal frames
  if (metal) {
    for (const side of [1, -1]) {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), lensMat);
      pad.scale.set(0.6, 1, 0.4);
      pad.position.set(side * 0.2, -0.12, -0.12);
      group.add(pad);
    }
  }
  return group;
}

export function disposeGroup(group: THREE.Object3D) {
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
