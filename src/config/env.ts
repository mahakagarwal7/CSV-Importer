import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.string().default('production'),
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables during runtime evaluation:', parsedEnv.error.format());
}

export const env = parsedEnv.success ? parsedEnv.data : {
  PORT: process.env.PORT || '3000',
  NODE_ENV: process.env.NODE_ENV || 'production',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
};
