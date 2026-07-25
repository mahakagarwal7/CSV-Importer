import { GoogleGenAI, Type } from '@google/genai';
import { AIProvider } from './ai.provider.interface';
import { env } from '../config/env';
import { getSystemPrompt, getUserPrompt } from '../prompts/crmExtraction.prompt';
import { logger } from '../utils/logger';
import { AIExtractionResponse } from '../schemas/crmRecord.schema';

export class GeminiProvider implements AIProvider {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }

  async extractRecords(headers: string[], rows: Record<string, string>[]): Promise<AIExtractionResponse> {
    const systemPrompt = getSystemPrompt();
    const userPrompt = getUserPrompt(headers, rows);

    try {
      const response = await this.ai.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: [
          { role: 'user', parts: [{ text: userPrompt }] }
        ],
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              records: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    first_name: { type: Type.STRING, nullable: true },
                    last_name: { type: Type.STRING, nullable: true },
                    email: { type: Type.STRING, nullable: true },
                    mobile_country_code: { type: Type.STRING, nullable: true },
                    mobile_without_country_code: { type: Type.STRING, nullable: true },
                    company_name: { type: Type.STRING, nullable: true },
                    job_title: { type: Type.STRING, nullable: true },
                    linkedin_profile_url: { type: Type.STRING, nullable: true },
                    city: { type: Type.STRING, nullable: true },
                    country: { type: Type.STRING, nullable: true },
                    industry: { type: Type.STRING, nullable: true },
                    crm_status: { type: Type.STRING, nullable: true },
                    data_source: { type: Type.STRING, nullable: true },
                    created_at: { type: Type.STRING, nullable: true },
                    crm_note: { type: Type.STRING, nullable: true },
                  },
                },
              },
            },
            required: ['records'],
          },
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error('No text returned from Gemini API');
      }

      return JSON.parse(text) as AIExtractionResponse;
    } catch (error) {
      logger.error({ error }, 'Failed to extract records from Gemini');
      throw error;
    }
  }
}
