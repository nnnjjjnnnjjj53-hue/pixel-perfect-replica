// Shared, browser- and server-safe eyewear vocabulary (Arabic labels).

export const BRAND_NAME = "عدسة";
export const BRAND_NAME_EN = "Adasa";

export type FaceShape = "oval" | "round" | "square" | "heart" | "diamond";
export type FrameShape =
  | "round"
  | "square"
  | "rectangle"
  | "aviator"
  | "cat_eye"
  | "oval"
  | "geometric"
  | "browline";
export type FrameCategory = "men" | "women" | "kids" | "unisex";
export type FrameMaterial = "acetate" | "metal" | "titanium" | "tr90";
export type FrameKind = "optical" | "sunglasses";

export interface Frame {
  id: string;
  store_id: string;
  name: string;
  sku: string;
  description: string;
  category: FrameCategory;
  kind: FrameKind;
  shape: FrameShape;
  material: FrameMaterial;
  price: number;
  frame_color: string;
  lens_tint: string | null;
  image_path: string | null;
  image_url?: string | null;
  model_path: string | null;
  model_url?: string | null;
  suits_face_shapes: string[];
  is_active: boolean;
}

export interface LensOption {
  id: string;
  step: "usage" | "index" | "coating";
  code: string;
  name: string;
  description: string;
  price: number;
  sort_order: number;
}

export interface PublicStore {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  logo_path: string | null;
  logo_url?: string | null;
  brand_color: string;
  whatsapp_number: string;
  status: string;
}

export const FACE_SHAPE_LABELS: Record<FaceShape, string> = {
  oval: "بيضاوي",
  round: "دائري",
  square: "مربع",
  heart: "قلب",
  diamond: "ماسي",
};

export const FRAME_SHAPE_LABELS: Record<FrameShape, string> = {
  round: "دائري",
  square: "مربع",
  rectangle: "مستطيل",
  aviator: "طيار",
  cat_eye: "عين القطة",
  oval: "بيضاوي",
  geometric: "هندسي",
  browline: "براولاين",
};

export const CATEGORY_LABELS: Record<FrameCategory, string> = {
  men: "رجالي",
  women: "حريمي",
  kids: "أطفال",
  unisex: "للجنسين",
};

export const MATERIAL_LABELS: Record<FrameMaterial, string> = {
  acetate: "أسيتات",
  metal: "معدن",
  titanium: "تيتانيوم",
  tr90: "TR90 مرن",
};

export const KIND_LABELS: Record<FrameKind, string> = {
  optical: "نظارة طبية",
  sunglasses: "نظارة شمسية",
};

export function formatPrice(value: number, currency = "ج.م") {
  return `${new Intl.NumberFormat("ar-EG").format(Math.round(value))} ${currency}`;
}

export function isFaceShape(v: unknown): v is FaceShape {
  return typeof v === "string" && v in FACE_SHAPE_LABELS;
}
