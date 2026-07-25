import pLimit from 'p-limit';
import { AIProvider } from '../providers/ai.provider.interface';
import { chunkArray } from './batching.service';
import { withRetry } from '../utils/retry';
import { postProcessBatch, PostProcessResult } from './postProcess.service';
import { logger } from '../utils/logger';

const BATCH_SIZE = 25; // As per spec: ~20-30 rows per AI call
const CONCURRENCY_LIMIT = 5; // Parallel API calls

export interface ExtractionResult {
  validRecords: any[];
  skippedRecords: any[];
}

export class AIExtractionService {
  private limit = pLimit(CONCURRENCY_LIMIT);

  constructor(private aiProvider: AIProvider) {}

  async processCsvData(
    headers: string[],
    rows: Record<string, string>[]
  ): Promise<ExtractionResult> {
    const batches = chunkArray(rows, BATCH_SIZE);
    logger.info(`Processing ${rows.length} rows in ${batches.length} batches.`);

    const batchPromises = batches.map((batch, index) =>
      this.limit(() => this.processBatch(headers, batch, index))
    );

    const batchResults = await Promise.all(batchPromises);

    const finalResult: ExtractionResult = {
      validRecords: [],
      skippedRecords: [],
    };

    for (const res of batchResults) {
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
          maxRetries: 3,
          initialDelayMs: 1000,
          onRetry: (err, attempt) => {
            logger.warn(`Batch ${batchIndex + 1} AI call failed (attempt ${attempt}): ${err.message}`);
          }
        }
      );

      // 2. Post-process and validate
      const processed = postProcessBatch(batchRows, aiResponse.records);
      logger.debug(`Batch ${batchIndex + 1} finished: ${processed.validRecords.length} valid, ${processed.skippedRecords.length} skipped.`);
      
      return processed;

    } catch (error: any) {
      logger.error(`Batch ${batchIndex + 1} permanently failed: ${error.message}`);
      
      // If the whole batch fails permanently, mark all rows as skipped
      return {
        validRecords: [],
        skippedRecords: batchRows.map(row => ({
          row,
          reason: 'AI processing failed for this batch',
        }))
      };
    }
  }
}
