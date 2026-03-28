# Contributing to BitLibrary

Thanks for your interest in contributing.

## Before You Start

- Search existing issues and pull requests before opening a new one
- Keep pull requests focused and small when possible
- For larger changes, open an issue first so we can align on direction

## Development Setup

1. Fork the repository
2. Clone your fork
3. Install dependencies

```bash
pnpm install
```

4. Create your local env file

```bash
cp .env.example .env.local
```

5. Start the app

```bash
pnpm dev
```

## Branch Naming

Examples:

- `feat/search-filters`
- `fix/author-routing`
- `docs/readme-refresh`

## Pull Request Guidelines

- Describe what changed and why
- Include screenshots for UI changes when helpful
- Avoid unrelated refactors in the same PR
- Update docs when behavior or setup changes
- Test your changes locally before submitting

## Code Style

- Use TypeScript where possible
- Follow existing naming and file structure patterns
- Prefer small, readable functions over overly clever abstractions
- Keep UI changes consistent with the project’s current visual direction

## Reporting Bugs

Please include:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots or console errors if available
- Browser and OS details

## Feature Requests

Please explain:

- The problem you are trying to solve
- Your proposed solution
- Any alternatives you considered

## Security

Please do not open public issues for sensitive vulnerabilities. See [SECURITY.md](./SECURITY.md).
