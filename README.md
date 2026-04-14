# Threadly AI

![Threadly Banner](/public/icon.png)

Threadly is a high-performance, production-ready AI chatbot workspace built with **Next.js 15+**, **Supabase**, and **SambaNova AI**. It features a "Bring Your Own Key" (BYOK) architecture, persistent chat history, and smart sidebar navigation for power users.

## ✨ Features

- **🚀 SambaNova LLaMA 3.1 Integration**: Blazing fast, enterprise-grade AI responses streaming in real-time.
- **🛡️ Secure BYOK (Bring Your Own Key)**: Use your own OpenAI keys. Keys are stored safely in your browser and never transmitted to our servers.
- **🔒 Robust Authentication**: Complete user lifecycle management powered by Supabase Auth.
- **📂 Persistent Chat History**: Manage multiple conversations with automatic AI-generated titles and persistent storage.
- **📍 Smart Sidebar Navigation**: Instantly jump between user messages in long conversations with a dynamic, highlighted navigation panel.
- **⚡ Pro-UX Elements**: Modern glassmorphic design, smooth animations, and PWA support for mobile/desktop installation.
- **💾 Prompt Library**: Save and reuse your favorite complex prompts in a dedicated prompt manager.

## 🛠️ Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Database & Auth**: Supabase (PostgreSQL + RLS)
- **AI Engine**: SambaNova Cloud (LLaMA 3.1 8B)
- **Styling**: Tailwind CSS 4
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **PWA**: Custom Service Worker + Manifest

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/rohanvibe/threadly-AI.git
cd threadly-AI
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Supabase
1. Create a new project at [supabase.com](https://supabase.com).
2. Run the SQL schema found in `supabase/migrations/schema.sql` in the Supabase SQL Editor.
3. Enable "Email Auth" in Authentication settings.

### 4. Environment Variables
Create a `.env.local` file in the root directory and add your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SAMBANOVA_API_KEY=your_sambanova_api_key
```

### 5. Run Locally
```bash
npm run dev
```
Visit `http://localhost:3000` to start chatting.

## 📦 Deployment

### Vercel (Recommended)
1. Push your code to GitHub.
2. Import the project into Vercel.
3. Add the environment variables listed above.
4. Update your **Site URL** in Supabase Auth settings to your Vercel URL.

## 🤝 Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started.

## 📜 License

This project is licensed under a custom license. See [LICENSE](LICENSE) for details.
- Personal and Educational use: **Allowed**
- Commercial use: **NOT Allowed** without explicit permission.

For commercial inquiries, contact: [maheshkumar79759@gmail.com](mailto:maheshkumar79759@gmail.com)
.