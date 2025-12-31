# Evidence Triage Skill

Agent skill for developing the evidence-triage application.

## Directory Structure

```
.skill/
├── SKILL.md                        # Core skill (always read first)
└── references/
    └── casedev-evidence-api.md     # Vaults, OCR, classification APIs
```

---

## File Descriptions

### SKILL.md
**Purpose**: Primary entry point for the skill

**Contains**:
- Application architecture overview
- Tech stack (Next.js 15, Case.dev Vaults/OCR/LLMs)
- Core workflow (upload → OCR → classify → score → tag/search)
- Evidence categories list
- API endpoint reference

**When loaded**: Queries about evidence-triage, document classification, OCR, evidence management

**Size**: ~140 lines

---

### references/casedev-evidence-api.md
**Purpose**: Case.dev API patterns for evidence management

**Contains**:
- Vault creation and management
- Bulk upload with progress tracking
- OCR status polling and text extraction
- AI classification with relevance scoring
- Semantic search with filters
- Tag management (add, remove, update)
- Rate limits and credit usage

**When to read**: Building upload/OCR/classification features, improving search

**Size**: ~220 lines

---

## Trigger Examples

| Query | Loads |
|-------|-------|
| "Fix gallery view layout" | SKILL.md only |
| "Add timeline view sorting" | SKILL.md only |
| "Improve OCR for handwriting" | SKILL.md + casedev-evidence-api.md |
| "Add relevance score filter" | SKILL.md + casedev-evidence-api.md |
| "Implement bulk tagging" | SKILL.md + casedev-evidence-api.md |
