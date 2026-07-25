import { CRMRecord, crmRecordSchema, crmStatusEnum, dataSourceEnum } from '../schemas/crmRecord.schema';
import { logger } from '../utils/logger';

export interface PostProcessResult {
  validRecords: CRMRecord[];
  skippedRecords: { row: Record<string, string>; reason: string }[];
}

export const postProcessBatch = (
  originalRows: Record<string, string>[],
  aiRecords: CRMRecord[]
): PostProcessResult => {
  const result: PostProcessResult = {
    validRecords: [],
    skippedRecords: [],
  };

  // Ensure AI returned exactly the same number of records as input rows
  if (originalRows.length !== aiRecords.length) {
    logger.warn('AI returned a different number of records than requested.');
    // If length mismatches, we can't reliably map them back. In a robust system,
    // we might need to fail the batch or try to map them by some ID.
    // For now, we'll try to process up to the minimum length.
  }

  const length = Math.min(originalRows.length, aiRecords.length);

  for (let i = 0; i < length; i++) {
    const originalRow = originalRows[i];
    let record = aiRecords[i];

    try {
      // 0. Pre-clean empty/invalid AI placeholders to null before schema parsing
      if (record && typeof record === 'object') {
        for (const key of Object.keys(record) as (keyof CRMRecord)[]) {
          const val = record[key];
          if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed === '' || /^n\/?a$/i.test(trimmed) || /^none$/i.test(trimmed) || /^null$/i.test(trimmed)) {
              (record as any)[key] = null;
            }
          }
        }
        // Pre-validate email format: if not a valid email structure, clear to null so Skip Logic handles it cleanly
        if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(record.email).trim())) {
          record.email = null;
        }
        // Pre-validate url format: if not valid URL, prepend https:// or set null
        if (record.linkedin_profile_url) {
          let url = String(record.linkedin_profile_url).trim();
          if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
          try {
            new URL(url);
            record.linkedin_profile_url = url;
          } catch {
            record.linkedin_profile_url = null;
          }
        }
      }

      // 1. Zod Validation (basic types)
      const parsed = crmRecordSchema.safeParse(record);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues ? parsed.error.issues.map(e => `${e.path.join('.') || 'field'}: ${e.message}`).join('; ') : parsed.error.message;
        result.skippedRecords.push({
          row: originalRow,
          reason: `Schema validation exception (${errorDetails})`,
        });
        continue;
      }

      record = parsed.data;

      // 2. Strict Enum Fallback
      if (!crmStatusEnum.safeParse(record.crm_status).success) {
        record.crm_status = '';
      }
      if (!dataSourceEnum.safeParse(record.data_source).success) {
        record.data_source = '';
      }

      // 3. Date Validation
      if (record.created_at) {
        const dateObj = new Date(record.created_at);
        if (isNaN(dateObj.getTime())) {
          // If totally invalid, clear it instead of skipping the whole record
          record.created_at = null;
        } else {
          // Standardize to ISO
          record.created_at = dateObj.toISOString();
        }
      }

      // 4. Strip Raw Newlines for CSV Safety
      for (const key of Object.keys(record) as (keyof CRMRecord)[]) {
        if (typeof record[key] === 'string') {
          record[key] = (record[key] as string).replace(/\r?\n|\r/g, ' ');
        }
      }

      // 4b. Defensive Phone Number Sanitization (removes any AI thinking notes or conversational strings)
      if (record.mobile_without_country_code) {
        // Strip conversational scratchpads or non-telephone text
        const rawPhone = record.mobile_without_country_code.replace(/(?:stone_|wait,|check_|cleaned).*$/i, '').trim();
        const phoneMatch = rawPhone.match(/[\d\-\(\)\s\.]{4,22}/);
        record.mobile_without_country_code = phoneMatch ? phoneMatch[0].trim() : null;
      }
      if (record.mobile_country_code) {
        const codeMatch = record.mobile_country_code.match(/\+\d{1,4}/);
        record.mobile_country_code = codeMatch ? codeMatch[0].trim() : null;
      }

      // 5. Skip Rule: No email AND no mobile (defense in depth against AI hallucination)
      if (!record.email && !record.mobile_without_country_code) {
        result.skippedRecords.push({
          row: originalRow,
          reason: 'No email or mobile found (Required by CRM ingestion rules: missing primary contact vectors)',
        });
        continue;
      }

      // If we reach here, it's valid!
      result.validRecords.push(record);

    } catch (error: any) {
      result.skippedRecords.push({
        row: originalRow,
        reason: `Unexpected error during post-processing: ${error.message}`,
      });
    }
  }

  // If there were extra original rows that didn't get an AI response
  for (let i = length; i < originalRows.length; i++) {
    result.skippedRecords.push({
      row: originalRows[i],
      reason: 'AI failed to return a corresponding record',
    });
  }

  return result;
};
