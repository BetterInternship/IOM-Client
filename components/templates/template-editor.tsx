"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  usePdfDocumentFromFile,
  usePdfDocumentFromUrl,
} from "@betterinternship/core/pdf-viewer";
import {
  getAdminControllerListTemplatesQueryKey,
  useAdminControllerCreateTemplate,
  useAdminControllerPatchTemplate,
} from "@/app/api/app/api/endpoints/admin/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Minus,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { TemplatePdfPage } from "./template-pdf-page";
import {
  FIELD_BY_KEY,
  FIELD_GROUPS,
  fieldLabel,
  fromFieldSchema,
  newPlacementId,
  toFieldSchema,
  type AlignH,
  type AlignV,
  type Placement,
} from "./template-fields";

const MAX_PDF_BYTES = 2.5 * 1024 * 1024;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2;

export interface TemplateEditorInitial {
  name: string;
  description: string;
  term_months: number;
  field_schema: unknown;
  pdfUrl: string;
}

export interface TemplateEditorProps {
  mode: "new" | "edit";
  templateId?: string;
  initial?: TemplateEditorInitial;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

export function TemplateEditor({ mode, templateId, initial }: TemplateEditorProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const createTemplate = useAdminControllerCreateTemplate();
  const patchTemplate = useAdminControllerPatchTemplate();

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [termMonths, setTermMonths] = useState<number>(initial?.term_months ?? 12);
  const [placements, setPlacements] = useState<Placement[]>(() =>
    initial ? fromFieldSchema(initial.field_schema) : [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  // Load PDF: from the uploaded File (new) or via a same-origin proxy of the signed URL (edit).
  // The proxy avoids CORS: pdfjs uses fetch() which triggers preflight; GCS signed URLs have no
  // Access-Control-Allow-Origin header, so we proxy through Next.js server-side instead.
  const proxyUrl = mode === "edit" && initial?.pdfUrl
    ? `/gcs-proxy?url=${encodeURIComponent(initial.pdfUrl)}`
    : null;
  const fromFile = usePdfDocumentFromFile(mode === "new" ? file : null);
  const fromUrl = usePdfDocumentFromUrl(proxyUrl);
  const { pdfDoc, pageCount, isLoading, error } = mode === "new" ? fromFile : fromUrl;

  // Intrinsic page size (PDF points), captured from page 1 — stored as page_w/page_h.
  useEffect(() => {
    if (!pdfDoc) {
      setDims(null);
      return;
    }
    let cancelled = false;
    pdfDoc.getPage(1).then((pg) => {
      if (cancelled) return;
      const vp = pg.getViewport({ scale: 1 });
      setDims({ w: vp.width, h: vp.height });
    });
    return () => {
      cancelled = true;
    };
  }, [pdfDoc]);

  // Keep the current page in range when the document changes.
  useEffect(() => {
    if (pageCount > 0 && page > pageCount) setPage(1);
  }, [pageCount, page]);

  const selected = useMemo(
    () => placements.find((p) => p.id === selectedId) ?? null,
    [placements, selectedId],
  );

  const updatePlacement = (id: string, patch: Partial<Placement>) =>
    setPlacements((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const deletePlacement = (id: string) => {
    setPlacements((ps) => ps.filter((p) => p.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  };

  const handleDropField = (key: string, dropPage: number, xPt: number, yPt: number) => {
    const f = FIELD_BY_KEY[key];
    if (!f || !dims) return;
    const w = f.defaultW;
    const h = f.defaultH;
    const x = clamp(xPt - w / 2, 0, Math.max(0, dims.w - w));
    const y = clamp(yPt - h / 2, 0, Math.max(0, dims.h - h));
    const p: Placement = {
      id: newPlacementId(),
      field: key,
      type: f.type,
      page: dropPage,
      x,
      y,
      w,
      h,
      align_h: f.type === "signature" ? "center" : "left",
      align_v: f.type === "signature" ? "bottom" : "top",
    };
    setPlacements((ps) => [...ps, p]);
    setSelectedId(p.id);
  };

  // Delete-key removes the selected box (unless typing in a form field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement)?.isContentEditable) return;
      if (selectedId) {
        e.preventDefault();
        deletePlacement(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const onPickFile = (f: File | undefined) => {
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast.error("Please choose a PDF file");
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      toast.error("PDF is too large (max 2.5 MB)");
      return;
    }
    setPlacements([]);
    setSelectedId(null);
    setPage(1);
    setFile(f);
  };

  const save = useMutation({
    mutationFn: async () => {
      const fieldSchema = JSON.stringify(toFieldSchema(placements));
      if (mode === "new") {
        if (!file || !dims) throw new Error("Upload a template PDF first");
        return createTemplate.mutateAsync({
          data: {
            pdf: file,
            name: name.trim(),
            ...(description.trim() ? { description: description.trim() } : {}),
            term_months: termMonths,
            page_count: pageCount,
            page_w: Math.round(dims.w),
            page_h: Math.round(dims.h),
            field_schema: fieldSchema,
          },
        });
      }
      return patchTemplate.mutateAsync({
        templateId,
        data: {
          name: name.trim(),
          description: description.trim(),
          term_months: termMonths,
          field_schema: fieldSchema,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getAdminControllerListTemplatesQueryKey() });
      toast.success(mode === "new" ? "Template created" : "Template saved");
      router.push("/templates");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ready = !!pdfDoc && !!dims;
  const canSave =
    ready &&
    !!name.trim() &&
    Number.isFinite(termMonths) &&
    termMonths >= 1 &&
    !save.isPending &&
    !createTemplate.isPending &&
    !patchTemplate.isPending;

  return (
    <div className="flex flex-col gap-4 p-4 lg:flex-row">
      {/* ── PDF canvas ─────────────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        {/* toolbar */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/templates")}
            disabled={save.isPending}
          >
            <ChevronLeft /> Catalog
          </Button>
          {ready && (
            <>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft />
                </Button>
                <span className="text-muted-foreground min-w-[5rem] text-center text-xs">
                  Page {page} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page >= pageCount}
                >
                  <ChevronRight />
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScale((s) => clamp(Math.round((s - 0.1) * 10) / 10, MIN_SCALE, MAX_SCALE))}
                  disabled={scale <= MIN_SCALE}
                >
                  <Minus />
                </Button>
                <span className="text-muted-foreground w-10 text-center text-xs">
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScale((s) => clamp(Math.round((s + 0.1) * 10) / 10, MIN_SCALE, MAX_SCALE))}
                  disabled={scale >= MAX_SCALE}
                >
                  <Plus />
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="flex max-h-[calc(100vh-9rem)] min-h-[24rem] items-start justify-center overflow-auto rounded-[0.33em] border border-gray-300 bg-gray-100 p-6">
          {mode === "new" && !file ? (
            <UploadPrompt onPick={onPickFile} />
          ) : isLoading ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 self-center text-sm">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading PDF…
            </div>
          ) : error ? (
            <div className="text-destructive self-center text-sm">{error}</div>
          ) : pdfDoc && dims ? (
            <TemplatePdfPage
              pdf={pdfDoc}
              pageNumber={page}
              scale={scale}
              placements={placements}
              pageW={dims.w}
              pageH={dims.h}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDropField={handleDropField}
              onChange={updatePlacement}
            />
          ) : null}
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Drag a field from the palette onto the page. Drag a placed box to move it, or its corner
          to resize. Select a box and press Delete to remove it.
        </p>
      </div>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="w-full space-y-5 lg:w-80 lg:flex-shrink-0 lg:self-start">
        <section className="space-y-3 rounded-[0.33em] border border-gray-300 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Template details</h2>
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-name">Name</Label>
            <Input
              id="tmpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="CHED Standard MOA"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-desc">Description</Label>
            <Textarea
              id="tmpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes for universities"
              className="min-h-16 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-term">Term (months)</Label>
            <Input
              id="tmpl-term"
              type="number"
              min={1}
              value={termMonths}
              onChange={(e) => setTermMonths(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          {mode === "edit" && (
            <p className="text-muted-foreground text-xs">
              The PDF can’t be replaced when editing. To use a different file, create a new template.
            </p>
          )}
        </section>

        {/* Field palette */}
        <section className="space-y-3 rounded-[0.33em] border border-gray-300 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Fields</h2>
          <p className="text-muted-foreground text-xs">Drag onto the page to place.</p>
          {FIELD_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.fields.map((f) => (
                  <span
                    key={f.key}
                    draggable={ready}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("field", f.key);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className={
                      "cursor-grab rounded-[0.33em] border px-2 py-1 text-[11px] active:cursor-grabbing " +
                      (f.type === "signature"
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-gray-300 bg-gray-50 text-gray-700") +
                      (ready ? "" : " pointer-events-none opacity-50")
                    }
                    title={f.key}
                  >
                    {f.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Selected field properties */}
        {selected && (
          <section className="space-y-3 rounded-[0.33em] border border-gray-300 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{fieldLabel(selected.field)}</h2>
              <Button
                variant="ghost"
                size="sm"
                scheme="destructive"
                onClick={() => deletePlacement(selected.id)}
              >
                <Trash2 />
              </Button>
            </div>
            <p className="text-muted-foreground font-mono text-[11px]">{selected.field}</p>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Page</Label>
                <Select
                  value={String(selected.page)}
                  onValueChange={(v) => updatePlacement(selected.id, { page: parseInt(v, 10) })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Align</Label>
                <Select
                  value={selected.align_h}
                  onValueChange={(v) => updatePlacement(selected.id, { align_h: v as AlignH })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="X"
                value={selected.x}
                onChange={(n) => updatePlacement(selected.id, { x: n })}
              />
              <NumberField
                label="Y"
                value={selected.y}
                onChange={(n) => updatePlacement(selected.id, { y: n })}
              />
              <NumberField
                label="W"
                value={selected.w}
                onChange={(n) => updatePlacement(selected.id, { w: Math.max(4, n) })}
              />
              <NumberField
                label="H"
                value={selected.h}
                onChange={(n) => updatePlacement(selected.id, { h: Math.max(4, n) })}
              />
              <div className="space-y-1">
                <Label className="text-xs">Vertical</Label>
                <Select
                  value={selected.align_v}
                  onValueChange={(v) => updatePlacement(selected.id, { align_v: v as AlignV })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Top</SelectItem>
                    <SelectItem value="middle">Middle</SelectItem>
                    <SelectItem value="bottom">Bottom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>
        )}

        <Button className="w-full" disabled={!canSave} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          {mode === "new" ? "Create template" : "Save changes"}
        </Button>
        <p className="text-muted-foreground text-center text-xs">
          {placements.length} field{placements.length === 1 ? "" : "s"} placed
        </p>
      </aside>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        className="h-8"
        value={Math.round(value)}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </div>
  );
}

function UploadPrompt({ onPick }: { onPick: (f: File | undefined) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onPick(e.dataTransfer.files?.[0]);
      }}
      className={
        "flex h-full w-full max-w-md flex-col items-center justify-center gap-3 self-center rounded-[0.33em] border-2 border-dashed bg-white px-6 py-16 text-center " +
        (over ? "border-primary bg-primary/5" : "border-gray-300")
      }
    >
      <FileText className="text-muted-foreground h-8 w-8" />
      <div>
        <p className="text-sm font-medium text-gray-900">Upload a template PDF</p>
        <p className="text-muted-foreground mt-0.5 text-xs">Drag a file here, or browse. Max 2.5 MB.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <Upload /> Browse
      </Button>
    </div>
  );
}
