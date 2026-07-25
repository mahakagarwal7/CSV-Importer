import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import csvRoutes from './routes/csv.routes';

const app = express();

app.use(cors());
app.use(express.json());

// Routes will be added here
app.use('/api/csv', csvRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

export default app;
