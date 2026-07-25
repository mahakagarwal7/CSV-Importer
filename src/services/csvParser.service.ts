import Papa from 'papaparse';

export interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
}

export const parseCsvFile = async (fileBuffer: Buffer): Promise<ParseResult> => {
  return new Promise((resolve, reject) => {
    const fileContent = fileBuffer.toString('utf-8');
    
    Papa.parse<Record<string, string>>(fileContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          // If there are strict parsing errors, we might want to reject, 
          // or just log them and continue with valid rows.
          // For simplicity, we'll continue but log.
          console.warn('CSV parsing generated some warnings/errors:', results.errors);
        }

        const headers = results.meta.fields || [];
        const rows = results.data;

        resolve({
          headers,
          rows,
          rowCount: rows.length,
        });
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
};
