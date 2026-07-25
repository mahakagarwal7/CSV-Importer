import { z } from 'zod';

export const crmStatusEnum = z.enum(['Won', 'Lost', 'In Progress', 'Unassigned', '']);
export const dataSourceEnum = z.enum(['Facebook', 'Google', 'Website', 'Referral', 'Organic', '']);

export const crmRecordSchema = z.object({
  first_name: z.string().nullable().default(null),
  last_name: z.string().nullable().default(null),
  email: z.string().email().nullable().default(null),
  mobile_country_code: z.string().nullable().default(null),
  mobile_without_country_code: z.string().nullable().default(null),
  company_name: z.string().nullable().default(null),
  job_title: z.string().nullable().default(null),
  linkedin_profile_url: z.string().url().nullable().default(null),
  city: z.string().nullable().default(null),
  country: z.string().nullable().default(null),
  industry: z.string().nullable().default(null),
  crm_status: z.string().nullable().default(null),
  data_source: z.string().nullable().default(null),
  created_at: z.string().nullable().default(null), // Will be validated as Date in post-processing
  crm_note: z.string().nullable().default(null),
});

export type CRMRecord = z.infer<typeof crmRecordSchema>;

export const aiExtractionResponseSchema = z.object({
  records: z.array(crmRecordSchema),
});

export type AIExtractionResponse = z.infer<typeof aiExtractionResponseSchema>;
