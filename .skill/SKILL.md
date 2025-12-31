---
name: evidence-triage
description: |
  Development skill for CaseMark's Evidence Triage Tool - a litigation evidence 
  management application with bulk upload, AI auto-categorization, OCR for handwritten 
  notes, relevance scoring, tagging, and semantic search. Built with Next.js 15 and 
  Case.dev APIs (Vaults, OCR, LLMs). Use this skill when: (1) Working on the 
  evidence-triage codebase, (2) Implementing document classification or OCR features, 
  (3) Building search/filter functionality, (4) Adding view modes or tag management, 
  or (5) Integrating Case.dev Vaults/LLMs APIs.
---

# Evidence Triage Development Guide

A litigation evidence management tool with bulk upload, AI-powered categorization, OCR text extraction, relevance scoring, tagging, and semantic search across large evidence collections.

**Live site**: https://evidence-triage-proj-ztn618t.casedev.me

## Architecture

```
src/
├── app/
│   ├── api/
│   │   └── vaults/
│   │       ├── route.ts                # List/create vaults
│   │       └── [vaultId]/
│   │           ├── evidence/           # Upload, list evidence
│   │           │   └── [evidenceId]/
│   │           │       ├── classify/   # AI classification
│   │           │       └── tags/       # Tag management
│   │           └── search/             # Semantic search
│   └── page.tsx                        # Main UI
└── lib/
    ├── case-api.ts                     # Case.dev client
    ├── types.ts                        # TypeScript types
    └── categories.ts                   # Evidence category defs
```

## Core Workflow

```
Bulk Upload → OCR Processing → Auto-Classify → Score Relevance → Tag & Search
     ↓              ↓               ↓               ↓               ↓
  Multiple     Extract text     AI assigns      0-100          Semantic +
  files with   from images,     category        relevance      faceted
  progress     PDFs, notes      type            score          filtering
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Backend | Next.js API Routes |
| Document Storage | Case.dev Vaults |
| Text Extraction | Case.dev OCR |
| Classification | Case.dev LLMs |
| Icons | Lucide React |

## Key Features

| Feature | Description |
|---------|-------------|
| Bulk Upload | Drag-drop multiple files with progress tracking |
| Auto-Categorization | AI classifies into 10 evidence categories |
| OCR | Extract text from PDFs, images, handwritten notes |
| Relevance Scoring | 0-100 score for litigation relevance |
| Tag Management | Add, remove, filter by tags |
| View Modes | Gallery, list, and timeline views |
| Semantic Search | Search by meaning, not just keywords |

## Evidence Categories

| Category | Description |
|----------|-------------|
| Contract | Agreements, terms of service |
| Email | Correspondence, email threads |
| Photo | Photographs, non-document images |
| Handwritten Note | Notes, annotations, sketches |
| Medical Record | Health documents, lab results |
| Financial Document | Statements, invoices, receipts |
| Legal Filing | Court filings, motions, briefs |
| Correspondence | Letters, memos |
| Report | Reports, analyses, summaries |
| Other | Uncategorized documents |

## Case.dev Integration

See [references/casedev-evidence-api.md](references/casedev-evidence-api.md) for API patterns.

### Vaults - Document Storage
```typescript
const vault = await createVault(caseName);
const evidence = await uploadToVault(vaultId, files);
```

### OCR - Text Extraction
```typescript
// Automatic OCR on upload for images/PDFs
const text = await getExtractedText(evidenceId);
```

### LLMs - Classification
```typescript
const classification = await classifyEvidence(evidenceId, {
  categories: evidenceCategories,
  scoreRelevance: true,
});
```

## Development

### Setup
```bash
npm install
echo "CASEDEV_API_KEY=your_key" > .env.local
npm run dev
```

### Environment
```
CASEDEV_API_KEY=sk_case_...    # Case.dev API key
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/vaults | List vaults |
| POST | /api/vaults | Create vault |
| GET | /api/vaults/:id/evidence | List evidence |
| POST | /api/vaults/:id/evidence | Upload evidence |
| POST | /api/vaults/:id/evidence/:eid/classify | Classify |
| POST | /api/vaults/:id/search | Semantic search |
| PUT | /api/vaults/:id/evidence/:eid/tags | Update tags |
| POST | /api/vaults/:id/evidence/:eid/tags | Add tag |
| DELETE | /api/vaults/:id/evidence/:eid/tags | Remove tag |

## Supported File Types

| Category | Extensions |
|----------|------------|
| Documents | .pdf, .doc, .docx, .txt |
| Images | .jpg, .jpeg, .png, .gif, .tiff |
| Emails | .eml, .msg |

## Common Tasks

### Adding a New Evidence Category
1. Add to `categories.ts`
2. Update classification prompt
3. Add icon/color mapping in UI

### Adding a New View Mode
1. Create view component
2. Add to view mode selector
3. Implement sort/filter for that view

### Improving Classification
Modify the classification prompt in `classify/route.ts` to better distinguish categories.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Classification wrong | Provide more context, adjust prompts |
| OCR fails | Check file format, image quality |
| Search no results | Wait for OCR processing |
| Upload stuck | Check file size limits, network |
