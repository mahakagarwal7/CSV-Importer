import { AIProvider } from '../providers/ai.provider.interface';
import { chunkArray } from './batching.service';
import { withRetry } from '../utils/retry';
import { postProcessBatch, PostProcessResult } from './postProcess.service';
import { logger } from '../utils/logger';

const BATCH_SIZE = 25; // ~20-30 rows per AI call

export interface ExtractionResult {
  validRecords: any[];
  skippedRecords: any[];
}

export class AIExtractionService {
  constructor(private aiProvider: AIProvider) {}

  async processCsvData(
    headers: string[],
    rows: Record<string, string>[]
  ): Promise<ExtractionResult> {
    const batches = chunkArray(rows, BATCH_SIZE);
    logger.info(`Processing ${rows.length} rows in ${batches.length} batches.`);

    const finalResult: ExtractionResult = {
      validRecords: [],
      skippedRecords: [],
    };

    // Sequential native async execution to preserve Free Tier quota limits without reliance on pure ESM third-party queue libraries (p-limit)
    for (let index = 0; index < batches.length; index++) {
      const batch = batches[index];
      // Polite 500ms inter-batch throttle to avoid HTTP 429 quota exceedance
      if (index > 0) await new Promise(r => setTimeout(r, 500));
      
      const res = await this.processBatch(headers, batch, index);
      finalResult.validRecords.push(...res.validRecords);
      finalResult.skippedRecords.push(...res.skippedRecords);
    }

    return finalResult;
  }

  private async processBatch(
    headers: string[],
    batchRows: Record<string, string>[],
    batchIndex: number
  ): Promise<PostProcessResult> {
    logger.debug(`Starting batch ${batchIndex + 1}`);

    try {
      // 1. Call AI with retry
      const aiResponse = await withRetry(
        () => this.aiProvider.extractRecords(headers, batchRows),
        {
          maxRetries: 6,
          initialDelayMs: 2000,
          onRetry: (err, attempt) => {
            logger.warn(`Batch ${batchIndex + 1} AI call failed (attempt ${attempt}): ${err.message || 'Rate Limit / Network Transient'}`);
          }
        }
      );

      // 2. Post-process and validate
      const processed = postProcessBatch(batchRows, aiResponse.records);
      logger.debug(`Batch ${batchIndex + 1} finished: ${processed.validRecords.length} valid, ${processed.skippedRecords.length} skipped.`);
      
      return processed;

    } catch (error: any) {
      const errorMsg = error?.message || String(error) || 'Unknown AI Provider error';
      logger.error(`Batch ${batchIndex + 1} permanently failed: ${errorMsg}`);
      
      // If the whole batch fails permanently, mark all rows as skipped
      return {
        validRecords: [],
        skippedRecords: batchRows.map(row => ({
          row,
          reason: `AI processing failed: ${errorMsg}`,
        }))
      };
    }
  }
}
