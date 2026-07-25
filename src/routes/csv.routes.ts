import { Router } from 'express';
import { upload } from '../middleware/uploadLimits';
import { parseCsv, importCsv, getJobStatus, retryFailedJob } from '../controllers/csv.controller';

const router = Router();

// Step 1: Parse CSV without AI
router.post('/parse', upload.single('file'), parseCsv);

// Step 2: Trigger AI import job
router.post('/import', importCsv);

// Step 3: Poll job status
router.get('/job/:jobId', getJobStatus);

// Step 4: Retry only failed AI batches of an existing job (Bonus Endpoint)
router.post('/import/retry/:jobId', retryFailedJob);

export default router;
