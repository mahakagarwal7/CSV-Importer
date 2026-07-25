import { Request, Response, NextFunction } from 'express';
import { parseCsvFile } from '../services/csvParser.service';
import { logger } from '../utils/logger';
import { AIExtractionService } from '../services/aiExtraction.service';
import { GeminiProvider } from '../providers/gemini.provider';
import { jobStore } from '../services/jobStore.service';

export const parseCsv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: { code: 'NO_FILE', message: 'No file uploaded' },
      });
    }

    logger.info(`Parsing uploaded file: ${req.file.originalname} (${req.file.size} bytes)`);

    const result = await parseCsvFile(req.file.buffer);

    res.json({
      headers: result.headers,
      rows: result.rows,
      rowCount: result.rowCount,
    });
  } catch (error) {
    next(error);
  }
};

export const importCsv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { headers, rows } = req.body;

    if (!headers || !Array.isArray(headers) || !rows || !Array.isArray(rows)) {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Expected headers and rows arrays in body' },
      });
    }

    if (rows.length === 0) {
      return res.status(400).json({
        error: { code: 'EMPTY_DATA', message: 'No rows to process' },
      });
    }

    // Initialize job with source data preserved for partial retry support
    const job = jobStore.createJob(rows.length, headers, rows);

    // Start background processing
    const provider = new GeminiProvider();
    const aiService = new AIExtractionService(provider);

    // In Vercel Serverless (ephemeral runtime), execute extraction synchronously before responding to prevent container background freezing
    if (process.env.VERCEL || process.env.SERVERLESS) {
      logger.info(`[Serverless Mode] Executing extraction synchronously for Job ${job.id}...`);
      const result = await aiService.processCsvData(headers, rows);
      const updatedJob = jobStore.updateJob(job.id, {
        status: 'done',
        records: result.validRecords,
        skipped: result.skippedRecords,
        totalImported: result.validRecords.length,
        totalSkipped: result.skippedRecords.length,
      });
      const completedJob = updatedJob || jobStore.getJob(job.id) || job;
      logger.info(`[Serverless Mode] Job ${job.id} completed synchronously.`);
      return res.status(200).json(completedJob);
    }

    aiService.processCsvData(headers, rows)
      .then((result) => {
        jobStore.updateJob(job.id, {
          status: 'done',
          records: result.validRecords,
          skipped: result.skippedRecords,
          totalImported: result.validRecords.length,
          totalSkipped: result.skippedRecords.length,
        });
        logger.info(`Job ${job.id} completed. ${result.validRecords.length} imported, ${result.skippedRecords.length} skipped.`);
      })
      .catch((error) => {
        logger.error(`Job ${job.id} failed: ${error.message}`);
        jobStore.updateJob(job.id, {
          status: 'failed',
          error: error.message,
        });
      });

    // Return jobId immediately for client to poll
    res.json({
      jobId: job.id,
      message: 'Import job started. Poll /api/csv/job/:jobId for status.',
    });
  } catch (error) {
    next(error);
  }
};

export const getJobStatus = (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = req.params.jobId as string;
    const job = jobStore.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        error: { code: 'JOB_NOT_FOUND', message: 'Job not found' },
      });
    }

    res.json(job);
  } catch (error) {
    next(error);
  }
};

export const retryFailedJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = req.params.jobId as string;
    const job = jobStore.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        error: { code: 'JOB_NOT_FOUND', message: 'Job not found' },
      });
    }

    // Isolate only the rows that skipped due to AI processing or rate-limit failures
    const retryableRows = (job.skipped || [])
      .filter(item => item && item.row && String(item.reason).toLowerCase().includes('ai'))
      .map(item => item.row);

    if (retryableRows.length === 0 || !job.headers) {
      return res.status(400).json({
        error: { code: 'NO_RETRY_ROWS', message: 'No AI-processing failed rows available to retry for this job' },
      });
    }

    logger.info(`Retrying ${retryableRows.length} failed rows for Job ${job.id}...`);

    // Mark job back to processing state
    const remainingSkipped = job.skipped.filter(item => !String(item.reason).toLowerCase().includes('ai'));
    jobStore.updateJob(job.id, { status: 'processing', skipped: remainingSkipped });

    const provider = new GeminiProvider();
    const aiService = new AIExtractionService(provider);

    aiService.processCsvData(job.headers, retryableRows)
      .then((result) => {
        const newValid = [...(job.records || []), ...result.validRecords];
        const newSkipped = [...remainingSkipped, ...result.skippedRecords];
        jobStore.updateJob(job.id, {
          status: 'done',
          records: newValid,
          skipped: newSkipped,
          totalImported: newValid.length,
          totalSkipped: newSkipped.length,
        });
        logger.info(`Retry completed for Job ${job.id}. Total Valid: ${newValid.length} | Total Skipped: ${newSkipped.length}`);
      })
      .catch((error) => {
        logger.error(`Retry execution failed for Job ${job.id}: ${error.message}`);
        jobStore.updateJob(job.id, { status: 'failed', error: error.message });
      });

    res.json({
      jobId: job.id,
      message: `Retrying ${retryableRows.length} failed AI rows in background. Poll /api/csv/job/${job.id} for updates.`,
    });
  } catch (error) {
    next(error);
  }
};
