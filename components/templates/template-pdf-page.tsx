"use client";

import { Fragment, useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { usePdfPageRenderer } from "@betterinternship/core/pdf-viewer";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fieldLabel,
  ptToPx,
  type Placement,
} from "./template-fields";

const MIN_PT = 12;

type Patch = Partial<Pick<Placement, "x" | "y" | "w" | "h">>;

interface DragState {
  id: string;
  mode: "move" | "resize";
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
}

export interface TemplatePdfPageProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  /** all placements; this component renders only those on `pageNumber` */
  placements: Placement[];
  /** intrinsic page size in PDF points, for clamping */
  pageW: number;
  pageH: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDropField: (fieldKey: string, page: number, xPt: number, yPt: number) => void;
  /** drop a whole signatory slot (array of field keys) at a point */
  onDropSlot?: (keys: string[], page: number, xPt: number, yPt: number) => void;
  onChange: (id: string, patch: Patch) => void;
  /** delete the given placement (triggered by the inline delete button) */
  onDelete: (id: string) => void;
}

export function TemplatePdfPage({
  pdf,
  pageNumber,
  scale,
  placements,
  pageW,
  pageH,
  selectedId,
  onSelect,
  onDropField,
  onDropSlot,
  onChange,
  onDelete,
}: TemplatePdfPageProps) {
  const { canvasRef, pageReady } = usePdfPageRenderer(pdf, pageNumber, scale);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const pagePlacements = placements.filter((p) => p.page === pageNumber);

  const clampX = (x: number, w: number) => Math.max(0, Math.min(x, Math.max(0, pageW - w)));
  const clampY = (y: number, h: number) => Math.max(0, Math.min(y, Math.max(0, pageH - h)));

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const key = e.dataTransfer.getData("field");
    const slot = e.dataTransfer.getData("slot");
    if (!key && !slot) return;
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xPt = (e.clientX - rect.left) / scale;
    const yPt = (e.clientY - rect.top) / scale;
    if (slot) {
      try {
        const keys = JSON.parse(slot);
        if (Array.isArray(keys) && keys.length) {
          onDropSlot?.(keys, pageNumber, xPt, yPt);
          return;
        }
      } catch {
        /* ignore malformed slot payload */
      }
    }
    onDropField(key, pageNumber, xPt, yPt);
  };

  const beginDrag = (
    e: React.PointerEvent<HTMLElement>,
    p: Placement,
    mode: DragState["mode"],
  ) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(p.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      id: p.id,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: p.x,
      startY: p.y,
      startW: p.w,
      startH: p.h,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dxPt = (e.clientX - d.startClientX) / scale;
    const dyPt = (e.clientY - d.startClientY) / scale;
    if (d.mode === "move") {
      onChange(d.id, {
        x: clampX(d.startX + dxPt, d.startW),
        y: clampY(d.startY + dyPt, d.startH),
      });
    } else {
      const w = Math.max(MIN_PT, Math.min(d.startW + dxPt, pageW - d.startX));
      const h = Math.max(MIN_PT, Math.min(d.startH + dyPt, pageH - d.startY));
      onChange(d.id, { w, h });
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (dragRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* capture may already be released */
      }
      dragRef.current = null;
    }
  };

  return (
    <div className="relative inline-block bg-white shadow-sm ring-1 ring-gray-200">
      <canvas ref={canvasRef} className="block" />

      <div
        ref={overlayRef}
        className="absolute inset-0"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onPointerDown={() => onSelect(null)}
      >
        {!pageReady && (
          <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-xs">
            Rendering page {pageNumber}…
          </div>
        )}

        {pagePlacements.map((p) => {
          const selected = p.id === selectedId;
          const isSig = p.type === "signature";
          const boxLeft = ptToPx(p.x, scale);
          const boxTop = ptToPx(p.y, scale);
          return (
            <Fragment key={p.id}>
              <div
                role="button"
                tabIndex={-1}
                onPointerDown={(e) => beginDrag(e, p, "move")}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className={cn(
                  "group absolute flex cursor-move items-center overflow-hidden rounded-[2px] border text-[9px] leading-none select-none",
                  isSig
                    ? "border-blue-400 bg-blue-500/15 text-blue-700"
                    : "border-primary/60 bg-primary/10 text-primary",
                  selected && "ring-primary ring-2 ring-offset-1",
                )}
                style={{
                  left: boxLeft,
                  top: boxTop,
                  width: ptToPx(p.w, scale),
                  height: ptToPx(p.h, scale),
                  justifyContent:
                    p.align_h === "center" ? "center" : p.align_h === "right" ? "flex-end" : "flex-start",
                }}
                title={p.field}
              >
                <span className="pointer-events-none truncate px-0.5">{fieldLabel(p.field)}</span>
                {/* resize handle */}
                <span
                  onPointerDown={(e) => beginDrag(e, p, "resize")}
                  onPointerMove={handlePointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  className={cn(
                    "absolute right-0 bottom-0 h-2 w-2 cursor-nwse-resize bg-white",
                    isSig ? "border border-blue-500" : "border-primary border",
                    selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                />
              </div>

              {/* floating toolbar on the selected box: field label + delete */}
              {selected && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute z-20 flex items-center rounded-[0.33em] border border-slate-200 bg-white shadow-md"
                  style={{
                    left: boxLeft,
                    top:
                      boxTop < 40
                        ? boxTop + ptToPx(p.h, scale) + 4
                        : boxTop - 34,
                  }}
                >
                  <span className="pointer-events-none max-w-40 truncate px-2 text-[10px] leading-none font-semibold text-slate-700">
                    {fieldLabel(p.field)}
                  </span>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(p.id);
                    }}
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-r-[0.33em] text-red-600 transition-colors hover:bg-red-50"
                    title="Delete field"
                    aria-label="Delete field"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
