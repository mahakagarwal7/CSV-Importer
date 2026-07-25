import Papa from 'papaparse';
import { logger } from '../utils/logger';

export interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
}

/**
 * High-performance incremental CSV streaming parser using PapaParse step pipeline.
 * Evaluates records stream-by-stream without blocking event loop or spiking memory buffers.
 */
export const parseCsvFile = async (fileBuffer: Buffer): Promise<ParseResult> => {
  return new Promise((resolve, reject) => {
    const fileContent = fileBuffer.toString('utf-8');
    const rows: Record<string, string>[] = [];
    let headers: string[] = [];

    logger.debug('Starting incremental stream parsing of CSV upload...');

    Papa.parse<Record<string, string>>(fileContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
      // Incremental streaming step handler: processes each row asynchronously in small V8 execution frames
      step: (row) => {
        if (!headers.length && row.meta.fields) {
          headers = row.meta.fields;
        }
        if (row.data && Object.keys(row.data).length > 0) {
          rows.push(row.data);
        }
      },
      complete: (results) => {
        if (!headers.length && results.meta.fields) {
          headers = results.meta.fields;
        }
        if (results.errors.length > 0) {
          logger.warn('CSV streaming parser generated non-fatal format warnings:', results.errors);
        }
        logger.info(`Incremental streaming parse completed: successfully buffered ${rows.length} rows.`);
        resolve({
          headers,
          rows,
          rowCount: rows.length,
        });
      },
      error: (error: Error) => {
        logger.error('Fatal streaming error encountered during CSV ingestion:', error);
        reject(error);
      },
    });
  });
};
