import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, RotateCcw, ScanFace, Sparkles } from "lucide-react";
import * as THREE from "three";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { Frame } from "@/lib/eyewear";
import { FACE_SHAPE_LABELS } from "@/lib/eyewear";
import { buildGlasses, disposeGroup, MODEL_WIDTH } from "@/components/tryon/glasses3d";
import { poseFromLandmarks, measuresFromLandmarks, medianMeasures, sampleSkin, type FacePose } from "@/components/tryon/face-tracking";
import { classifyFaceShape, classifySkinTone, UNDERTONE_LABELS, DEPTH_LABELS } from "@/lib/face-analysis";
import { saveFace, logEvent, type SavedFace } from "@/lib/storefront";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Phase = "idle" | "loading" | "ready" | "scanning" | "error";

export function TryOnViewer({
  storeId,
  frames,
  initialFrameId,
}: {
  storeId: string;
  frames: Frame[];
  initialFrameId?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const glassesRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const detectorRef = useRef<Awaited<ReturnType<typeof import("@mediapipe/tasks-vision").FaceLandmarker.createFromOptions>> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplesRef = useRef<{ measures: NonNullable<ReturnType<typeof measuresFromLandmarks>>[]; skins: [number, number, number][] }>({ measures: [], skins: [] });

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [activeFrame, setActiveFrame] = useState<Frame | undefined>(
    () => frames.find((f) => f.id === initialFrameId) ?? frames[0],
  );
  const [faceResult, setFaceResult] = useState<SavedFace | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);

  // Build / swap the glasses mesh when the active frame changes.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (glassesRef.current) {
      scene.remove(glassesRef.current);
      disposeGroup(glassesRef.current);
    }
    if (!activeFrame) return;
    const group = buildGlasses({
      shape: activeFrame.shape,
      material: activeFrame.material,
      color: activeFrame.frame_color,
      tint: activeFrame.lens_tint,
    });
    glassesRef.current = group;
    scene.add(group);
  }, [activeFrame]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const renderFrame = useCallback(
    async (lms: NormalizedLandmark[]) => {
      const video = videoRef.current;
      const renderer = rendererRef.current;
      const camera = cameraRef.current;
      const glasses = glassesRef.current;
      if (!video || !renderer || !camera || !glasses) return;

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;

      const pose: FacePose | null = poseFromLandmarks(lms, w, h);
      if (pose) {
        const scale = pose.faceWidth / MODEL_WIDTH;
        glasses.position.copy(pose.position);
        glasses.quaternion.copy(pose.quaternion);
        glasses.scale.setScalar(scale);
        glasses.visible = true;
      } else {
        glasses.visible = false;
      }

      renderer.render(sceneRef.current!, camera);

      // collect face-shape samples while scanning
      if (phase === "scanning") {
        const m = measuresFromLandmarks(lms, w, h);
        if (m) samplesRef.current.measures.push(m);
        const skin = sampleSkin(video, w, h, lms);
        if (skin) samplesRef.current.skins.push(skin);
        if (samplesRef.current.measures.length >= 12) {
          const med = medianMeasures(samplesRef.current.measures);
          const result = classifyFaceShape(med);
          const skins = samplesRef.current.skins;
          const avgSkin: [number, number, number] = skins.reduce(
            (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
            [0, 0, 0],
          ).map((v) => v / skins.length) as [number, number, number];
          const tone = classifySkinTone(avgSkin[0], avgSkin[1], avgSkin[2]);
          const saved: SavedFace = { shape: result.shape, tone, confidence: result.confidence };
          saveFace(saved);
          setFaceResult(saved);
          logEvent(storeId, "face_scan", null, result.shape);
          setPhase("ready");
        }
      }
    },
    [phase, storeId],
  );

  const tick = useCallback(async () => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const now = performance.now();
    const result = detector.detectForVideo(video, now);
    const lms = result.faceLandmarks?.[0];
    if (lms && lms.length > 0) {
      await renderFrame(lms);
    } else if (glassesRef.current) {
      glassesRef.current.visible = false;
      rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [renderFrame]);

  const startCamera = useCallback(async () => {
    setError(null);
    setPhase("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;

      // three.js scene — transparent overlay on top of the video.
      const renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current!,
        alpha: true,
        antialias: true,
      });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(w, h);
      renderer.setClearColor(0x000000, 0);
      rendererRef.current = renderer;

      const scene = new THREE.Scene();
      sceneRef.current = scene;
      const camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 100);
      // Approximate a ~640px-wide face at 60cm: place camera so model width maps sensibly.
      camera.position.z = 30;
      cameraRef.current = camera;

      // MediaPipe FaceLandmarker
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm",
      );
      const detector = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
      });
      detectorRef.current = detector;

      // Build the initial glasses group.
      if (activeFrame) {
        const group = buildGlasses({
          shape: activeFrame.shape,
          material: activeFrame.material,
          color: activeFrame.frame_color,
          tint: activeFrame.lens_tint,
        });
        glassesRef.current = group;
        scene.add(group);
      }

      setPhase("ready");
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر تشغيل الكاميرا";
      setError(msg.includes("Permission") || msg.includes("denied") ? "اسمح بالوصول للكاميرا من إعدادات المتصفح" : msg);
      setPhase("error");
    }
  }, [activeFrame, tick]);

  const startScan = useCallback(() => {
    samplesRef.current = { measures: [], skins: [] };
    setFaceResult(null);
    setPhase("scanning");
  }, []);

  const resetScan = useCallback(() => {
    samplesRef.current = { measures: [], skins: [] };
    setFaceResult(null);
    setPhase("ready");
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      stopCamera();
      detectorRef.current?.close();
      if (rendererRef.current) rendererRef.current.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* CAMERA / OVERLAY */}
      <div className="relative overflow-hidden rounded-3xl border bg-ink shadow-lift">
        <div className="relative aspect-[4/3] w-full">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
          />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />

          {phase === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center text-ink-foreground">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                <Camera className="h-7 w-7" />
              </span>
              <div>
                <p className="font-display text-xl">جرّب النظارة على وشّك</p>
                <p className="mt-1 text-sm text-ink-muted">افتح الكاميرا وهنلبّسك النظارة فوراً</p>
              </div>
              <Button variant="gold" size="lg" className="mt-2" onClick={startCamera}>
                <Camera /> ابدأ الكاميرا
              </Button>
            </div>
          )}

          {phase === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-ink-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm text-ink-muted">جاري تحميل الكاميرا والنموذج…</p>
            </div>
          )}

          {phase === "scanning" && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gold animate-scan" />
            </div>
          )}

          {phase === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-ink-foreground">
              <p className="text-sm text-ink-muted">{error}</p>
              <Button variant="glass" size="sm" onClick={startCamera}>
                <RotateCcw className="h-4 w-4" /> حاول مرة أخرى
              </Button>
            </div>
          )}

          {phase === "ready" && showOverlay && (
            <button
              type="button"
              onClick={() => setShowOverlay(false)}
              className="absolute end-3 top-3 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white backdrop-blur"
            >
              إخفاء النظارة
            </button>
          )}
          {phase === "ready" && !showOverlay && (
            <button
              type="button"
              onClick={() => setShowOverlay(true)}
              className="absolute end-3 top-3 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white backdrop-blur"
            >
              إظهار النظارة
            </button>
          )}
        </div>

        {(phase === "ready" || phase === "scanning") && (
          <div className="flex items-center justify-between gap-2 border-t border-white/10 p-3">
            <Button variant="glass" size="sm" onClick={stopCamera}>
              إيقاف الكاميرا
            </Button>
            {phase === "scanning" ? (
              <span className="flex items-center gap-2 text-xs text-ink-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> بتحلّل شكل وجهك…
              </span>
            ) : (
              <Button variant="gold" size="sm" onClick={startScan}>
                <ScanFace className="h-4 w-4" /> حلّل شكل وجهي
              </Button>
            )}
          </div>
        )}
      </div>

      {/* FRAME PICKER + RESULT */}
      <div className="space-y-5">
        <div>
          <h3 className="mb-3 text-sm font-medium">اختار نظارة</h3>
          <div className="grid max-h-[280px] grid-cols-2 gap-2 overflow-y-auto pr-1">
            {frames.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFrame(f)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border bg-card p-2 text-start transition-colors",
                  activeFrame?.id === f.id ? "border-brand ring-1 ring-brand" : "hover:bg-muted",
                )}
              >
                <span
                  className="h-8 w-8 shrink-0 rounded-lg border"
                  style={{ backgroundColor: f.frame_color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{f.name}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{f.shape}</span>
                </span>
                {activeFrame?.id === f.id && <Check className="h-3.5 w-3.5 shrink-0 text-brand" />}
              </button>
            ))}
          </div>
        </div>

        {faceResult && (
          <div className="rounded-2xl border border-brand/40 bg-gold-soft/30 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gold" />
              <span className="font-display text-lg">شكل وجهك: {FACE_SHAPE_LABELS[faceResult.shape]}</span>
            </div>
            {faceResult.tone && (
              <p className="mt-2 text-xs text-muted-foreground">
                درجة البشرة: {UNDERTONE_LABELS[faceResult.tone.undertone]} · {DEPTH_LABELS[faceResult.tone.depth]}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              نسبة الثقة: {Math.round(faceResult.confidence * 100)}%
            </p>
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={resetScan}>
              <RotateCcw className="h-3.5 w-3.5" /> أعِد التحليل
            </Button>
          </div>
        )}

        {activeFrame && (
          <div className="rounded-2xl border bg-card p-4 shadow-soft">
            <p className="font-medium">{activeFrame.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              جربها الآن بالكاميرا — حرّك رأسك وهيتبعك النظارة.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
