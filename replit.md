# Bruker Outreach Sequence Engine

## Overview
A deterministic scientific outreach sequence compiler with LLM-assisted asset matching for Bruker Spatial Biology. Not a chatbot — it's a rule-enforced sequence formatter with intelligent attachment selection.

## Architecture
- **Frontend**: React + TypeScript with Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL via Drizzle ORM
- **LLM**: OpenAI via Replit AI Integrations (gpt-5-mini for cost efficiency)

## Key Features
1. **Home Tab**: Create & generate formatted 6-part outreach sequences
2. **Knowledge Base Tab**: Upload/manage images & documents with automatic PDF summarization
3. **Saved Sequences Tab**: View, edit, rerun, delete past sequences

## Generation Pipeline
1. Parse raw input into 6 sections (Email 1-4, LinkedIn Connection, LinkedIn Message)
2. Inject hyperlinks as HTML anchor tags (GeoMx, CosMx, CellScape, Bruker Spatial Biology → product URLs)
3. Inject date/time availability placeholders
4. Select assets via LLM for Email 1
5. Select assets via LLM for Email 2 (excluding Email 1's assets)
6. Insert image AFTER the instrument/solution paragraph in both emails
7. Insert LLM-generated attachment reference sentence before CTA in both emails

## Project Structure
```
shared/schema.ts          - Drizzle schema (assets, sequences tables)
server/db.ts              - Database connection
server/storage.ts         - Storage interface (DatabaseStorage)
server/routes.ts          - API routes with multer file upload
server/services/
  parser.ts               - Sequence parser (deterministic)
  formatter.ts            - Date/time injection only (no text rewriting)
  link-injector.ts        - Hyperlink map injection (deterministic)
  asset-selector.ts       - LLM-powered asset selection
  asset-summarizer.ts     - LLM-powered PDF summarization
  redundancy-checker.ts   - DISABLED — user's original wording is never rewritten
  asset-inserter.ts       - Image & attachment placement (deterministic)
client/src/
  App.tsx                 - Tab-based navigation
  pages/home.tsx          - Sequence creation form + output
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
- `POST /api/sequences/generate` - Generate formatted sequence (does NOT save)
- `POST /api/sequences/save` - Save a generated sequence to the database
- `PATCH /api/sequences/:id` - Update sequence sections
- `DELETE /api/sequences/:id` - Delete sequence

## Rules (Hard-Coded)
- NEVER modify user's original email wording — text is sacred, copied word-for-word
- Assets are inserted into Email 1 and Email 2 only (each gets unique assets)
- Never insert assets into LinkedIn sections or Email 3/4
- Only the LLM-generated attachment reference sentence is new text added to the email
- Images go AFTER the instrument/solution paragraph, not before
- LLM calls isolated to asset-selector and asset-summarizer only
- No redundancy rewriting — Email 4 stays as written even if similar to Email 3
- All formatting logic is deterministic (links, dates, asset placement)
