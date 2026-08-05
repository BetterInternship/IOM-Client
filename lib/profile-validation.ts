import { z } from "zod";

const optionalUrl = z.string().trim().refine(
  (value) => !value || /^https?:\/\/[^\s]+$/i.test(value),
  "Enter a valid URL beginning with http:// or https://.",
);

const optionalPhone = z.string().trim().refine(
  (value) => !value || /^[+0-9()\s.-]{7,}$/.test(value),
  "Enter a valid phone number.",
);

export const companyProfileSchema = z.object({
  registered_name: z.string().trim().min(1, "Registered name is required."),
  registered_address: z.string().trim().min(1, "Registered address is required."),
  company_type: z.string().trim().min(1, "Company type is required."),
  description: z.string(),
  website: optionalUrl,
  phone: optionalPhone,
  industry: z.string(),
});

export const universityProfileSchema = z.object({
  registered_name: z.string().trim().min(1, "Registered name is required."),
  address: z.string().trim().min(1, "Address is required."),
  rep_name: z.string().trim().min(1, "Representative name is required."),
  rep_title: z.string().trim().min(1, "Representative title is required."),
  // Optional — whoever is actually sending mail from the account, distinct
  // from rep_name/rep_title (the MOA signatory). Used only to sign off the
  // manual invite email.
  account_holder_name: z.string().trim(),
  account_holder_title: z.string().trim(),
});

export type CompanyProfileDraft = z.infer<typeof companyProfileSchema>;
export type UniversityProfileDraft = z.infer<typeof universityProfileSchema>;
