// Simple toast utility until real component added
export type ToastOptions = {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

export function toast({ title, description, variant }: ToastOptions) {
  // For now just log to console – replace with real UI later
  if (process.env.NODE_ENV !== 'production') {
    console[variant === 'destructive' ? 'error' : 'log'](
      `[Toast] ${title}${description ? ': ' + description : ''}`
    )
  }
}

export function useToast() {
  return { toast }
}
