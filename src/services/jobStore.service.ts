import { v4 as uuidv4 } from 'uuid';

export type JobStatus = 'processing' | 'done' | 'failed';

export interface Job {
  id: string;
  status: JobStatus;
  totalRows: number;
  totalImported: number;
  totalSkipped: number;
  records: any[];
  skipped: any[];
  createdAt: string;
  error?: string;
}

// In-memory store for jobs
class JobStore {
  private jobs: Map<string, Job> = new Map();

  createJob(totalRows: number): Job {
    const id = uuidv4();
    const job: Job = {
      id,
      status: 'processing',
      totalRows,
      totalImported: 0,
      totalSkipped: 0,
      records: [],
      skipped: [],
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(id, job);
    return job;
  }

  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  updateJob(id: string, updates: Partial<Job>): void {
    const job = this.jobs.get(id);
    if (job) {
      this.jobs.set(id, { ...job, ...updates });
    }
  }
}

export const jobStore = new JobStore();
