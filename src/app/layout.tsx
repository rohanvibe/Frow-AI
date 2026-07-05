import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Frow AI",
  description: "Next-gen AI chatbot workspace with high-performance streaming.",
  manifest: "/manifest.json?v=3",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Frow AI",
    startupImage: "/icon-v3.png"
  },
  icons: {
    icon: "/icon-v3.png",
    apple: "/icon-v3.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

import { ToastProvider } from "@/components/ui";
import { VisualShell } from "@/components/VisualShell";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css"
          integrity="sha384-GvrOXuhMATgEsSwCs4smul74iXGOixntILdUW9XmUC6+HX0sLNAK3q71HotJqlAn"
          crossOrigin="anonymous"
        />
        <script src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"></script>
      </head>
      <body className="min-h-full flex flex-col bg-(--background) text-(--foreground) selection:bg-blue-500/30">
        <ToastProvider>
           <VisualShell>
             <div id="spotlight" />
             <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-50 grain-texture" />
             {children}
           </VisualShell>
           <Analytics />
        </ToastProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/service-worker.js');
                });
              }

              // Global Theme Controller
              try {
                const root = document.documentElement;
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                
                const applyTheme = () => {
                  const savedTheme = localStorage.getItem('Frow_theme');
                  const prefersDark = mediaQuery.matches;
                  root.classList.remove('light', 'dark');
                  if (savedTheme === 'dark' || (savedTheme === 'system' && prefersDark) || (!savedTheme && prefersDark)) {
                    root.classList.add('dark');
                  } else {
                    root.classList.add('light');
                  }
                };
                
                // Apply on load
                applyTheme();
                
                // Listen to OS changes
                mediaQuery.addEventListener('change', applyTheme);
                
                // Listen to UI changes from page.tsx
                window.addEventListener('theme-changed', applyTheme);
                
                // Listen to cross-tab changes
                window.addEventListener('storage', (e) => {
                  if (e.key === 'Frow_theme') applyTheme();
                });
              } catch (e) {}

              // Liquid Spotlight Logic
              const spotlight = document.getElementById('spotlight');
              document.addEventListener('mousemove', (e) => {
                if (spotlight) {
                  spotlight.style.setProperty('--mouse-x', e.clientX + 'px');
                  spotlight.style.setProperty('--mouse-y', e.clientY + 'px');
                }
              });
            `,
          }}
        />
      </body>
    </html>
  );
}

