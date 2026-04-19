# Releases

---

## v1.2.0 — Power User Features
*Planned*

### Added
- Fully assignable keyboard shortcuts for every button (right-click → assign)
- Shortcuts panel in Settings with live editing and "Reset to Defaults"
- Tag-based relative memory system — memories inject only when contextually relevant
- AI can now edit and delete existing memories via `[MEMORY_EDIT]` and `[MEMORY_DELETE]` tags
- AI Memory is now JSONB in Supabase — robust, never double-stringified
- General-purpose AI persona — not locked to a developer niche

### Fixed
- Memory not persisting across sessions (Supabase JSONB parsing bug)
- Fetch failed error when recalling memories from new chats
- Ghost AI messages appearing in UI when API errors occur
- Settings panel silently wiping all memories on open

---

## v1.1.0 — UX Improvements
*Released 2026-04-15*

### Added
- Sidebar search — filter conversations in real-time
- AI Chat Map — clusters long conversations into logical phases (Discovery, Deep Dive, Refinement)
- Bookmarking — star any message for fast reference
- Custom keyboard shortcuts: `Ctrl+\` (toggle sidebar), `Ctrl+K` (search)
- Chat search bar in main navigation sidebar
- Stealth memory system — AI uses `[MEMORY_LEARNED]` tag instead of breaking conversation flow
- "Saved" badge UI — animates next to assistant message header when memory is recorded
- Empty state for new chats with branded onboarding prompt
- Code block copy button with language detection

### Fixed
- Sidebar not closing on mobile after chat selection
- AI title generation running on every message
- Messages not scrolling to bottom after stream finishes

---

## v1.0.0 — Initial Stable Release
*Released 2026-04-14*

### Core Features
- Full authentication lifecycle (signup, login, logout, account deletion) via Supabase Auth
- Persistent multi-chat history with auto-generated AI titles
- Real-time streaming AI responses via SambaNova LLaMA 3.3 70B
- Smart thread sidebar — every user message is an instant-jump anchor
- Bring Your Own Key (BYOK) — OpenAI key stored locally, never transmitted
- Prompt Library — save and reuse complex prompt templates
- Viral Share — generate public read-only links to any conversation
- Snapshot export — save any message or full session as a PNG
- PWA support — installable on desktop and mobile
- File attachment — inject text files as context into any message
- Message editing — edit any message and resend from that point
- Stop response — interrupt streaming mid-generation
- Mobile-responsive layout with bottom navigation
- Dark brutalist design system with glassmorphism and Framer Motion animations
