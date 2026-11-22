import { useState, useRef, useEffect } from "react";
import {
  Mic,
  Square,
  Upload,
  X,
  Loader2,
  AlertCircle,
  Check,
  RotateCcw,
} from "lucide-react";
import type {
  DreamEntry,
  ImageAspectRatio,
  ImageResolution,
  LucidDreamData,
  WakingMoodData,
} from "../types/dream";
import {
  generateDreamArtwork,
  interpretDreamTranscript,
  transcribeDreamAudio,
} from "../services/dreamApi";
import { normalizeTag } from "../services/dreamStorage";
import { TagManager } from "./TagManager";
import { MoodCheckInEditor } from "./MoodCheckInEditor";
import { createEmptyLucidData, LucidDetailsEditor } from "./LucidDetailsEditor";

interface DreamCaptureModalProps {
  isOpen: boolean;
  nextEntryNumber: number;
  allJournalTags: string[];
  onClose: () => void;
  onDreamCreated: (dream: DreamEntry) => void;
}

type CaptureTab = "voice" | "write";
type PipelineStep = "idle" | "transcribing" | "interpreting" | "painting" | "checkin";

const RESOLUTIONS: ImageResolution[] = ["1K", "2K", "4K"];
const ASPECT_RATIOS: ImageAspectRatio[] = ["16:9", "4:3", "1:1"];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to read audio recording."));
    reader.readAsDataURL(blob);
  });
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function DreamCaptureModal({
  isOpen,
  nextEntryNumber,
  allJournalTags,
  onClose,
  onDreamCreated,
}: DreamCaptureModalProps) {
  const [captureTab, setCaptureTab] = useState<CaptureTab>("voice");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [typedDream, setTypedDream] = useState("");
  const [initialTags, setInitialTags] = useState<string[]>([]);
  const [imageSize, setImageSize] = useState<ImageResolution>("1K");
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>("16:9");

  const [pipelineStep, setPipelineStep] = useState<PipelineStep>("idle");
  const [liveTranscriptPreview, setLiveTranscriptPreview] = useState<string | null>(null);
  const [pendingDream, setPendingDream] = useState<DreamEntry | null>(null);
  const [checkInMood, setCheckInMood] = useState<WakingMoodData | null>({
    mood: "Calm",
    rating: 3,
    note: "",
    recordedAt: new Date().toISOString(),
  });
  const [markAsLucid, setMarkAsLucid] = useState(false);
  const [checkInLucid, setCheckInLucid] = useState<LucidDreamData>(
    createEmptyLucidData(true)
  );
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const cleanupRecordingResources = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      cleanupRecordingResources();
      setIsRecording(false);
    }
    return () => {
      cleanupRecordingResources();
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    };
  }, [audioPreviewUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pipelineStep === "idle") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, pipelineStep, onClose]);

  if (!isOpen) return null;

  const drawWaveform = (analyser: AnalyserNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barCount = 44;
      const step = Math.max(1, Math.floor(bufferLength / barCount));
      const gap = 4;
      const barWidth = (width - gap * (barCount - 1)) / barCount;

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] ?? 0;
        const normalized = Math.max(0.08, value / 255);
        const barHeight = normalized * (height - 10);
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        ctx.fillStyle = value > 120 ? "#D4A359" : "#4E556B";
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
    };

    render();
  };

  const startRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(
        "Microphone recording is unavailable in this browser context. You can type your dream or upload an audio file instead."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];

      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg",
      ];
      const supportedMime =
        preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) || "";

      const recorder = supportedMime
        ? new MediaRecorder(stream, { mimeType: supportedMime })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalMime = recorder.mimeType || "audio/webm";
        const recordedBlob = new Blob(chunksRef.current, { type: finalMime });
        if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
        const url = URL.createObjectURL(recordedBlob);
        setAudioBlob(recordedBlob);
        setAudioPreviewUrl(url);
        setUploadedFileName(null);
        cleanupRecordingResources();
      };

      // Live audio waveform via Web Audio API
      try {
        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        drawWaveform(analyser);
      } catch {
        // Proceed with recording even if visualizer fails
      }

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);
      setAudioBlob(null);
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
        setAudioPreviewUrl(null);
      }

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      setError(
        "Microphone permission was declined or no microphone was found. Switch to Write / Upload to enter your dream or upload an audio file."
      );
      cleanupRecordingResources();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleFileUpload = (file: File | null) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("audio/")) {
      setError("Please select an audio file (.mp3, .wav, .webm, .m4a, or .ogg).");
      return;
    }
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioBlob(file);
    setAudioPreviewUrl(URL.createObjectURL(file));
    setUploadedFileName(file.name);
    setCaptureTab("voice");
  };

  const resetCaptureState = () => {
    cleanupRecordingResources();
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setIsRecording(false);
    setRecordingSeconds(0);
    setAudioBlob(null);
    setAudioPreviewUrl(null);
    setUploadedFileName(null);
    setTypedDream("");
    setInitialTags([]);
    setLiveTranscriptPreview(null);
    setPendingDream(null);
    setCheckInMood({
      mood: "Calm",
      rating: 3,
      note: "",
      recordedAt: new Date().toISOString(),
    });
    setMarkAsLucid(false);
    setCheckInLucid(createEmptyLucidData(true));
    setPipelineStep("idle");
    setError(null);
  };

  const handleFinalizeDream = (includeCheckIn: boolean) => {
    if (!pendingDream) return;
    const finalized: DreamEntry = {
      ...pendingDream,
      wakingMood:
        includeCheckIn && checkInMood
          ? {
              ...checkInMood,
              recordedAt: new Date().toISOString(),
            }
          : undefined,
      lucidity:
        includeCheckIn && markAsLucid
          ? {
              ...checkInLucid,
              isLucid: true,
            }
          : undefined,
    };
    onDreamCreated(finalized);
    resetCaptureState();
    onClose();
  };

  const handleProcessDream = async () => {
    if (pipelineStep !== "idle") return;
    setError(null);

    try {
      let transcriptText = typedDream.trim();

      // Step 1: Transcribe audio if recording or uploaded audio is active
      if (captureTab === "voice") {
        if (!audioBlob) {
          setError("Record your dream voice note first, or switch to Write / Upload.");
          return;
        }
        setPipelineStep("transcribing");
        const base64 = await blobToBase64(audioBlob);
        const { transcript } = await transcribeDreamAudio(
          base64,
          audioBlob.type || "audio/webm"
        );
        transcriptText = transcript.trim();
        setLiveTranscriptPreview(transcriptText);
      } else if (transcriptText.length < 10) {
        setError("Please describe your dream in at least a sentence or two.");
        return;
      }

      // Step 2: Structured Jungian psychological interpretation
      setPipelineStep("interpreting");
      const interpretation = await interpretDreamTranscript(transcriptText);

      // Step 3: Surrealist painting via gemini-3-pro-image-preview at user's chosen resolution
      setPipelineStep("painting");
      let generatedImageUrl: string | null = null;
      let resolvedSize: ImageResolution = imageSize;
      let resolvedAspect: ImageAspectRatio = aspectRatio;

      try {
        const imageResult = await generateDreamArtwork({
          imagePrompt: interpretation.imagePrompt,
          imageSize,
          aspectRatio,
        });
        generatedImageUrl = imageResult.imageDataUrl;
        resolvedSize = imageResult.imageSize;
        resolvedAspect = imageResult.aspectRatio;
      } catch (imageErr) {
        // Save the transcribed & interpreted dream even if artwork painting fails
        console.warn("Image generation step failed, saving dream without artwork:", imageErr);
      }

      const mergedTags = Array.from(
        new Set(
          [...initialTags, ...(interpretation.suggestedTags ?? [])]
            .map(normalizeTag)
            .filter(Boolean)
        )
      );

      const newDream: DreamEntry = {
        id: `dream-${Date.now()}`,
        entryNumber: nextEntryNumber,
        createdAt: new Date().toISOString(),
        recordedDurationSec: captureTab === "voice" && recordingSeconds > 0 ? recordingSeconds : undefined,
        title: interpretation.title,
        transcript: transcriptText,
        coreEmotionalTheme: interpretation.coreEmotionalTheme,
        emotionalTone: interpretation.emotionalTone ?? [],
        summary: interpretation.summary,
        imagePrompt: interpretation.imagePrompt,
        imageUrl: generatedImageUrl,
        imageResolution: resolvedSize,
        imageAspectRatio: resolvedAspect,
        archetypes: interpretation.archetypes ?? [],
        symbols: interpretation.symbols ?? [],
        tags: mergedTags,
        chatHistory: [],
      };

      setPendingDream(newDream);
      setCheckInMood({
        mood: "Calm",
        rating: 3,
        note: "",
        recordedAt: new Date().toISOString(),
      });
      setMarkAsLucid(false);
      setCheckInLucid(createEmptyLucidData(true));
      setPipelineStep("checkin");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while processing your dream."
      );
      setPipelineStep("idle");
    }
  };

  const isProcessing =
    pipelineStep === "transcribing" ||
    pipelineStep === "interpreting" ||
    pipelineStep === "painting";
  const isCheckIn = pipelineStep === "checkin" && Boolean(pendingDream);
  const canSubmit =
    pipelineStep === "idle" &&
    !isRecording &&
    ((captureTab === "voice" && Boolean(audioBlob)) ||
      (captureTab === "write" && typedDream.trim().length >= 10));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="capture-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#06070B]/85 p-4 backdrop-blur-md"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#242937] bg-[#0F1118] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 border-b border-[#202430] px-6 py-5">
          <div>
            <p className="font-mono text-xs tabular-nums text-[#83899B]">
              Entry {String(nextEntryNumber).padStart(3, "0")} ·{" "}
              {isCheckIn ? "Post-Interpretation Check-In" : "Morning Capture"}
            </p>
            <h2
              id="capture-modal-title"
              className="mt-0.5 font-editorial text-3xl font-medium text-[#F2F0EB]"
            >
              {isCheckIn ? "Waking Mood & Lucidity" : "Record a Fresh Dream"}
            </h2>
          </div>

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => {
              if (isCheckIn) {
                handleFinalizeDream(false);
              } else {
                onClose();
              }
            }}
            aria-label="Close capture studio"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#242936] text-[#9EA4B4] transition-colors hover:border-[#3A4154] hover:text-[#F2F0EB] disabled:opacity-40"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {isCheckIn && pendingDream ? (
            <div className="space-y-6">
              {/* Interpreted Dream Summary Strip */}
              <div className="flex items-center gap-4 rounded-xl border border-[#232836] bg-[#13161F] p-4">
                {pendingDream.imageUrl && (
                  <img
                    src={pendingDream.imageUrl}
                    alt={`Surrealist painting for ${pendingDream.title}`}
                    referrerPolicy="no-referrer"
                    className="h-16 w-24 shrink-0 rounded-lg border border-[#252A38] object-cover"
                  />
                )}
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[11px] font-medium text-[#D4A359]">
                    Dream interpreted & painted
                  </p>
                  <h3 className="truncate font-editorial text-2xl font-medium text-[#F2F0EB]">
                    {pendingDream.title}
                  </h3>
                  <p className="truncate text-xs text-[#959BAC]">
                    {pendingDream.coreEmotionalTheme}
                  </p>
                </div>
              </div>

              {/* Predefined Waking Mood & 1-5 Rating */}
              <MoodCheckInEditor
                value={checkInMood}
                onChange={setCheckInMood}
                compact
              />

              {/* Optional Lucid Dream Toggle */}
              <div className="space-y-4 border-t border-[#202430] pt-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-[#E6E3DC]">
                      Was this a lucid dream?
                    </p>
                    <p className="text-[11px] text-[#83899B]">
                      Mark if you became aware you were dreaming and log your intentions.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={markAsLucid}
                    onClick={() => setMarkAsLucid((prev) => !prev)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      markAsLucid
                        ? "border-[#D4A359] bg-[#D4A359]/15 text-[#F2E0C1]"
                        : "border-[#282D3B] bg-[#141720] text-[#959BAC] hover:text-[#F2F0EB]"
                    }`}
                  >
                    {markAsLucid ? "Marked Lucid" : "Mark Lucid"}
                  </button>
                </div>

                {markAsLucid && (
                  <div className="rounded-xl border border-[#222634] bg-[#11141B] p-4">
                    <LucidDetailsEditor
                      value={checkInLucid}
                      onChange={setCheckInLucid}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : isProcessing ? (
            /* Live Real Pipeline Progress */
            <div className="space-y-6 py-4">
              <div className="space-y-3">
                {[
                  {
                    id: "transcribing" as const,
                    label: "Transcribing voice recording",
                    detail: "Converting spoken imagery into text",
                    skipped: captureTab === "write",
                  },
                  {
                    id: "interpreting" as const,
                    label: "Analyzing Jungian archetypes & symbols",
                    detail: "Mapping core emotional theme and psychological motifs",
                    skipped: false,
                  },
                  {
                    id: "painting" as const,
                    label: `Painting surrealist theme (${imageSize})`,
                    detail: `Composing ${aspectRatio} surrealist canvas`,
                    skipped: false,
                  },
                ]
                  .filter((step) => !step.skipped)
                  .map((step) => {
                    const order: PipelineStep[] = ["transcribing", "interpreting", "painting"];
                    const currentIndex = order.indexOf(pipelineStep);
                    const stepIndex = order.indexOf(step.id);
                    const isDone = stepIndex < currentIndex;
                    const isCurrent = stepIndex === currentIndex;

                    return (
                      <div
                        key={step.id}
                        className={`flex items-start gap-3.5 rounded-xl border p-4 transition-colors ${
                          isCurrent
                            ? "border-[#D4A359]/60 bg-[#171923]"
                            : isDone
                              ? "border-[#232836] bg-[#12151D]"
                              : "border-[#1C202B] bg-[#0F1118] opacity-55"
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {isDone ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#D4A359]/20 text-[#D4A359]">
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            </span>
                          ) : isCurrent ? (
                            <Loader2
                              className="h-5 w-5 animate-spin text-[#D4A359]"
                              aria-hidden="true"
                            />
                          ) : (
                            <span className="inline-block h-5 w-5 rounded-full border border-[#32384A]" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#F2F0EB]">
                            {step.label}
                          </p>
                          <p className="mt-0.5 text-xs text-[#8D93A5]">{step.detail}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {liveTranscriptPreview && (
                <div className="rounded-xl border border-[#222634] bg-[#13161E] p-4 space-y-1.5">
                  <p className="text-xs font-medium text-[#8A90A2]">
                    Captured transcript
                  </p>
                  <p className="text-sm leading-relaxed text-[#D8D4CB] line-clamp-4">
                    “{liveTranscriptPreview}”
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Input Mode Switcher */}
              <div className="flex items-center justify-between gap-4">
                <div
                  role="tablist"
                  aria-label="Dream capture method"
                  className="inline-flex rounded-lg border border-[#242936] bg-[#13161F] p-1"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={captureTab === "voice"}
                    onClick={() => setCaptureTab("voice")}
                    className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      captureTab === "voice"
                        ? "bg-[#232837] text-[#F2F0EB]"
                        : "text-[#8A90A2] hover:text-[#DFDCD4]"
                    }`}
                  >
                    Voice Recording
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={captureTab === "write"}
                    onClick={() => setCaptureTab("write")}
                    className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      captureTab === "write"
                        ? "bg-[#232837] text-[#F2F0EB]"
                        : "text-[#8A90A2] hover:text-[#DFDCD4]"
                    }`}
                  >
                    Write / Paste
                  </button>
                </div>

                {captureTab === "voice" && (
                  <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border border-[#252A38] px-3 py-1.5 text-xs text-[#9FA5B5] transition-colors hover:border-[#3A4154] hover:text-[#F2F0EB] whitespace-nowrap">
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Upload audio</span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => handleFileUpload(e.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>

              {captureTab === "voice" ? (
                <div className="rounded-xl border border-[#222634] bg-[#13161F] p-6 space-y-5">
                  {/* Live Waveform / Recorder Stage */}
                  <div className="flex flex-col items-center text-center space-y-4">
                    <canvas
                      ref={canvasRef}
                      width={480}
                      height={72}
                      className={`h-[72px] w-full max-w-md rounded-lg bg-[#0E1017] border border-[#1E222E] ${
                        isRecording ? "opacity-100" : "opacity-45"
                      }`}
                    />

                    <div className="flex items-center gap-3 font-mono text-2xl tabular-nums text-[#F2F0EB]">
                      {isRecording && (
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full bg-[#DC5A5A] animate-pulse"
                        />
                      )}
                      <span>{formatTimer(recordingSeconds)}</span>
                      {isRecording && (
                        <span className="font-sans text-xs font-medium text-[#E5989B]">
                          Recording
                        </span>
                      )}
                    </div>

                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={() => void startRecording()}
                        className="inline-flex min-h-[48px] items-center gap-2.5 rounded-xl bg-[#D4A359] px-6 py-3 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#DFB26E] whitespace-nowrap"
                      >
                        <Mic className="h-4 w-4" aria-hidden="true" />
                        <span>{audioBlob ? "Record Again" : "Start Voice Recording"}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="inline-flex min-h-[48px] items-center gap-2.5 rounded-xl border border-[#7A3030] bg-[#361618] px-6 py-3 text-sm font-semibold text-[#F8C9C6] transition-colors hover:bg-[#471D20] whitespace-nowrap"
                      >
                        <Square className="h-4 w-4 fill-current" aria-hidden="true" />
                        <span>Stop Recording</span>
                      </button>
                    )}

                    <p className="text-xs text-[#83899B] max-w-sm">
                      Speak freely while the imagery is fresh—include fragments, colors, emotions, and unexpected figures.
                    </p>
                  </div>

                  {audioPreviewUrl && !isRecording && (
                    <div className="border-t border-[#202430] pt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs text-[#9EA4B4]">
                        <span>
                          {uploadedFileName
                            ? `Uploaded: ${uploadedFileName}`
                            : "Recorded voice note ready for transcription"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
                            setAudioBlob(null);
                            setAudioPreviewUrl(null);
                            setUploadedFileName(null);
                            setRecordingSeconds(0);
                          }}
                          className="inline-flex items-center gap-1 text-[#8A90A2] hover:text-[#F2F0EB]"
                        >
                          <RotateCcw className="h-3 w-3" aria-hidden="true" />
                          <span>Discard</span>
                        </button>
                      </div>
                      <audio
                        controls
                        src={audioPreviewUrl}
                        className="h-10 w-full"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label
                    htmlFor="dream-text-input"
                    className="block text-xs font-medium text-[#959BAC]"
                  >
                    Describe your dream as vividly as you remember it
                  </label>
                  <textarea
                    id="dream-text-input"
                    rows={6}
                    value={typedDream}
                    onChange={(e) => setTypedDream(e.target.value)}
                    placeholder="I was walking along an empty wooden pier at dawn, carrying an old glass lantern that hummed whenever the tide pulled back..."
                    className="w-full rounded-xl border border-[#242937] bg-[#13161F] p-4 text-sm leading-relaxed text-[#F2F0EB] placeholder:text-[#616778] focus:border-[#D4A359]/70 focus:outline-none"
                  />
                </div>
              )}

              {/* Artwork Resolution (1K / 2K / 4K) & Aspect Ratio Configuration */}
              <div className="grid gap-4 rounded-xl border border-[#202430] bg-[#12151E] p-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <span className="block text-xs font-medium text-[#959BAC]">
                    Surrealist Artwork Resolution
                  </span>
                  <div
                    role="group"
                    aria-label="Select surrealist image size"
                    className="inline-flex rounded-lg border border-[#252A38] bg-[#0D0F15] p-1"
                  >
                    {RESOLUTIONS.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setImageSize(size)}
                        className={`rounded-md px-3.5 py-1.5 font-mono text-xs font-medium tabular-nums transition-colors whitespace-nowrap ${
                          imageSize === size
                            ? "bg-[#232837] text-[#E6C080]"
                            : "text-[#8A90A2] hover:text-[#DFDCD4]"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-medium text-[#959BAC]">
                    Canvas Aspect Ratio
                  </span>
                  <div
                    role="group"
                    aria-label="Select artwork aspect ratio"
                    className="inline-flex rounded-lg border border-[#252A38] bg-[#0D0F15] p-1"
                  >
                    {ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={`rounded-md px-3 py-1.5 font-mono text-xs font-medium tabular-nums transition-colors whitespace-nowrap ${
                          aspectRatio === ratio
                            ? "bg-[#232837] text-[#F2F0EB]"
                            : "text-[#8A90A2] hover:text-[#DFDCD4]"
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Optional Initial Tags */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-[#959BAC]">
                  Tags (optional — additional thematic tags will also be suggested automatically)
                </p>
                <TagManager
                  tags={initialTags}
                  allJournalTags={allJournalTags}
                  onChangeTags={setInitialTags}
                  compact
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-[#5B2A2A] bg-[#241416] px-4 py-3 text-xs text-[#F2B8B5]"
                >
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#DC5A5A]"
                    aria-hidden="true"
                  />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between gap-4 border-t border-[#202430] bg-[#0C0E14] px-6 py-4">
          {isCheckIn ? (
            <>
              <button
                type="button"
                onClick={() => handleFinalizeDream(false)}
                className="min-h-[40px] rounded-lg px-4 py-2 text-xs font-medium text-[#959BAC] transition-colors hover:text-[#F2F0EB] whitespace-nowrap"
              >
                Skip mood check-in
              </button>
              <button
                type="button"
                onClick={() => handleFinalizeDream(true)}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#D4A359] px-5 py-2 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#DFB26E] whitespace-nowrap"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                <span>Save Dream & Mood</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={isProcessing}
                onClick={onClose}
                className="min-h-[40px] rounded-lg px-4 py-2 text-xs font-medium text-[#959BAC] transition-colors hover:text-[#F2F0EB] disabled:opacity-40 whitespace-nowrap"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => void handleProcessDream()}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#D4A359] px-5 py-2 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#DFB26E] disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
              >
                {isProcessing && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                <span>
                  {captureTab === "voice"
                    ? "Transcribe, Interpret & Paint"
                    : "Interpret & Paint Dream"}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
