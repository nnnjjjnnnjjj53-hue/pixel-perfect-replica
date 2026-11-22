import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, RotateCcw, ScanFace, Sparkles } from "lucide-react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { Frame } from "@/lib/eyewear";
import { FACE_SHAPE_LABELS } from "@/lib/eyewear";
import { buildGlasses, buildPhotoGlasses, disposeGlasses, MODEL_WIDTH } from "@/components/tryon/glasses3d";
import { poseFromLandmarks, measuresFromLandmarks, medianMeasures, sampleSkin } from "@/components/tryon/face-tracking";
import { classifyFaceShape, classifySkinTone, UNDERTONE_LABELS, DEPTH_LABELS } from "@/lib/face-analysis";
import { saveFace, logEvent, type SavedFace } from "@/lib/storefront";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Phase = "idle" | "loading" | "ready" | "scanning" | "error";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
/** Warn in the console after this long without a detected face. */
const NO_FACE_WARN_MS = 2500;
const LOG = "[Adasa TryOn]";
/** 0..1 — how fast the glasses follow the face each frame (lower = steadier). */
const SMOOTHING = 0.55;

interface DebugStats {
  delegate: "GPU" | "CPU" | "—";
  videoW: number;
  videoH: number;
  fps: number;
  landmarks: number;
  faceFound: boolean;
  lastError: string | null;
}

const EMPTY_STATS: DebugStats = { delegate: "—", videoW: 0, videoH: 0, fps: 0, landmarks: 0, faceFound: false, lastError: null };

