# GrowEasy CSV Importer Backend

This is a robust Node.js/Express backend that accepts any CSV file, parses it into raw rows, sends the rows to an LLM (Gemini) in batches to intelligently map them to the GrowEasy fixed CRM schema, validates the output, and returns structured JSON with successful and skipped records.

## Features

- **Robust CSV Parsing:** Handles messy CSV files without assuming specific header names.
- **Smart AI Extraction:** Uses Google's Gemini 2.5 Pro to map arbitrary headers to the CRM schema using a strictly defined prompt.
- **Batch Processing with Concurrency:** Sends rows in chunks to avoid context limits and uses parallel concurrent requests (`p-limit`) to speed up execution.
- **Resilience:** Implements a retry utility with exponential backoff to handle transient AI errors.
- **Strong Validation:** Enforces data integrity using Zod schemas for both incoming data and AI output, ensuring strict enums and types are adhered to.
- **Asynchronous Jobs:** Exposes polling endpoints to track the status of large CSV imports over time.

## Architecture & Flow

1. **Upload & Parse (`POST /api/csv/parse`):** User uploads a CSV file. It's held in memory (`multer`), parsed quickly into JSON (`papaparse`), and returned to the client as a preview.
2. **Confirm & Import (`POST /api/csv/import`):** User confirms the data. The backend creates an in-memory "Job" and immediately returns the `jobId`.
3. **Background Processing:** The backend splits the rows into batches (~25 rows/batch), limits concurrency to 5 parallel calls, and queries the AI Provider.
4. **Validation & Post-Processing:** As each batch returns, it's checked against Zod schemas. Business rules are applied (e.g., stripping invalid enums, date standardizing, enforcing the "no email AND no phone = skip" rule).
5. **Polling (`GET /api/csv/job/:jobId`):** The client continuously polls to see if the job is `processing`, `done`, or `failed`, getting the final records and skipped rows.

## Setup Instructions

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Copy the example file and populate it:
   ```bash
   cp .env.example .env
   ```
   Add your Gemini API Key in the `.env` file.

3. **Run Development Server:**
   ```bash
   npm run dev
   ```

4. **Run Tests:**
   ```bash
   npm run test
   ```

## AI Prompt Engineering Rationale

The heart of this application relies on the system prompt provided to the LLM. 
- **Few-Shot Prompting:** The prompt includes one clean example and one messy example to demonstrate exactly how the AI should handle edge cases (like multiple emails).
- **Strict Enums Instruction:** The AI is explicitly instructed that for `crm_status` and `data_source`, it must ONLY output one of the exact string options, or `null`. It must not hallucinate statuses.
- **JSON Structure Enforcement:** The model is constrained by an exact JSON Schema using `@google/genai`'s Structured Output functionality, guaranteeing that it responds with the exact structure we need (`{ records: [ ... ] }`).
- **Post-Processing Defense in Depth:** We do not blindly trust the LLM. Every field is verified by Zod, and core deterministic logic (like skipping records missing both phone and email) is run natively in the Node backend on top of the AI's results.

## Deployment

A `Dockerfile` and `docker-compose.yml` are included for immediate production deployment.

```bash
docker-compose up --build -d
```
