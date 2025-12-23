# Evidence Triage Tool

A powerful evidence management tool for litigation teams. Bulk upload evidence, auto-categorize by type, OCR handwritten notes, tag and search across large evidence collections.

## Features

- **Bulk Upload with Progress Tracking**: Drag and drop multiple files at once with real-time progress indicators
- **Auto-Categorization**: AI-powered classification into categories (contracts, emails, photos, handwritten notes, medical records, financial documents, legal filings, correspondence, reports)
- **OCR for All Formats**: Extract text from PDFs, images, and handwritten notes using Case.dev's OCR engine
- **AI-Powered Relevance Scoring**: Automatically score documents by relevance to litigation (0-100)
- **Tag Management & Filtering**: Add, remove, and filter by tags with faceted search
- **Multiple View Modes**: Gallery view, list view, and timeline view
- **Semantic Search**: Search evidence by meaning, not just keywords

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **APIs**: Case.dev (Vaults, OCR, LLMs)
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- Case.dev API key ([get one here](https://console.case.dev))

### Installation

1. Clone the repository and navigate to the project:
```bash
cd evidence-triage
```

2. Install dependencies:
```bash
npm install
```

3. Set the `CASEDEV_API_KEY` environment variable with your Case.dev API key:
```bash
# Create .env.local for local development
echo "CASEDEV_API_KEY=your_api_key_here" > .env.local
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Supported File Types

| Category | Extensions |
|----------|------------|
| Documents | `.pdf`, `.doc`, `.docx`, `.txt` |
| Images | `.jpg`, `.jpeg`, `.png`, `.gif`, `.tiff` |
| Emails | `.eml`, `.msg` |

### Evidence Categories

- **Contract**: Legal contracts, agreements, terms of service
- **Email**: Email correspondence, email threads
- **Photo**: Photographs, images (non-document)
- **Handwritten Note**: Handwritten notes, annotations, sketches
- **Medical Record**: Medical records, health documents, lab results
- **Financial Document**: Financial statements, invoices, receipts
- **Legal Filing**: Court filings, pleadings, motions, briefs
- **Correspondence**: Letters, memos, formal correspondence
- **Report**: Reports, analyses, summaries
- **Other**: Documents that don't fit other categories

## API Endpoints

### Vaults
- `GET /api/vaults` - List all vaults
- `POST /api/vaults` - Create a new vault

### Evidence
- `GET /api/vaults/:vaultId/evidence` - List evidence with filters
- `POST /api/vaults/:vaultId/evidence` - Upload evidence files

### Classification
- `POST /api/vaults/:vaultId/evidence/:evidenceId/classify` - Classify evidence

### Search
- `POST /api/vaults/:vaultId/search` - Semantic search across evidence

### Tags
- `PUT /api/vaults/:vaultId/evidence/:evidenceId/tags` - Update tags
- `POST /api/vaults/:vaultId/evidence/:evidenceId/tags` - Add a tag
- `DELETE /api/vaults/:vaultId/evidence/:evidenceId/tags?tag=name` - Remove a tag

## Case.dev APIs Used

- **Vaults**: Document storage with semantic search
- **OCR**: Text extraction from PDFs and images (including handwriting)
- **LLMs**: Document classification and relevance scoring

## Security Note

This application is designed for local development and trusted deployment environments. The API routes do not implement user authentication—instead, access control is managed through:

- The `CASEDEV_API_KEY` environment variable (server-side only, never exposed to the browser)
- Your Case.dev account permissions

For production deployments with multiple users, you should add an authentication layer (e.g., Clerk, NextAuth, or similar).

## Credit Usage

This application consumes Case.dev API credits:

- **Document Classification**: Each document uses LLM credits for AI-powered categorization and relevance scoring
- **OCR Processing**: Images and scanned PDFs consume OCR credits for text extraction
- **Semantic Search**: Search queries use embedding and vector search credits

Bulk uploads will consume credits proportionally to the number of documents. Monitor your usage at [console.case.dev](https://console.case.dev).

## Future Enhancements

- Custodian assignment
- Privilege tagging
- Bates numbering
- Production sets
- Bulk tag operations
- Export functionality

## License

MIT
