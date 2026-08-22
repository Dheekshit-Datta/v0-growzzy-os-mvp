"use client"

type Platform = "GOOGLE" | "META" | "google" | "meta"

export function PlatformIcon({ platform, className = "h-4 w-4" }: { platform: Platform | string; className?: string }) {
  const normalized = String(platform || "").toLowerCase()

  if (normalized === "meta") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="Meta Ads">
        <path
          fill="#1877F2"
          d="M12 2C6.5 2 2 6.5 2 12c0 5 3.7 9.1 8.4 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.5 2.9h-2.3v7C18.3 21.1 22 17 22 12c0-5.5-4.5-10-10-10z"
        />
      </svg>
    )
  }

  if (normalized === "google") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="Google Ads">
        <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4c-.2 1.3-1 2.4-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.6z" />
        <path fill="#34A853" d="M12 22c2.7 0 5-1 6.7-2.6l-3.3-2.6c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H2.9v2.6C4.6 19.6 8.1 22 12 22z" />
        <path fill="#FBBC04" d="M6.4 13.7c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.1H2.9C2.3 8.6 2 10.3 2 12s.3 3.4.9 4.9l3.5-2.6z" />
        <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9C16.9 3 14.7 2 12 2 8.1 2 4.6 4.4 2.9 7.1l3.5 2.6C7.2 7.7 9.4 5.9 12 5.9z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Ad platform">
      <circle cx="12" cy="12" r="10" fill="#64748B" />
      <path d="M7 14.5 10.2 9l2.4 4.1 1.4-2.3 3 3.7H7z" fill="white" />
    </svg>
  )
}
