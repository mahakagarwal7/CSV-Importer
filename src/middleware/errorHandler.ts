import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err }, err.message || 'An unexpected error occurred');

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: (err as any).errors || err.issues,
      },
    });
  }

  // Multer errors (e.g., file too large)
  if (err.name === 'MulterError') {
    return res.status(400).json({
      error: {
        code: 'FILE_UPLOAD_ERROR',
        message: err.message,
      },
    });
  }

  // Custom application errors (we could create a custom AppError class for these)
  if (err.status) {
    return res.status(err.status).json({
      error: {
        code: err.code || 'ERROR',
        message: err.message,
      },
    });
  }

  // Fallback 500 error
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  });
};
