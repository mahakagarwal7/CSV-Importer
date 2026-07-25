import crypto from 'crypto';

export type JobStatus = 'processing' | 'done' | 'failed';

export interface Job {
  id: string;
  status: JobStatus;
  totalRows: number;
  totalImported: number;
  totalSkipped: number;
  records: any[];
  skipped: any[];
  headers?: string[];
  rawRows?: Record<string, string>[];
  createdAt: string;
  error?: string;
}

// In-memory store for jobs
class JobStore {
  private jobs: Map<string, Job> = new Map();

  createJob(totalRows: number, headers?: string[], rawRows?: Record<string, string>[]): Job {
    const id = crypto.randomUUID();
    const job: Job = {
      id,
      status: 'processing',
      totalRows,
      totalImported: 0,
      totalSkipped: 0,
      records: [],
      skipped: [],
      headers,
      rawRows,
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
