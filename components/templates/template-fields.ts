// Fixed CHED merge-field catalog for the MOA template editor.
//
// These keys are the contract with IOM-Server's PDF generation
// (`moa-pdf.service.ts` baseValues + `03_PDF_GENERATION_AND_SIGNING.md` §3).
// The editor never offers free-form keys — only the fixed set below.
//
// Coordinates are stored as **real PDF points, top-left origin** — exactly how
// the PDF engine (`pdf-engine-server-v2/server.js`) interprets `field_schema`
// (it flips to PDF's bottom-left itself via `pageHeight - y - height`). So the
// editor simply captures `points = cssPixels / scale` and stores the page's
// intrinsic point size as `page_w` / `page_h`.

export type FieldType = "text" | "signature";
export type AlignH = "left" | "center" | "right";
export type AlignV = "top" | "middle" | "bottom";

export interface CatalogField {
  key: string;
  label: string;
  type: FieldType;
  /** default box size, in PDF points */
  defaultW: number;
  defaultH: number;
}

export interface CatalogGroup {
  label: string;
  fields: CatalogField[];
}

/** A placed field box in the editor. Coordinates are PDF points, top-left origin. */
export interface Placement {
  /** editor-local id (not persisted) */
  id: string;
  field: string;
  type: FieldType;
  page: number; // 1-based
  x: number;
  y: number;
  w: number;
  h: number;
  align_h: AlignH;
  align_v: AlignV;
}

/** The persisted shape (one entry of `moa_templates.field_schema`). */
export interface FieldSchemaEntry {
  field: string;
  type: FieldType;
  x: number;
  y: number;
  w: number;
  h: number;
  page: number;
  align_h: AlignH;
  align_v: AlignV;
}

const TEXT_W = 180;
const TEXT_H = 16;
const SMALL_W = 64;
const SIG_W = 150;
const SIG_H = 40;

export const FIELD_GROUPS: CatalogGroup[] = [
  {
    label: "Company",
    fields: [
      { key: "company_legal_name", label: "Legal name", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
      { key: "company_type", label: "Company type", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
      { key: "company_address", label: "Address", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
      { key: "company_rep_name", label: "Representative name", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
      { key: "company_rep_title", label: "Representative title", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
      { key: "company_rep_signature", label: "Representative signature", type: "signature", defaultW: SIG_W, defaultH: SIG_H },
    ],
  },
  {
    label: "University",
    fields: [
      {
        key: "university_name",
        label: "University name",
        type: "text",
        defaultW: TEXT_W,
        defaultH: TEXT_H,
      },
      { key: "university_signatory_name", label: "Signatory name", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
      { key: "university_signatory_title", label: "Signatory title", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
      { key: "university_signatory_signature", label: "Signatory signature", type: "signature", defaultW: SIG_W, defaultH: SIG_H },
      { key: "place", label: "Place (school address)", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
    ],
  },
  {
    label: "Dates",
    fields: [
      { key: "effective_date", label: "Effective date (full)", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
      { key: "day", label: "Day", type: "text", defaultW: SMALL_W, defaultH: TEXT_H },
      { key: "month", label: "Month", type: "text", defaultW: SMALL_W + 20, defaultH: TEXT_H },
      { key: "year", label: "Year", type: "text", defaultW: SMALL_W, defaultH: TEXT_H },
      { key: "expiry_date", label: "Expiry date (full)", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
    ],
  },
];

export const FIELD_BY_KEY: Record<string, CatalogField> = Object.fromEntries(
  FIELD_GROUPS.flatMap((g) => g.fields).map((f) => [f.key, f]),
);

export function fieldLabel(key: string): string {
  return FIELD_BY_KEY[key]?.label ?? key;
}

let idCounter = 0;
export function newPlacementId(): string {
  idCounter += 1;
  return `p${Date.now().toString(36)}_${idCounter}`;
}

// ── coordinate conversion (css px relative to page top-left ↔ PDF points) ──────
export const pxToPt = (px: number, scale: number) => px / scale;
export const ptToPx = (pt: number, scale: number) => pt * scale;

// ── (de)serialization between editor Placements and persisted field_schema ─────
export function toFieldSchema(placements: Placement[]): FieldSchemaEntry[] {
  return placements.map(({ field, type, x, y, w, h, page, align_h, align_v }) => ({
    field,
    type,
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    w: Math.round(w * 100) / 100,
    h: Math.round(h * 100) / 100,
    page,
    align_h,
    align_v,
  }));
}

export function fromFieldSchema(raw: unknown): Placement[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => {
      const key = String(e.field ?? "");
      const known = FIELD_BY_KEY[key];
      return {
        id: newPlacementId(),
        field: key,
        type: (known?.type ?? (e.type === "signature" ? "signature" : "text")) as FieldType,
        page: Number(e.page) || 1,
        x: Number(e.x) || 0,
        y: Number(e.y) || 0,
        w: Number(e.w) || TEXT_W,
        h: Number(e.h) || TEXT_H,
        align_h: (["left", "center", "right"].includes(String(e.align_h)) ? e.align_h : "left") as AlignH,
        align_v: (["top", "middle", "bottom"].includes(String(e.align_v)) ? e.align_v : "top") as AlignV,
      };
    });
}
