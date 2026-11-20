import { useId } from "react";
import type { FrameMaterial, FrameShape } from "@/lib/eyewear";
import { LENS_OFFSET, lensOutline, rimThickness } from "@/lib/frame-geometry";

function toPath(pts: [number, number][], dx: number, mirror: boolean) {
  return (
    pts
      .map(([x, y], i) => `${i ? "L" : "M"}${(mirror ? -x : x) + dx},${-y}`)
      .join(" ") + " Z"
  );
}

/** Procedural front view of a frame, used when a store has no product photo. */
export function FrameArt({
  shape,
  color,
  tint,
  material = "acetate",
  className,
}: {
  shape: FrameShape;
  color: string;
  tint?: string | null;
  material?: FrameMaterial;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const outline = lensOutline(shape);
  const t = rimThickness(material);
  const right = toPath(outline, LENS_OFFSET, false);
  const left = toPath(outline, -LENS_OFFSET, true);
  const browline = shape === "browline";
  return (
    <svg viewBox="-1.35 -0.75 2.7 1.5" className={className} role="img" aria-hidden="true">
      <defs>
        <linearGradient id={`lens-${id}`} x1="0" y1="-0.5" x2="0.2" y2="0.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={tint ?? "#ffffff"} stopOpacity={tint ? 0.92 : 0.55} />
          <stop offset="1" stopColor={tint ?? "#e8e2d6"} stopOpacity={tint ? 0.7 : 0.25} />
        </linearGradient>
        <linearGradient id={`shine-${id}`} x1="-1" y1="-0.6" x2="1" y2="0.6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* temples peeking out */}
      <path d={`M${LENS_OFFSET + 0.5},-0.12 L1.3,-0.16`} stroke={color} strokeWidth={t * 0.8} strokeLinecap="round" />
      <path d={`M${-LENS_OFFSET - 0.5},-0.12 L-1.3,-0.16`} stroke={color} strokeWidth={t * 0.8} strokeLinecap="round" />
      <path d={right} fill={`url(#lens-${id})`} />
      <path d={left} fill={`url(#lens-${id})`} />
      <path d={right} fill={`url(#shine-${id})`} />
      <path d={left} fill={`url(#shine-${id})`} />
      <path d={right} fill="none" stroke={color} strokeWidth={browline ? t * 0.5 : t} strokeLinejoin="round" />
      <path d={left} fill="none" stroke={color} strokeWidth={browline ? t * 0.5 : t} strokeLinejoin="round" />
      {browline && (
        <path
          d={`M${-LENS_OFFSET - 0.52},-0.2 Q${-LENS_OFFSET},-0.42 -0.12,-0.24 M0.12,-0.24 Q${LENS_OFFSET},-0.42 ${LENS_OFFSET + 0.52},-0.2`}
          stroke={color}
          strokeWidth={0.12}
          fill="none"
          strokeLinecap="round"
        />
      )}
      <path
        d={`M${-LENS_OFFSET + 0.42},-0.12 Q0,-0.26 ${LENS_OFFSET - 0.42},-0.12`}
        stroke={color}
        strokeWidth={t * 0.9}
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
