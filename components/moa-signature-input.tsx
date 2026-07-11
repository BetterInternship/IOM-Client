"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ImageUp, PenLine, Trash2, Type, UploadCloud } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { removeSignatureImageBackground } from "@/lib/signature-image-cleanup";

export type MoaSignatureMode = "type" | "upload" | "draw";

type MoaSignatureInputProps = {
  mode: MoaSignatureMode;
  onModeChange: (mode: MoaSignatureMode) => void;
  text: string;
  onTextChange: (text: string) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
};

const MAX_SIGNATURE_UPLOAD_BYTES = 10 * 1024 * 1024;

function dataUrlToFile(dataUrl: string, fileName: string) {
  const [header, data] = dataUrl.split(",");
  const mime = header?.match(/data:(.*?);base64/)?.[1] || "image/png";
  const binary = atob(data || "");
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], fileName, { type: mime });
}

export function MoaSignatureInput({
  mode,
  onModeChange,
  text,
  onTextChange,
  file,
  onFileChange,
}: MoaSignatureInputProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [isUploadDragging, setIsUploadDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const hasDrawnRef = useRef(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const clearSignatureImage = () => {
    onFileChange(null);
    setUploadError("");
    hasDrawnRef.current = false;
    clearCanvas();
  };

  const changeSignatureMode = (nextMode: MoaSignatureMode) => {
    if (nextMode === mode) return;
    onModeChange(nextMode);
    clearSignatureImage();
  };

  const handleUpload = async (nextFile: File | undefined) => {
    if (!nextFile) return;

    if (nextFile.type !== "image/png" && nextFile.type !== "image/jpeg") {
      setUploadError("Please upload a PNG or JPEG signature image.");
      return;
    }

    if (nextFile.size > MAX_SIGNATURE_UPLOAD_BYTES) {
      setUploadError("Signature image must be 10 MB or smaller.");
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === "string" ? resolve(reader.result) : reject(new Error());
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(nextFile);
      });
      const cleaned = await removeSignatureImageBackground(dataUrl);
      setUploadError("");
      onFileChange(dataUrlToFile(cleaned, "signature.png"));
      onModeChange("upload");
    } catch {
      setUploadError("Unable to process signature image.");
    }
  };

  const exportCanvasSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawnRef.current) return;

    const file = dataUrlToFile(canvas.toDataURL("image/png"), "signature.png");
    onFileChange(file);
  };

  const exportCanvasSignatureSoon = () => {
    window.requestAnimationFrame(exportCanvasSignature);
  };

  const getCanvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handleDrawStart = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const point = getCanvasPoint(event);
    if (!canvas || !ctx || !point) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;
    hasDrawnRef.current = true;
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    exportCanvasSignatureSoon();
  };

  const handleDrawMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const point = getCanvasPoint(event);
    if (!ctx || !point) return;

    hasDrawnRef.current = true;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    exportCanvasSignatureSoon();
  };

  const handleDrawEnd = (event?: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    exportCanvasSignature();
  };

  const signatureModeOptions = [
    { id: "type" as const, title: "Type", icon: Type },
    { id: "upload" as const, title: "Upload", icon: ImageUp },
    { id: "draw" as const, title: "Draw", icon: PenLine },
  ];

  return (
    <div className="space-y-2">
      <Label>Signature</Label>
      <div className="space-y-4 rounded-[0.33em] border border-gray-300 p-4 px-5">
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Signature method">
            {signatureModeOptions.map((option) => {
              const active = mode === option.id;
              const Icon = option.icon;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={cn(
                    "group focus-visible:ring-primary/35 flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-[0.33em] border px-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
                    active
                      ? "border-primary bg-primary/5 text-slate-950 hover:bg-primary/10"
                      : "border-slate-200 bg-white text-slate-700 hover:border-primary/45 hover:bg-primary/[0.03] hover:text-slate-950",
                  )}
                  onClick={() => changeSignatureMode(option.id)}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                      active ? "border-primary" : "border-slate-300 group-hover:border-primary/60",
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", active ? "bg-primary" : "bg-transparent")} />
                  </span>
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center transition-colors",
                      active ? "text-primary" : "text-slate-600 group-hover:text-primary",
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="truncate text-sm font-semibold text-slate-950">{option.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {mode === "type" && (
          <div className="space-y-2">
            <Input
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Type your signature"
              className="font-serif italic"
            />
            <p className="text-xs leading-relaxed text-slate-500">
              Your typed name will be used as your electronic signature.
            </p>
          </div>
        )}

        {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

        {mode === "upload" && (
          <div className="space-y-2">
            <label
              className={cn(
                "flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-[0.33em] border border-dashed p-3 text-center transition-colors",
                uploadError
                  ? "border-red-300 bg-red-50/60"
                  : isUploadDragging
                    ? "border-slate-900 bg-slate-100"
                    : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50",
              )}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsUploadDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsUploadDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsUploadDragging(false);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsUploadDragging(false);
                handleUpload(event.dataTransfer.files?.[0]);
              }}
            >
              {previewUrl ? (
                <>
                  <img src={previewUrl} alt="Uploaded signature" className="max-h-28 w-full object-contain" />
                  <span className="text-xs font-medium text-slate-500">{file?.name}</span>
                </>
              ) : (
                <>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                    <UploadCloud className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-sm font-medium text-slate-900">Choose a signature image</span>
                  <span className="text-xs text-slate-500">PNG or JPEG, 10 MB maximum</span>
                </>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(event) => {
                  handleUpload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            {file && (
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1.5 rounded-[0.33em] border border-red-200 bg-white px-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                onClick={clearSignatureImage}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear upload
              </button>
            )}
          </div>
        )}

        {mode === "draw" && (
          <div className="space-y-2">
            <canvas
              ref={canvasRef}
              width={720}
              height={220}
              className="h-36 w-full touch-none rounded-[0.33em] border border-slate-300 bg-white"
              onPointerDown={handleDrawStart}
              onPointerMove={handleDrawMove}
              onPointerUp={handleDrawEnd}
              onPointerLeave={handleDrawEnd}
              onPointerCancel={handleDrawEnd}
            />
            <button
              type="button"
              className="rounded-[0.33em] border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
              onClick={clearSignatureImage}
            >
              Clear drawing
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
