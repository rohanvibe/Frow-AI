# Frow AI — Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| v1.2.x | ✅ Current |
| v1.1.x | ✅ |
| v1.0.x | ⚠️ Best-effort only |
| < v1.0 | ❌ |

## Reporting a Vulnerability

**Do not open a public GitHub Issue for security vulnerabilities.**

Report security issues privately by emailing: [maheshkumar79759@gmail.com](mailto:maheshkumar79759@gmail.com)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Your suggested fix (optional)

You will receive a response within 72 hours. We take all reports seriously and will coordinate a fix and disclosure timeline with you.

## Security Model

- Supabase Row Level Security (RLS) is enforced on all database tables.
- The groq AI API key is stored server-side only and never exposed to the client.
- BYOK (user's own OpenAI key) is stored only in the user's browser localStorage and is never sent to any backend server.
- Auth sessions are managed entirely by Supabase Auth.

