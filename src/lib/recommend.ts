// Pure frame recommendation: compatibility percentage + Arabic reasons.
import type { FaceShape, Frame, FrameShape } from "./eyewear";
import { FACE_SHAPE_LABELS, FRAME_SHAPE_LABELS } from "./eyewear";
import type { SkinTone } from "./face-analysis";

/** How well each frame shape balances each face shape (0..1). */
export const SHAPE_FIT: Record<FaceShape, Record<FrameShape, number>> = {
  round: { square: 1, rectangle: 0.97, geometric: 0.9, browline: 0.85, cat_eye: 0.75, aviator: 0.7, oval: 0.45, round: 0.3 },
  square: { round: 1, oval: 0.97, cat_eye: 0.85, aviator: 0.8, browline: 0.65, geometric: 0.55, rectangle: 0.45, square: 0.35 },
  oval: { square: 0.95, rectangle: 0.93, aviator: 0.95, geometric: 0.9, browline: 0.9, cat_eye: 0.88, round: 0.85, oval: 0.8 },
  heart: { aviator: 0.95, oval: 0.95, round: 0.9, browline: 0.75, rectangle: 0.7, cat_eye: 0.6, square: 0.6, geometric: 0.6 },
  diamond: { cat_eye: 1, oval: 0.95, browline: 0.95, round: 0.85, rectangle: 0.7, aviator: 0.65, square: 0.6, geometric: 0.5 },
};

const SHAPE_REASON: Record<FaceShape, Partial<Record<FrameShape, string>>> = {
  round: {
    square: "الزوايا الحادة للإطار المربع بتوازن استدارة وجهك وبتديله ملامح أوضح",
    rectangle: "الإطار المستطيل بيطوّل الوجه بصرياً ويقلل الإحساس بالاستدارة",
    geometric: "الخطوط الهندسية بتكسر نعومة الوجه الدائري وتديه طابع عصري",
    browline: "الحاجب العلوي القوي بيرفع النظر لفوق ويحدد ملامح الوجه",
  },
  square: {
    round: "الإطار الدائري بيلطّف زوايا الفك القوية في وجهك المربع",
    oval: "المنحنيات الناعمة بتوازن حدة الفك وتدي ملامح أهدى",
    cat_eye: "الطرف المرفوع بيشد الانتباه لعينيك بعيداً عن الفك",
    aviator: "شكل الطيار المنحني من تحت بيخفف خطوط الوجه المستقيمة",
  },
  oval: {
    square: "وجهك البيضاوي متوازن، والإطار المربع بيضيف قوة وحضور",
    rectangle: "الإطار المستطيل بيحافظ على تناسق وجهك البيضاوي",
    aviator: "تناسق وجهك بيخليك تلبس الطيار بثقة كاملة",
    geometric: "وجهك يتحمل الأشكال الجريئة والهندسي بيبرز شخصيتك",
  },
  heart: {
    aviator: "الطيار الأعرض من تحت بيوازن الجبهة العريضة مع الذقن الرفيعة",
    oval: "الإطار البيضاوي بيوزّع العرض بنعومة على الوجه",
    round: "الاستدارة بتخفف عرض الجبهة وتدي توازن لنص الوجه السفلي",
  },
  diamond: {
    cat_eye: "عين القطة بتبرز عظام الخد المميزة وتوسّع الجبهة بصرياً",
    oval: "الإطار البيضاوي بيلطّف عظام الخد البارزة",
    browline: "الحاجب العلوي بيعرّض الجبهة ويوازن عرض الخدين",
  },
};

const WARM_COLORS = ["#6b3a1f", "#c9a45c", "#b08d57", "#2a1a12", "#3b2a20", "#d8c3a5", "#2b1d14"];
const COOL_COLORS = ["#111111", "#8c8c8c", "#2f6f8f", "#1d1410", "#c98a9a"];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** -1 (cool color) .. 1 (warm color) */
export function colorWarmth(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 18) return 0; // grey/black: neutral
  return Math.max(-1, Math.min(1, (r - b) / 128));
}

export interface Recommendation {
  frame: Frame;
  score: number; // 0..100
  reasons: string[];
}

export function scoreFrame(
  frame: Frame,
  face: FaceShape,
  tone?: SkinTone | null,
): Recommendation {
  const shapeFit = SHAPE_FIT[face][frame.shape] ?? 0.6;
  const tagged = frame.suits_face_shapes.includes(face);
  let toneFit = 0.75;
  const reasons: string[] = [];

  const shapeReason = SHAPE_REASON[face][frame.shape];
  if (shapeReason) reasons.push(shapeReason);
  else if (shapeFit >= 0.8)
    reasons.push(`الإطار ${FRAME_SHAPE_LABELS[frame.shape]} مناسب لملامح الوجه ${FACE_SHAPE_LABELS[face]}`);

  if (tone) {
    const w = colorWarmth(frame.frame_color);
    if (tone.undertone === "warm") toneFit = w > 0.2 ? 1 : w < -0.2 ? 0.5 : 0.8;
    else if (tone.undertone === "cool") toneFit = w < -0.2 || w === 0 ? 1 : w > 0.4 ? 0.6 : 0.8;
    else toneFit = 0.9;
    if (toneFit >= 0.95)
      reasons.push(
        tone.undertone === "warm"
          ? "لون الإطار الدافئ متناغم مع درجة بشرتك"
          : "اللون الهادئ للإطار بيبرز درجة بشرتك الباردة",
      );
  }
  if (tagged) reasons.push("خبير المحل رشّح الموديل ده لشكل وجهك");

  const raw = shapeFit * 0.62 + toneFit * 0.18 + (tagged ? 0.2 : 0.08);
  const score = Math.round(Math.max(40, Math.min(98, 40 + raw * 60)));
  if (reasons.length === 0) reasons.push("اختيار مقبول، لكن فيه موديلات أنسب لشكل وجهك");
  return { frame, score, reasons };
}

export function recommendFrames(
  frames: Frame[],
  face: FaceShape,
  tone?: SkinTone | null,
  limit = 6,
): Recommendation[] {
  return frames
    .map((f) => scoreFrame(f, face, tone))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export { WARM_COLORS, COOL_COLORS };
