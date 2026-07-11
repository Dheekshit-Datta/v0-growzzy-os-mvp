export function AdsAccountGate({ children }: { children: React.ReactNode }) {
  // Each dashboard page owns its scoped loading and empty states. A global
  // account poll here made navigation slow and briefly showed false disconnects.
  return <>{children}</>
}
