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

    const modelsToTry = [
      env.GEMINI_MODEL,
      'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-3-flash-preview',
      'gemini-3.5-flash-lite',
      'gemini-pro-latest'
    ].filter((v, i, a) => v && a.indexOf(v) === i && !String(v).includes('1.5') && !String(v).includes('2.5') && !String(v).includes('2.0'));
    let lastError: any;

    for (let i = 0; i < modelsToTry.length; i++) {
      const modelName = modelsToTry[i];
      try {
        const response = await this.ai.models.generateContent({
          model: modelName,
          contents: [
            { role: 'user', parts: [{ text: userPrompt }] }
          ],
          config: {
            systemInstruction: systemPrompt,
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                records: {
                  type: Type.ARRAY,
                  description: 'Must contain exactly one mapped CRM lead record corresponding 1-to-1 to each input CSV row in identical sequence.',
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
      } catch (error: any) {
        lastError = error;
        // If this model encountered ANY error (rate limit, 404, quota, timeout) and we still have alternative standby models, rotate instantly!
        if (i < modelsToTry.length - 1) {
          logger.warn(`[Model Fallback Rotation] Model ${modelName} encountered an exception. Instantly rotating to standby endpoint ${modelsToTry[i+1]}...`);
          continue;
        }
        logger.error({ error: error.message || error, model: modelName }, `Failed to extract records from Gemini model ${modelName}`);
        throw error;
      }
    }

    throw lastError;
  }
}
