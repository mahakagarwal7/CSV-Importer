import { describe, it, expect } from 'vitest';
import { postProcessBatch } from '../src/services/postProcess.service';
import { CRMRecord } from '../src/schemas/crmRecord.schema';

describe('Post-Process Service', () => {
  it('should enforce enum strictness and fallback to empty string', () => {
    const originalRows = [{}];
    const aiRecords: CRMRecord[] = [{
      first_name: null,
      last_name: null,
      email: 'test@test.com',
      mobile_country_code: null,
      mobile_without_country_code: null,
      company_name: null,
      job_title: null,
      linkedin_profile_url: null,
      city: null,
      country: null,
      industry: null,
      crm_status: 'InvalidStatus' as any, // Simulate AI hallucination
      data_source: 'meridian_tower',
      created_at: null,
      crm_note: null,
    }];

    const result = postProcessBatch(originalRows, aiRecords);
    
    expect(result.validRecords).toHaveLength(1);
    expect(result.validRecords[0].crm_status).toBe('');
    expect(result.validRecords[0].data_source).toBe('meridian_tower');
  });

  it('should skip records with no email and no phone', () => {
    const originalRows = [{ name: 'ghost' }];
    const aiRecords: CRMRecord[] = [{
      first_name: 'Ghost',
      last_name: null,
      email: null,
      mobile_country_code: null,
      mobile_without_country_code: null, // Both missing
      company_name: null,
      job_title: null,
      linkedin_profile_url: null,
      city: null,
      country: null,
      industry: null,
      crm_status: null,
      data_source: null,
      created_at: null,
      crm_note: null,
    }];

    const result = postProcessBatch(originalRows, aiRecords);
    
    expect(result.validRecords).toHaveLength(0);
    expect(result.skippedRecords).toHaveLength(1);
    expect(result.skippedRecords[0].reason).toContain('No email or mobile found');
  });
});
