import type { Frame } from "@/lib/eyewear";
import { FrameArt } from "@/components/FrameArt";
import { cn } from "@/lib/utils";

export function FrameThumb({ frame, className, artClassName }: { frame: Frame; className?: string; artClassName?: string }) {
  if (frame.image_url) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center p-[8%]", className)}>
        <img src={frame.image_url} alt={frame.name} loading="lazy" className={cn("max-h-full w-full object-contain drop-shadow-md", artClassName)} />
      </div>
    );
  }
  return (
    <div className={cn("flex h-full w-full items-center justify-center", className)}>
      <FrameArt shape={frame.shape} color={frame.frame_color} tint={frame.lens_tint} material={frame.material} className={cn("w-4/5 drop-shadow-md", artClassName)} />
    </div>
  );
}
