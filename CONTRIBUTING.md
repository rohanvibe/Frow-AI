# Contributing to Threadly AI

Thank you for your interest in contributing. Threadly is built in the open, and every contribution — large or small — makes a real difference.

---

## Ways to Contribute

You don't need to write code to contribute:

- 🐛 **Report bugs** — even detailed bug reports save hours
- 💡 **Suggest features** — product ideas that serve real users
- 📖 **Improve documentation** — fix typos, clarify setup steps, add examples
- 🎨 **UI improvements** — design polish, accessibility fixes
- ⚡ **Code contributions** — new features, bug fixes, performance improvements
- 🔍 **Code review** — review open PRs and leave thoughtful feedback

---

## Before You Start

1. Check [Issues](https://github.com/rohanvibe/threadly-AI/issues) to see if your bug or feature is already tracked.
2. For large changes, open an Issue first and describe your plan. This avoids duplicate work and ensures it aligns with the project direction.
3. Read this guide fully before submitting a PR.

---

## Setting Up Locally

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/threadly-AI.git
cd threadly-AI

# Install dependencies
npm install

# Copy env template
cp .env.example .env.local
# Fill in your Supabase + SambaNova keys

# Run the database schema in your Supabase SQL Editor
# File: supabase_schema.sql

# Start dev server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Branch Naming

Use clear, descriptive branch names:

| Type | Pattern | Example |
|---|---|---|
| Bug fix | `fix/description` | `fix/memory-not-saving` |
| Feature | `feat/description` | `feat/chat-folders` |
| Documentation | `docs/description` | `docs/env-setup` |
| Refactor | `refactor/description` | `refactor/sidebar-state` |

---

## Commit Style

Use conventional commits for clarity:

```
feat: add chat folder support
fix: memory not persisting across sessions
docs: update env variable table in README
refactor: extract sidebar into separate component
chore: update supabase client version
```

---

## Pull Request Checklist

Before submitting a PR, confirm:

- [ ] My change is scoped and focused on one thing
- [ ] I tested the feature locally and it works as expected
- [ ] I did not break any existing functionality
- [ ] TypeScript compiles with no errors (`npx tsc --noEmit`)
- [ ] Code is readable and follows existing patterns
- [ ] I've updated documentation where relevant
- [ ] PR description explains what changed and why

---

## Code Quality Standards

- **TypeScript**: All new code must be typed. Avoid `any` where possible.
- **Components**: Keep components focused. Extract if a component exceeds ~150 lines.
- **State management**: Use `useState` and `useEffect` with clear dependency arrays. Avoid unnecessary re-renders.
- **API routes**: Validate inputs, handle all error paths, return consistent response shapes.
- **Security**: Never log secrets. Never expose server-side keys to the client.

---

## Beginner-Friendly Issues

Look for issues tagged [`good first issue`](https://github.com/rohanvibe/threadly-AI/labels/good%20first%20issue). These are:

- Well-scoped and clearly described
- Don't require deep codebase knowledge
- Reviewed and merged quickly

If you're unsure where to start, open a Discussion and ask.

---

## Respect & Communication

Be direct, constructive, and respectful. We're all here because we care about making something good.

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for full community standards.

---

## Questions?

Open a [GitHub Discussion](https://github.com/rohanvibe/threadly-AI/discussions) or email [maheshkumar79759@gmail.com](mailto:maheshkumar79759@gmail.com).
