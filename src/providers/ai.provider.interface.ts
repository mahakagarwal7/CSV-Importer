import { AIExtractionResponse } from '../schemas/crmRecord.schema';

export interface AIProvider {
  /**
   * Extracts CRM records from a batch of CSV rows.
   * @param headers The headers of the CSV file.
   * @param rows The batch of CSV rows (objects with header keys).
   * @returns A promise that resolves to the extracted CRM records (should match schema).
   */
  extractRecords(headers: string[], rows: Record<string, string>[]): Promise<AIExtractionResponse>;
}
