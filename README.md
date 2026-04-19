<div align="center">

<img src="/public/icon.png" alt="Threadly AI" width="80" />

# Threadly AI

**The AI workspace built for long conversations.**

Stop losing context. Stop scrolling endlessly. Start thinking clearly.

[![Live App](https://img.shields.io/badge/Live%20App-threadly.vercel.app-blue?style=flat-square&logo=vercel)](https://threadly.vercel.app)
[![License](https://img.shields.io/badge/License-Custom%20Non--Commercial-orange?style=flat-square)](LICENSE)
[![Stars](https://img.shields.io/github/stars/rohanvibe/threadly-AI?style=flat-square&logo=github)](https://github.com/rohanvibe/threadly-AI/stargazers)
[![Last Commit](https://img.shields.io/github/last-commit/rohanvibe/threadly-AI?style=flat-square)](https://github.com/rohanvibe/threadly-AI/commits)
[![Issues](https://img.shields.io/github/issues/rohanvibe/threadly-AI?style=flat-square)](https://github.com/rohanvibe/threadly-AI/issues)

<br />

> If this project helps you, please consider giving it a ⭐ — it helps others find it.

</div>

---

## The Problem

Every AI chat app has the same flaw: **long conversations become unusable.**

- You lose track of what was said 40 messages ago.
- You can't jump back to a key decision point.
- Your context disappears when you close the tab.
- You have no control over which AI model or key is used.
- You start over. Again.

Threadly is built specifically to fix this.

---

## What Threadly Does Differently

| Feature | Generic AI Chat | Threadly |
|---|---|---|
| Persistent chat history | ❌ or fragile | ✅ Supabase-backed |
| Jump to any message | ❌ | ✅ Thread sidebar |
| AI Memory (Persistent Brain) | ❌ | ✅ Tag-based memory |
| Bring Your Own Key | ❌ | ✅ BYOK + local storage |
| Prompt library | ❌ | ✅ Saved templates |
| Custom keyboard shortcuts | ❌ | ✅ Fully assignable |
| PWA installable | ❌ | ✅ Desktop + mobile |
| Chat sharing | ❌ | ✅ Public share links |
| Code block copy | ❌ | ✅ Built-in |

---

## Key Features

### 🧵 Thread Navigation Sidebar
Every user message becomes a clickable anchor. Instantly jump to any point in a long conversation — no scrolling, no searching.

### 🧠 Persistent AI Memory
The AI remembers facts across sessions using a tag-based memory system. Memories are only injected into the prompt when contextually relevant — keeping responses fast even with hundreds of stored facts.

### 🔑 Bring Your Own Key (BYOK)
Use your own OpenAI API key. Your key is stored locally in the browser — never sent to any server.

### ⚡ Fast Streaming AI
Powered by SambaNova's LLaMA 3.3 70B. Real-time streaming with no perceptible delay.

### 📚 Prompt Library
Save complex, recurring prompts as reusable templates. One click to inject into your next chat.

### ⌨️ Fully Assignable Shortcuts
Right-click any button to assign a custom keyboard shortcut. All shortcuts are visible in Settings → Shortcuts and persist across sessions.

### 📤 Share Any Chat
Generate a public read-only link to any conversation. Useful for sharing AI research, answers, or code sessions.

### 📱 PWA Ready
Install Threadly as a desktop or mobile app. Fully offline-capable UI shell.

### 🔍 Chat Search
Real-time filtering across all your conversations in the navigation sidebar.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth |
| AI Engine | SambaNova Cloud — LLaMA 3.3 70B Instruct |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion |
| Icons | Lucide React |
| Markdown | ReactMarkdown + remark-gfm |
| Deployment | Vercel |

---

## Quick Start

Get a working local instance in under 3 minutes.

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)
- A [SambaNova](https://sambanova.ai) API key (free tier available)

### 1. Clone

```bash
git clone https://github.com/rohanvibe/threadly-AI.git
cd threadly-AI
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of [`supabase_schema.sql`](supabase_schema.sql)
3. Enable **Email Auth** under Authentication → Providers

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SAMBANOVA_API_KEY=your_sambanova_api_key
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous public key |
| `SAMBANOVA_API_KEY` | ✅ | SambaNova API key for LLM access |

---

## Deploying to Vercel

1. Push your fork to GitHub
2. Import into [Vercel](https://vercel.com)
3. Add all three environment variables in Vercel Project Settings
4. Set **Site URL** in Supabase → Auth → URL Configuration to your Vercel deployment URL
5. Deploy

---

## Screenshots

> Screenshots coming soon. Pull requests adding screenshots are welcome.

---

## Roadmap

- [ ] Multi-model support (Claude, Gemini, GPT-4o)
- [ ] Chat folders and tagging
- [ ] Voice input / TTS output
- [ ] Export chat as PDF / Markdown
- [ ] Plugin / tool-calling support
- [ ] Team workspaces
- [ ] Chat templates per domain (coding, writing, research)

---

## Contributing

Threadly is actively welcoming contributors. See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

Good first issues are labeled [`good first issue`](https://github.com/rohanvibe/threadly-AI/labels/good%20first%20issue).

---

## License

This project uses a custom non-commercial license.

- ✅ Personal use
- ✅ Educational use
- ✅ Open-source contributions and learning
- ✅ Modifications with attribution
- ❌ Commercial use without permission

See [LICENSE](LICENSE) for full terms. For commercial inquiries: [maheshkumar79759@gmail.com](mailto:maheshkumar79759@gmail.com)

---

<div align="center">

Built with care. Designed for focused work.

**[⭐ Star this repo](https://github.com/rohanvibe/threadly-AI) · [Report a Bug](https://github.com/rohanvibe/threadly-AI/issues/new?template=bug_report.md) · [Request a Feature](https://github.com/rohanvibe/threadly-AI/issues/new?template=feature_request.md)**

</div>