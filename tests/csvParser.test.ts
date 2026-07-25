import { describe, it, expect } from 'vitest';
import { parseCsvFile } from '../src/services/csvParser.service';

describe('CSV Parser Service', () => {
  it('should parse a simple valid CSV', async () => {
    const csvContent = 'Name,Email,Phone\nJohn,john@test.com,123\nJane,jane@test.com,456';
    const buffer = Buffer.from(csvContent, 'utf-8');

    const result = await parseCsvFile(buffer);

    expect(result.headers).toEqual(['Name', 'Email', 'Phone']);
    expect(result.rowCount).toBe(2);
    expect(result.rows[0]).toEqual({ Name: 'John', Email: 'john@test.com', Phone: '123' });
  });

  it('should handle empty lines and trim whitespace', async () => {
    const csvContent = ' Name , Email \n\n John , john@test.com ';
    const buffer = Buffer.from(csvContent, 'utf-8');

    const result = await parseCsvFile(buffer);

    expect(result.headers).toEqual(['Name', 'Email']);
    expect(result.rowCount).toBe(1);
    expect(result.rows[0]).toEqual({ Name: 'John', Email: 'john@test.com' });
  });
});
