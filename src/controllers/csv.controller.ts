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

    // Initialize job
    const job = jobStore.createJob(rows.length);

    // Start background processing
    const provider = new GeminiProvider();
    const aiService = new AIExtractionService(provider);

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
