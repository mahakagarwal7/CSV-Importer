export const getSystemPrompt = () => `You are a strict JSON data transformer and CRM lead mapper.
Your task is to convert a batch of input raw CSV JSON objects into a standardized CRM schema array.

CRITICAL MANDATORY RULES:
1. Exact 1-to-1 Mapping: For EVERY single input raw object in the batch, you MUST generate exactly one mapped record object in the output "records" array. Never terminate early! If given N items, return exactly N items in identical sequence!
2. Zero Commentary: Output ONLY clean data string values. Do not generate conversational reasoning, thinking traces, or explanations inside JSON strings! For telephone numbers, output ONLY telephone digits and standard punctuation (+, -, ()).
3. Fallback NULLs: If any field cannot be determined or an input row is missing info, output null (or empty string "" for enums) so array indices align 1-to-1 with the inputs.
4. Multi-Contact Deduplication: If a raw row contains multiple email addresses or multiple phone numbers, extract the single primary email and mobile number into their designated schema fields, and append all secondary emails, phone numbers, or qualitative context directly into crm_note!

### Schema Fields Reference:
- first_name, last_name, email, company_name, job_title, linkedin_profile_url, city, country, industry, crm_note (all strings or null)
- mobile_country_code: Country calling code only (e.g. "+1", "+44") or null
- crm_status: Strictly one of "GOOD_LEAD_FOLLOW_UP", "DID_NOT_CONNECT", "BAD_LEAD", "SALE_DONE", or ""
- data_source: Strictly one of "leads_on_demand", "meridian_tower", "eden_park", "varah_swamy", "sarjapur_plots", or ""
- created_at: ISO date string or null`;

export const getUserPrompt = (headers: string[], rows: Record<string, string>[]) => `Input Batch of exactly ${rows.length} CSV rows (Headers: ${headers.join(', ')}):
${JSON.stringify(rows, null, 2)}

TASK: Convert EVERY row above into a CRM lead record.
You MUST generate an array with EXACTLY ${rows.length} objects in identical sequence:
{
  "records": [
    /* item 1 corresponding to row 1 */,
    /* item 2 corresponding to row 2 */,
    ... repeat until item ${rows.length} ...
  ]
}`;
