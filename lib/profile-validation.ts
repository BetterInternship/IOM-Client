import { z } from "zod";
import { MAX_UNIVERSITY_SIGNATORIES } from "@betterinternship/core/partners/forms";

export const MIN_SIGNATORIES = 2;
export const MAX_SIGNATORIES = MAX_UNIVERSITY_SIGNATORIES;

const signatoryEntrySchema = z.object({
  id: z.string().uuid("Each signatory needs a valid UUID."),
  name: z.string().trim().min(1, "Signatory name is required."),
  title: z.string().trim().min(1, "Signatory title is required."),
  signatureUrl: z.string().optional(),
  signatureText: z.string().optional(),
  signatureType: z.enum(["text", "image"]).optional(),
  email: z
    .string()
    .trim()
    .refine(
      (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Enter a valid email address.",
    )
    .optional(),
});

export const universityProfileSchema = z.object({
  registered_name: z.string().trim().min(1, "Registered name is required."),
  address: z.string().trim().min(1, "Address is required."),
  signatories: z
    .array(signatoryEntrySchema)
    .min(
      MIN_SIGNATORIES,
      `At least ${MIN_SIGNATORIES} signatories are required.`,
    )
    .max(MAX_SIGNATORIES, `At most ${MAX_SIGNATORIES} signatories are allowed.`)
    .superRefine((list, ctx) => {
      const seen = new Set<string>();
      list.forEach((entry, index) => {
        if (seen.has(entry.id)) {
          ctx.addIssue({
            code: "custom",
            path: [index, "id"],
            message: "Signatory IDs must be unique.",
          });
        }
        seen.add(entry.id);
      });
    }),
  // Optional — whoever is actually sending mail from the account, distinct
  // from the MOA signatories (which live in the `signatories` array). Used only
  // to sign off the manual invite email.
  account_holder_name: z.string().trim().optional(),
  account_holder_title: z.string().trim().optional(),
});

/**
 * Completeness predicate shared by the university profile provider and the
 * profile/setup UI: 2-5 signatories, each with an id, nonblank name/title, and
 * a signature (image URL or typed text). Live form editing may still accept
 * pending uploads (see the setup page's `signatoriesComplete`), but this is the
 * persisted-data gate.
 */
export function universitySignatoriesComplete(
  signatories:
    | {
        id?: string;
        name?: string;
        title?: string;
        signatureUrl?: string;
        signatureText?: string;
        email?: string;
      }[]
    | null
    | undefined,
): boolean {
  const list = Array.isArray(signatories) ? signatories : [];
  return (
    list.length >= MIN_SIGNATORIES &&
    list.length <= MAX_SIGNATORIES &&
    list.every(
      (s) =>
        !!s &&
        !!s.id &&
        !!s.name?.trim() &&
        !!s.title?.trim() &&
        (!!s.signatureUrl?.trim() || !!s.signatureText?.trim()),
    )
  );
}

export type UniversityProfileDraft = z.infer<typeof universityProfileSchema>;
export type UniversitySignatoryDraft = z.infer<typeof signatoryEntrySchema>;
