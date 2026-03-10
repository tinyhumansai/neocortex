# Reliable Sources for CA Books and Tax Reference Material

This document lists suggested **reliable sources** for Chartered Accountant (CA) study material and official tax/legal content that can be placed in the `books/` folder for ingestion into LexAI. Use only content you are permitted to use (e.g. official publications, open material, or licensed content).

---

## Official / Institutional

| Source                                                 | Description                                                                                        | Use in LexAI                                                                                                    |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **ICAI (Institute of Chartered Accountants of India)** | Study material, practice manuals, and guidance for CA exams (Direct Tax, Indirect Tax, Law, etc.). | PDFs of permitted study modules can be placed in `books/` and ingested for accurate, syllabus-aligned guidance. |
| **Income Tax Department (incometax.gov.in)**           | Taxpayer guides, circulars, manuals, and FAQs.                                                     | Official PDFs (e.g. ITR instructions, tax slab documents) help ground answers in current department guidance.   |
| **CBIC / GST Portal (cbic.gov.in, gst.gov.in)**        | GST Acts, rules, circulars, and FAQs.                                                              | PDFs on GST rates, input tax credit, and compliance support GST-related Q&A.                                    |
| **Ministry of Corporate Affairs (MCA)**                | Companies Act, rules, and circulars.                                                               | Useful for company law and corporate compliance questions.                                                      |

---

## Content Types That Work Well

- **Text-based PDFs**: The ingestion pipeline extracts text; scanned image-only PDFs may not work well without OCR.
- **Structured material**: Study modules, act sections, and circulars (with clear headings and paragraphs) chunk and retrieve better.
- **Single-topic documents**: e.g. “Income Tax – Deductions”, “GST – Registration” — improve relevance of retrieved chunks.

---

## How to Add Content

1. Obtain the PDF from an official or licensed source.
2. Place the file in the project root folder: **`books/`**.
3. Ingest via API:  
   `POST /api/books/absorb` with body `{ "filename": "your-file.pdf" }` (or `{}` to ingest all PDFs in `books/`).
4. Once ingested, chat answers can use this content for grounded, citation-style responses.

---

## Compliance and Licensing

- **Copyright**: Only ingest content you have the right to use (e.g. official government publications, content under open licenses, or with explicit permission).
- **Attribution**: The system prompt instructs the AI to cite and prefer the ingested material; ensure your use aligns with any attribution requirements of the source.
- **Updates**: Tax and law change frequently; periodically refresh PDFs from official sources and re-ingest to keep guidance current.

---

## Future Extensions

- **Third-party CA data**: Integration with licensed CA content providers (e.g. publishers of reference material) can be added via the same ingestion pipeline or dedicated APIs.
- **Government APIs**: Where the government provides machine-readable APIs or bulk downloads (e.g. circulars, notifications), those can be wired into the same book/chunk pipeline for automated updates.
