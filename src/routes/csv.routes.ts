import { Router } from 'express';
import { upload } from '../middleware/uploadLimits';
import { parseCsv, importCsv, getJobStatus } from '../controllers/csv.controller';

const router = Router();

// Step 1: Parse CSV without AI
router.post('/parse', upload.single('file'), parseCsv);

// Step 2: Trigger AI import job
router.post('/import', importCsv);

// Step 3: Poll job status
router.get('/job/:jobId', getJobStatus);

export default router;
