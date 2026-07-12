export function Logo({ className = "w-6 h-6", glow = false }: { className?: string, glow?: boolean }) {
  return (
    <svg 
      className={`${className} ${glow ? 'drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]' : ''}`}
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" rx="25" fill="currentColor" fillOpacity="0.05" />
      <path 
        d="M35 70V30H65M35 50H55" 
        stroke="currentColor" 
        strokeWidth="12" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <circle cx="70" cy="30" r="6" fill="#A855F7" />
    </svg>
  )
}
