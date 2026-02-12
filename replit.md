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
2. Enforce intro rules (Hello {{first_name}}, + Tim Glidewell intro)
3. Inject hyperlinks (GeoMx, CosMx, CellScape → product URLs)
4. Inject date/time availability
5. Select assets via LLM (Email 1 only, mandatory for cold outreach)
6. Insert image after first instrument paragraph
7. Insert justification + attachments before CTA
8. Redundancy check: if Email 3 & 4 are >70% similar, rewrite Email 4

## Project Structure
```
shared/schema.ts          - Drizzle schema (assets, sequences tables)
server/db.ts              - Database connection
server/storage.ts         - Storage interface (DatabaseStorage)
server/routes.ts          - API routes with multer file upload
server/services/
  parser.ts               - Sequence parser (deterministic)
  formatter.ts            - Intro enforcement & date injection (deterministic)
  link-injector.ts        - Hyperlink map injection (deterministic)
  asset-selector.ts       - LLM-powered asset selection
  asset-summarizer.ts     - LLM-powered PDF summarization
  redundancy-checker.ts   - Similarity check + LLM rewrite
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
- `POST /api/sequences/generate` - Generate formatted sequence
- `PATCH /api/sequences/:id` - Update sequence sections
- `DELETE /api/sequences/:id` - Delete sequence

## Rules (Hard-Coded)
- Never insert assets outside Email 1
- Never insert assets into LinkedIn sections
- Always enforce intro format on all emails
- LLM calls isolated to asset-selector, asset-summarizer, redundancy-checker
- All formatting logic is deterministic
