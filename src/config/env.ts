import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GEMINI_API_KEY: z.string().min(1, 'Gemini API Key is required'),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
