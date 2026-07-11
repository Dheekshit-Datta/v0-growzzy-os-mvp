export function MetaLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-label="Meta">
      <path
        d="M3 19.5c0-5 2.7-9.5 6.6-9.5 2.4 0 4 1.5 6.4 5 2.4-3.5 4.1-5 6.5-5 4 0 6.5 4.5 6.5 9.5 0 3-1.5 5-3.7 5-2 0-3.2-1-5.3-4.5-1.6-2.7-2.5-4.2-3-4.2-.6 0-1.4 1.4-3.1 4.2-2.1 3.5-3.3 4.5-5.3 4.5-2.3 0-3.6-2-3.6-5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function GoogleLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Google">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.86Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.92l-3.88-3c-1.08.72-2.45 1.16-4.06 1.16-3.12 0-5.77-2.11-6.71-4.94H1.29v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.3a7.21 7.21 0 0 1 0-4.6V6.6H1.29a12 12 0 0 0 0 10.8l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.59 1.8l3.44-3.44C17.95 1.18 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.6l4 3.1C6.23 6.86 8.88 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function PlatformLogosRow() {
  return (
    <div id="platforms" className="flex flex-col items-center gap-4">
      <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
        Works with the platforms you already run
      </p>
      <div className="flex items-center gap-10 opacity-90">
        <div className="flex items-center gap-2 text-ink">
          <MetaLogo className="h-5 w-5 text-meta" />
          <span className="text-sm font-medium">Meta Ads</span>
        </div>
        <div className="flex items-center gap-2 text-ink">
          <GoogleLogo className="h-5 w-5" />
          <span className="text-sm font-medium">Google Ads</span>
        </div>
      </div>
    </div>
  );
}
