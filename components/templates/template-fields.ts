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

import {
  signerFieldKeys,
  MAX_COMPANY_SIGNATORIES,
  MAX_UNIVERSITY_SIGNATORIES,
} from "@betterinternship/core/partners/forms";

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
  /** when true, the editor offers an "Add complete slot" action that places every field in the group */
  slot?: boolean;
}

/** Top-level palette category rendered as a collapsible section. */
export interface CatalogCategory {
  label: string;
  groups: CatalogGroup[];
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

/** Builds one signatory/representative group: name, title, signature.
 *  `label` is the group header; `short` is the abbreviated chip prefix. */
const signerGroup = (
  label: string,
  short: string,
  nameKey: string,
  titleKey: string,
  sigKey: string,
): CatalogGroup => ({
  label,
  slot: true,
  fields: [
    { key: nameKey, label: `${short} name`, type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
    { key: titleKey, label: `${short} title`, type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
    { key: sigKey, label: `${short} signature`, type: "signature", defaultW: SIG_W, defaultH: SIG_H },
  ],
});

/** The palette groups for each signer slot, derived from the shared key contract. */
const COMPANY_SIGNER_GROUPS: CatalogGroup[] = Array.from(
  { length: MAX_COMPANY_SIGNATORIES },
  (_, i) =>
    signerGroup(
      `Company signatory ${i + 1}`,
      `CS ${i + 1}`,
      signerFieldKeys("company", i, "name")[0],
      signerFieldKeys("company", i, "title")[0],
      signerFieldKeys("company", i, "signature")[0],
    ),
);

const UNIVERSITY_SIGNER_GROUPS: CatalogGroup[] = Array.from(
  { length: MAX_UNIVERSITY_SIGNATORIES },
  (_, i) =>
    signerGroup(
      `University signatory ${i + 1}`,
      `US ${i + 1}`,
      signerFieldKeys("university", i, "name")[0],
      signerFieldKeys("university", i, "title")[0],
      signerFieldKeys("university", i, "signature")[0],
    ),
);

const COMPANY_DETAILS: CatalogGroup = {
  label: "Details",
  fields: [
    { key: "company_legal_name", label: "Legal name", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
    { key: "company_type", label: "Company type", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
    { key: "company_address", label: "Address", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
  ],
};

const UNIVERSITY_DETAILS: CatalogGroup = {
  label: "Details",
  fields: [
    { key: "university_name", label: "University name", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
    { key: "place", label: "Place (school address)", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
  ],
};

const DATES_GROUP: CatalogGroup = {
  label: "Dates",
  fields: [
    { key: "effective_date", label: "Effective date (full)", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
    { key: "day", label: "Day", type: "text", defaultW: SMALL_W, defaultH: TEXT_H },
    { key: "month", label: "Month", type: "text", defaultW: SMALL_W + 20, defaultH: TEXT_H },
    { key: "year", label: "Year", type: "text", defaultW: SMALL_W, defaultH: TEXT_H },
    { key: "expiry_date", label: "Expiry date (full)", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
  ],
};

/** Palette layout: collapsible categories, each containing field groups. */
export const FIELD_CATEGORIES: CatalogCategory[] = [
  {
    label: "Company",
    groups: [COMPANY_DETAILS, ...COMPANY_SIGNER_GROUPS],
  },
  {
    label: "University",
    groups: [UNIVERSITY_DETAILS, ...UNIVERSITY_SIGNER_GROUPS],
  },
  {
    label: "Others",
    groups: [DATES_GROUP],
  },
];

export const FIELD_GROUPS: CatalogGroup[] = FIELD_CATEGORIES.flatMap(
  (category) => category.groups,
);

/** Legacy company field keys that still appear on existing templates. Kept in
 *  FIELD_BY_KEY so they render with a proper label/type when loaded, but they are
 *  not offered in the palette. The server still resolves them for signatory 1.
 *  Derived from the shared key contract (`company_rep_*` = signer-1 aliases). */
const LEGACY_FIELDS: CatalogField[] = [
  { key: signerFieldKeys("company", 0, "name")[1], label: "Signatory 1 name", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
  { key: signerFieldKeys("company", 0, "title")[1], label: "Signatory 1 title", type: "text", defaultW: TEXT_W, defaultH: TEXT_H },
  { key: signerFieldKeys("company", 0, "signature")[1], label: "Signatory 1 signature", type: "signature", defaultW: SIG_W, defaultH: SIG_H },
];

export const FIELD_BY_KEY: Record<string, CatalogField> = Object.fromEntries(
  [...FIELD_GROUPS.flatMap((g) => g.fields), ...LEGACY_FIELDS].map((f) => [f.key, f]),
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
