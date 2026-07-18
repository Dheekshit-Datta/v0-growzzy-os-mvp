'use client'

import { useEffect, useRef } from 'react'

const FADE_MS = 500

interface FadingVideoProps {
  src: string
  className?: string
  style?: React.CSSProperties
}

export function FadingVideo({ src, className, style }: FadingVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let rafId: number | null = null

    const fadeIn = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min((now - start) / FADE_MS, 1)
        video.style.opacity = String(t)
        if (t < 1) rafId = requestAnimationFrame(tick)
        else rafId = null
      }
      rafId = requestAnimationFrame(tick)
    }

    const onLoadedData = () => {
      void video.play()
      fadeIn()
    }

    video.style.opacity = '0'
    video.addEventListener('loadeddata', onLoadedData)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      video.removeEventListener('loadeddata', onLoadedData)
    }
  }, [])

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      className={className}
      style={{ opacity: 0, ...style }}
    />
  )
}
