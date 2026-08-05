import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .refine(
    (value) => !value || /^https?:\/\/[^\s]+$/i.test(value),
    "Enter a valid URL beginning with http:// or https://.",
  );

const optionalPhone = z
  .string()
  .trim()
  .refine(
    (value) => !value || /^[+0-9()\s.-]{7,}$/.test(value),
    "Enter a valid phone number.",
  );

export const companyProfileSchema = z.object({
  registered_name: z.string().trim().min(1, "Registered name is required."),
  registered_address: z
    .string()
    .trim()
    .min(1, "Registered address is required."),
  company_type: z.string().trim().min(1, "Company type is required."),
  description: z.string(),
  website: optionalUrl,
  phone: optionalPhone,
  industry: z.string(),
});

const signatoryEntrySchema = z.object({
  id: z.string().uuid("Each signatory needs a valid UUID."),
  name: z.string().trim().min(1, "Signatory name is required."),
  title: z.string().trim().min(1, "Signatory title is required."),
  signatureUrl: z.string().optional(),
});

export const universityProfileSchema = z.object({
  registered_name: z.string().trim().min(1, "Registered name is required."),
  address: z.string().trim().min(1, "Address is required."),
  signatories: z
    .array(signatoryEntrySchema)
    .min(2, "At least two signatories are required.")
    .max(5, "At most five signatories are allowed.")
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
});

export type CompanyProfileDraft = z.infer<typeof companyProfileSchema>;
export type UniversityProfileDraft = z.infer<typeof universityProfileSchema>;
export type UniversitySignatoryDraft = z.infer<typeof signatoryEntrySchema>;
