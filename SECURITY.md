# Security Policy

## Supported Versions

Security updates are handled on a best-effort basis for the latest state of the repository.

## Reporting a Vulnerability

Please do not report security vulnerabilities in public GitHub issues.

Instead:

- Contact the maintainers privately
- Include a clear description of the issue
- Include reproduction steps if possible
- Share impact, affected files, and any suggested mitigation

We will try to acknowledge reports promptly and work toward a fix as quickly as possible.

## Secrets

- Never commit API keys or tokens
- Use `.env.local` for local secrets
- Rotate any secret immediately if it is accidentally exposed
