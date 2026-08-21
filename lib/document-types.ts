/**
 * Mirrors Partners-Server's src/moa/required-documents.ts — kept in sync by
 * hand since the two apps don't share a lib for this (Docs/plans/
 * PARTNERS_COMPANY_REDESIGN_IMPLEMENTATION_PLAN.md §4).
 */
export const REQUIRED_DOCUMENT_TYPES = [
  "bir_2303",
  "sec_dti_registration",
  "mayor_permit",
] as const;

export type RequiredDocumentType = (typeof REQUIRED_DOCUMENT_TYPES)[number];

export const REQUIRED_DOCUMENT_LABELS: Record<RequiredDocumentType, string> = {
  bir_2303: "BIR Certificate of Registration (Form 2303)",
  sec_dti_registration: "SEC/DTI Registration Form",
  mayor_permit: "Mayor's Permit",
};

export const documentLabel = (type: string): string =>
  REQUIRED_DOCUMENT_LABELS[type as RequiredDocumentType] ?? type;
