# Bruker Outreach Sequence Engine

## Overview
A two-step AI-powered scientific outreach sequence generator for Bruker Spatial Biology. Pastes a lead data row from Google Sheets, researches the company via Perplexity Sonar, generates a tailored 6-part outreach sequence via OpenAI GPT-5.2, then applies deterministic post-processing (link injection, availability insertion, asset selection and placement).

## Architecture
- **Frontend**: React + TypeScript with Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL via Drizzle ORM
- **AI Step 1**: Perplexity Sonar API (company research)
- **AI Step 2**: OpenAI GPT-5.2 via user's own API key (sequence generation)
- **AI Asset Selection**: OpenAI via Replit AI Integrations (gpt-5-mini for asset matching)

## Key Features
1. **Home Tab**: Paste lead intel → AI researches company → AI generates tailored 6-part sequence → post-processing injects links, availability, assets
2. **Knowledge Base Tab**: Upload/manage images & documents with automatic PDF summarization
3. **Saved Sequences Tab**: View, edit, rerun, delete past sequences

## Generation Pipeline
1. User pastes lead data row (tab-separated Google Sheets data)
2. Perplexity Sonar API researches the company → structured research brief
3. OpenAI GPT-5.2 generates 6-part outreach sequence using research brief + lead intel
4. Inject hyperlinks as HTML anchor tags (GeoMx, CosMx, CellScape, Bruker Spatial Biology → product URLs)
5. Inject availability block into emails 1-3
6. Extract keywords from lead intel + research brief for asset pre-filtering
7. Pre-filter knowledge base assets using regex keyword matching
8. Select assets via LLM for Email 1 (from pre-filtered pool)
9. Select assets via LLM for Email 2 (excluding Email 1's assets)
10. Insert image AFTER the instrument/solution paragraph in both emails
11. Insert LLM-generated attachment reference sentence before CTA in both emails

## Project Structure
```
shared/schema.ts          - Drizzle schema (assets, sequences tables)
server/db.ts              - Database connection
server/storage.ts         - Storage interface (DatabaseStorage)
server/routes.ts          - API routes with multer file upload
server/services/
  perplexity-research.ts  - Perplexity Sonar API company research
  sequence-generator.ts   - OpenAI GPT-5.2 sequence generation + text parser
  keyword-matcher.ts      - Regex keyword extraction & asset pre-filtering
  link-injector.ts        - Hyperlink map injection (deterministic)
  formatter.ts            - Availability block injection
  asset-selector.ts       - LLM-powered asset selection
  asset-summarizer.ts     - LLM-powered PDF summarization
  asset-inserter.ts       - Image & attachment placement (deterministic)
  parser.ts               - Legacy sequence parser (no longer in main pipeline)
  redundancy-checker.ts   - DISABLED — not used
client/src/
  App.tsx                 - Tab-based navigation
  pages/home.tsx          - Lead intel form + research brief + sequence output
  pages/knowledge-base.tsx - Asset upload & management
  pages/saved-sequences.tsx - Saved sequences CRUD
  components/theme-provider.tsx - Dark/light mode
```

## API Endpoints
- `GET /api/assets` - List all assets
- `POST /api/assets/upload` - Upload file (multipart/form-data)
- `DELETE /api/assets/:id` - Delete asset
- `GET /api/sequences` - List all sequences
- `GET /api/sequences/:id` - Get single sequence
- `POST /api/sequences/generate` - Two-step AI pipeline: research + generate + post-process (does NOT save)
- `POST /api/sequences/save` - Save a generated sequence to the database
- `PATCH /api/sequences/:id` - Update sequence sections
- `DELETE /api/sequences/:id` - Delete sequence

## Environment Secrets
- `PERPLEXITY_API_KEY` - Perplexity Sonar API key for company research
- `OPENAI_API_KEY` - OpenAI API key for GPT-5.2 sequence generation
- `AI_INTEGRATIONS_OPENAI_API_KEY` / `AI_INTEGRATIONS_OPENAI_BASE_URL` - Replit AI integration for asset selection (gpt-5-mini)

## Rules (Hard-Coded)
- Assets are inserted into Email 1 and Email 2 only (each gets unique assets)
- Never insert assets into LinkedIn sections or Email 3/4
- Images go AFTER the instrument/solution paragraph, not before
- All post-processing logic is deterministic (links, dates, asset placement)
- Keyword pre-filter narrows asset pool before LLM selection
- Research brief is saved alongside the sequence for reference
