# Privacy, Data Storage, and Regulatory Compliance (India)

This document outlines how LexAI considers **privacy**, **data storage**, and **regulatory compliance** in the Indian context. It is intended for the POC and should be reviewed by legal/compliance before any production or commercial use.

---

## Data We Store

| Data                           | Purpose                                                           | Storage           |
| ------------------------------ | ----------------------------------------------------------------- | ----------------- |
| **User profile**               | Identity (email, name, image from Google OAuth)                   | MongoDB           |
| **Conversations and messages** | Chat history for continuity and memory                            | MongoDB           |
| **User memory**                | Extracted facts (e.g. profession, location) for personalisation   | MongoDB           |
| **Tax filings**                | Draft and submitted filing payload (personal, income, deductions) | MongoDB           |
| **Ingested books**             | Extracted text chunks from PDFs in `books/`                       | MongoDB           |
| **OAuth state**                | Temporary state during Google login                               | Redis (short TTL) |
| **Rate limiting**              | Counters for chat rate limits                                     | Redis             |

Sensitive identifiers (e.g. **PAN**, **Aadhaar**) may be entered in the filing form. For production:

- Do **not** store Aadhaar in full; follow UIDAI and applicable guidelines (e.g. only last 4 digits or tokenisation if needed).
- Restrict access to filing and conversation data (role-based access, encryption at rest, audit logs).
- Define **retention** (e.g. how long drafts and submitted payloads are kept) and document it in a user-facing privacy policy.

---

## Data Storage Location and Security

- **Database (MongoDB)** and **cache (Redis)** may be hosted on-premises or in the cloud. For Indian users, consider hosting in **India** (e.g. local data centre or a region that satisfies your compliance requirements).
- Use **TLS** for all client–server and server–DB/cache communication.
- Ensure **secrets** (e.g. `JWT_SECRET`, `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY`, DB and Redis URLs) are in environment variables or a secrets manager, not in code or public repos.

---

## India Regulatory Considerations

### Privacy and data protection

- **Digital Personal Data Protection Act (DPDP) 2023**: When applicable, ensure:
  - **Consent** for collection and use of personal data (e.g. at sign-up and in a clear privacy policy).
  - **Purpose limitation** and use of data only for stated purposes (e.g. providing tax assistance and filing workflow).
  - **Data subject rights** (access, correction, erasure) where applicable; implement processes and, if needed, API or UI to support them.
- **IT Act / Rules**: Follow applicable requirements for sensitive personal data and reasonable security practices.

### Tax and financial data

- Filing data (income, deductions, PAN, etc.) is **sensitive**. Access should be limited, and data should be encrypted at rest and in transit.
- This POC does **not** submit returns to the Income Tax Department; submission is a stub. Any future integration with government systems must comply with the department’s terms, technical specifications, and data-handling requirements.

### Aadhaar

- Do **not** store or log full Aadhaar numbers. If Aadhaar is used for e-sign or verification in future, follow **UIDAI** and **Aadhaar Act** guidelines and use official APIs/mechanisms only.

---

## Third-Party Services

- **Google OAuth**: Users sign in with Google; Google’s privacy policy and data handling apply to that sign-in. We store only the profile fields returned by Google (e.g. email, name, image) and use them for identity and UX.
- **OpenAI API**: Conversation content and prompts (including book context and memory) are sent to OpenAI for generating answers. Ensure your use complies with OpenAI’s terms and that users are informed (e.g. in a privacy policy) that AI processing may involve third-party services.

---

## Recommendations for Production

1. **Privacy policy**: Publish a clear privacy policy (what you collect, why, how long you keep it, and how users can exercise rights).
2. **Consent**: Obtain explicit consent where required (e.g. at registration and, if needed, before sending data to third-party AI).
3. **Data retention and deletion**: Define and implement retention periods and secure deletion for user data (including filings and chat).
4. **Audit and access control**: Log access to sensitive data; restrict DB and API access to authorised roles.
5. **Encryption**: Encrypt sensitive data at rest (e.g. MongoDB encryption, encrypted backups) and use TLS everywhere in transit.
6. **Legal review**: Have privacy, data protection, and India-specific regulations reviewed by legal/compliance before launch.

This document is for **guidance only** and does not constitute legal advice. Consult qualified legal and compliance professionals for your specific use case and jurisdiction.
