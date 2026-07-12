export function Logo({ className = "w-6 h-6", glow = false }: { className?: string, glow?: boolean }) {
  return (
    <svg
      className={`${className} ${glow ? 'drop-shadow-[0_0_12px_rgba(168,85,247,0.6)]' : ''}`}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background squircle */}
      <rect width="100" height="100" rx="28" fill="currentColor" fillOpacity="0.08" />

      {/* Bold "F" letterform */}
      <path
        d="M32 72V28H68"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M32 50H60"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Accent dot — purple, signals "AI" */}
      <circle cx="71" cy="72" r="8" fill="#A855F7" />
    </svg>
  )
}