async function createDetector(): Promise<{ detector: FaceLandmarker; delegate: "GPU" | "CPU" }> {
  const vision = await import("@mediapipe/tasks-vision");
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
  const make = (delegate: "GPU" | "CPU") =>
    vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO",
      numFaces: 1,
    });
  try {
    return { detector: await make("GPU"), delegate: "GPU" };
  } catch (e) {
    console.warn(LOG, "GPU delegate failed, falling back to CPU:", e);
    return { detector: await make("CPU"), delegate: "CPU" };
  }
}

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
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const detectorRef = useRef<FaceLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplesRef = useRef<{ measures: NonNullable<ReturnType<typeof measuresFromLandmarks>>[]; skins: [number, number, number][] }>({ measures: [], skins: [] });

  // Mutable state the render loop reads every frame (avoids stale closures).
  const phaseRef = useRef<Phase>("idle");
  const showOverlayRef = useRef(true);
  const statsRef = useRef<DebugStats>({ ...EMPTY_STATS });
  const loopRef = useRef<() => void>(() => {});
  const trackRef = useRef({ lastVideoTime: -1, lastFaceAt: 0, warned: false, frames: 0, fpsAt: 0, lastUi: 0, sizeW: 0, sizeH: 0 });

  const [phase, setPhaseState] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [activeFrame, setActiveFrame] = useState<Frame | undefined>(
    () => frames.find((f) => f.id === initialFrameId) ?? frames[0],
  );
  const [faceResult, setFaceResult] = useState<SavedFace | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [stats, setStats] = useState<DebugStats>(EMPTY_STATS);
  const [showDebug, setShowDebug] = useState(false);

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  useEffect(() => {
    showOverlayRef.current = showOverlay;
  }, [showOverlay]);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug")) setShowDebug(true);
  }, []);

  /** Swap the glasses in the scene: real product photo when available, 3D model otherwise. */
  const mountTokenRef = useRef(0);
  const mountGlasses = useCallback(async (frame: Frame | undefined) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const token = ++mountTokenRef.current;
    let group: THREE.Group | null = null;
    if (frame?.image_url) {
      try {
        group = await buildPhotoGlasses(frame.image_url);
      } catch (e) {
        console.warn(LOG, "product photo failed to load, using 3D model instead:", e);
      }
    }
    if (!group && frame) {
      group = buildGlasses({ shape: frame.shape, material: frame.material, color: frame.frame_color, tint: frame.lens_tint });
    }
    if (token !== mountTokenRef.current) {
      if (group) disposeGlasses(group);
      return; // a newer frame was picked while this one loaded
    }
    if (glassesRef.current) {
      scene.remove(glassesRef.current);
      disposeGlasses(glassesRef.current);
      glassesRef.current = null;
    }
    if (!group) return;
    group.visible = false;
    glassesRef.current = group;
    scene.add(group);
  }, []);

  useEffect(() => {
    void mountGlasses(activeFrame);
  }, [activeFrame, mountGlasses]);

  /**
   * Match the WebGL drawing buffer + orthographic camera to the video's native
   * pixel size. Landmarks are mapped into the same pixel space, and the canvas
   * uses the same CSS object-cover crop as the video, so they stay aligned on
   * any container aspect ratio (incl. portrait phones).
   */
  const syncSize = useCallback((w: number, h: number) => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const t = trackRef.current;
    if (!renderer || !camera || (t.sizeW === w && t.sizeH === h)) return;
    t.sizeW = w;
    t.sizeH = h;
    renderer.setSize(w, h, false); // false = keep CSS size (w-full h-full)
    camera.left = -w / 2;
    camera.right = w / 2;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.updateProjectionMatrix();
    statsRef.current.videoW = w;
    statsRef.current.videoH = h;
    console.info(LOG, `video ${w}x${h} (${w < h ? "portrait" : "landscape"})`);
  }, []);

  const finishScanIfReady = useCallback(() => {
    if (samplesRef.current.measures.length < 12) return;
    const med = medianMeasures(samplesRef.current.measures);
    const result = classifyFaceShape(med);
    const skins = samplesRef.current.skins;
    const avgSkin = skins.length
      ? (skins.reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0]).map((v) => v / skins.length) as [number, number, number])
      : null;
    const saved: SavedFace = {
      shape: result.shape,
      tone: avgSkin ? classifySkinTone(avgSkin[0], avgSkin[1], avgSkin[2]) : null,
      confidence: result.confidence,
    } as SavedFace;
    saveFace(saved);
    setFaceResult(saved);
    logEvent(storeId, "face_scan", null, result.shape);
    setPhase("ready");
  }, [storeId, setPhase]);

  // Render loop — always reads the latest refs.
  loopRef.current = () => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!video || !detector || !renderer || !scene || !camera || !streamRef.current) return;

    rafRef.current = requestAnimationFrame(() => loopRef.current());
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    syncSize(w, h);

    const t = trackRef.current;
    const now = performance.now();
    const s = statsRef.current;

    if (video.currentTime !== t.lastVideoTime) {
      t.lastVideoTime = video.currentTime;
      let lms: NormalizedLandmark[] | undefined;
      try {
        lms = detector.detectForVideo(video, now).faceLandmarks?.[0];
        s.lastError = null;
      } catch (e) {
        s.lastError = e instanceof Error ? e.message : String(e);
        console.error(LOG, "detectForVideo failed:", e);
      }
      t.frames++;
      s.landmarks = lms?.length ?? 0;
      s.faceFound = !!lms && lms.length > 0;

      const glasses = glassesRef.current;
      if (lms && lms.length > 0) {
        t.lastFaceAt = now;
        if (t.warned) {
          console.info(LOG, "face detected again");
          t.warned = false;
        }
        const pose = poseFromLandmarks(lms, w, h);
        if (glasses && pose) {
          // Smooth landmark jitter; snap when the face (re)appears.
          const k = glasses.visible ? SMOOTHING : 1;
          glasses.position.lerp(pose.position, k);
          glasses.quaternion.slerp(pose.quaternion, k);
          const target = pose.faceWidth / MODEL_WIDTH;
          glasses.scale.setScalar(glasses.scale.x + (target - glasses.scale.x) * k);
          glasses.visible = showOverlayRef.current;
        } else if (glasses) {
          glasses.visible = false;
        }

        if (phaseRef.current === "scanning") {
          const m = measuresFromLandmarks(lms, w, h);
          if (m) samplesRef.current.measures.push(m);
          const skin = sampleSkin(video, w, h, lms);
          if (skin) samplesRef.current.skins.push(skin);
          finishScanIfReady();
        }
      } else {
        if (glasses) glasses.visible = false;
        if (!t.warned && now - t.lastFaceAt > NO_FACE_WARN_MS) {
          t.warned = true;
          console.warn(
            LOG,
            `no face detected for ${NO_FACE_WARN_MS / 1000}s — check lighting, distance and that the face is inside the frame.`,
            { video: `${w}x${h}`, readyState: video.readyState, delegate: s.delegate },
          );
        }
      }
      renderer.render(scene, camera);
    }

    if (now - t.fpsAt >= 1000) {
      s.fps = Math.round((t.frames * 1000) / (now - t.fpsAt || 1));
      t.frames = 0;
      t.fpsAt = now;
    }
    if (now - t.lastUi > 250) {
      t.lastUi = now;
      setStats({ ...s });
    }
  };

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      for (const tr of streamRef.current.getTracks()) tr.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (glassesRef.current) glassesRef.current.visible = false;
    rendererRef.current?.clear();
    statsRef.current = { ...statsRef.current, faceFound: false, landmarks: 0, fps: 0 };
    setStats({ ...statsRef.current });
    setPhase("idle");
  }, [setPhase]);

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

      // three.js scene — transparent overlay above the video (created once).
      if (!rendererRef.current) {
        const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current!, alpha: true, antialias: true, premultipliedAlpha: false });
        renderer.setPixelRatio(1); // buffer already matches the video's native resolution
        renderer.setClearColor(0x000000, 0);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        rendererRef.current = renderer;

        const scene = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();
        scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
        const key = new THREE.DirectionalLight(0xffffff, 1.6);
        key.position.set(0.3, 0.6, 1);
        scene.add(key);
        sceneRef.current = scene;

        // Orthographic camera in video pixel space (origin = video centre).
        const camera = new THREE.OrthographicCamera(-640, 640, 360, -360, 1, 20000);
        camera.position.set(0, 0, 10000);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;
      }
      trackRef.current.sizeW = 0;
      trackRef.current.sizeH = 0;
      syncSize(video.videoWidth || 1280, video.videoHeight || 720);
      await mountGlasses(activeFrame);

      if (!detectorRef.current) {
        const { detector, delegate } = await createDetector();
        detectorRef.current = detector;
        statsRef.current.delegate = delegate;
        console.info(LOG, `FaceLandmarker ready (delegate: ${delegate})`);
      }

      const t = trackRef.current;
      t.lastVideoTime = -1;
      t.lastFaceAt = performance.now();
      t.warned = false;
      t.fpsAt = performance.now();
      setPhase("ready");
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => loopRef.current());
    } catch (e) {
      console.error(LOG, "start failed:", e);
      const msg = e instanceof Error ? e.message : "تعذر تشغيل الكاميرا";
      setError(msg.includes("Permission") || msg.includes("denied") ? "اسمح بالوصول للكاميرا من إعدادات المتصفح" : msg);
      setPhase("error");
    }
  }, [activeFrame, mountGlasses, setPhase, syncSize]);

  const startScan = useCallback(() => {
    samplesRef.current = { measures: [], skins: [] };
    setFaceResult(null);
    setPhase("scanning");
  }, [setPhase]);

  const resetScan = useCallback(() => {
    samplesRef.current = { measures: [], skins: [] };
    setFaceResult(null);
    setPhase("ready");
  }, [setPhase]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (streamRef.current) for (const tr of streamRef.current.getTracks()) tr.stop();
      detectorRef.current?.close();
      rendererRef.current?.dispose();
    };
  }, []);

  const live = phase === "ready" || phase === "scanning";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* CAMERA / OVERLAY */}
      <div className="relative overflow-hidden rounded-3xl border bg-ink shadow-lift">
        <div className="relative isolate aspect-[3/4] w-full sm:aspect-[4/3]">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 z-0 h-full w-full -scale-x-100 object-cover"
          />
          <canvas
            ref={canvasRef}
            data-testid="tryon-canvas"
            className="pointer-events-none absolute inset-0 z-10 h-full w-full -scale-x-100 object-cover"
          />

          {phase === "idle" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 text-center text-ink-foreground">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink-foreground/10">
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
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 text-ink-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm text-ink-muted">جاري تحميل الكاميرا والنموذج…</p>
            </div>
          )}

          {phase === "scanning" && (
            <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gold animate-scan" />
            </div>
          )}

          {phase === "error" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-6 text-center text-ink-foreground">
              <p className="text-sm text-ink-muted">{error}</p>
              <Button variant="glass" size="sm" onClick={startCamera}>
                <RotateCcw className="h-4 w-4" /> حاول مرة أخرى
              </Button>
            </div>
          )}

          {live && (
            <>
              <button
                type="button"
                onClick={() => setShowOverlay((v) => !v)}
                className="absolute end-3 top-3 z-30 rounded-full bg-ink/60 px-3 py-1.5 text-xs text-ink-foreground backdrop-blur"
              >
                {showOverlay ? "إخفاء النظارة" : "إظهار النظارة"}
              </button>

              {/* Face-detection status + debug details */}
              <button
                type="button"
                onClick={() => setShowDebug((v) => !v)}
                data-testid="face-status"
                data-face={stats.faceFound ? "yes" : "no"}
                className="absolute bottom-3 start-3 z-30 flex flex-col items-start gap-1 rounded-2xl bg-ink/60 px-3 py-1.5 text-start text-[11px] text-ink-foreground backdrop-blur"
              >
                <span className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", stats.faceFound ? "bg-success" : "bg-gold animate-pulse")} />
                  {stats.faceFound ? "تم رصد الوجه" : "مش شايفين وشّك — قرّب وخلّي الإضاءة كويسة"}
                </span>
                {showDebug && (
                  <span dir="ltr" className="font-mono text-[10px] leading-4 text-ink-muted">
                    {stats.delegate} · {stats.videoW}×{stats.videoH} · {stats.fps}fps · lm {stats.landmarks}
                    {stats.lastError ? ` · err: ${stats.lastError}` : ""}
                  </span>
                )}
              </button>
            </>
          )}
        </div>

        {live && (
          <div className="flex items-center justify-between gap-2 border-t border-ink-foreground/10 p-3">
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
                {f.image_url ? (
                  <img src={f.image_url} alt="" loading="lazy" className="h-8 w-12 shrink-0 object-contain" />
                ) : (
                  <span className="h-8 w-8 shrink-0 rounded-lg border" style={{ backgroundColor: f.frame_color }} />
                )}
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
            <p className="mt-1 text-xs text-muted-foreground">نسبة الثقة: {Math.round(faceResult.confidence * 100)}%</p>
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={resetScan}>
              <RotateCcw className="h-3.5 w-3.5" /> أعِد التحليل
            </Button>
          </div>
        )}

        {activeFrame && (
          <div className="rounded-2xl border bg-card p-4 shadow-soft">
            <p className="font-medium">{activeFrame.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">جربها الآن بالكاميرا — حرّك رأسك وهيتبعك النظارة.</p>
          </div>
        )}
      </div>
    </div>
  );
}
