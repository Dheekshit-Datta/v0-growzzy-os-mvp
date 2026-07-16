'use client'

import { useEffect, useRef } from 'react'

const FADE_MS = 500
const FADE_OUT_LEAD = 0.55 // seconds

interface FadingVideoProps {
  src: string
  className?: string
  style?: React.CSSProperties
}

export function FadingVideo({ src, className, style }: FadingVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const rafRef = useRef<number | null>(null)
  const fadingOutRef = useRef(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const fadeTo = (target: number, duration: number) => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      const start = performance.now()
      const from = parseFloat(video.style.opacity || '0')
      const delta = target - from

      const tick = (now: number) => {
        const elapsed = now - start
        const t = Math.min(elapsed / duration, 1)
        video.style.opacity = String(from + delta * t)
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          rafRef.current = null
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    const onLoadedData = () => {
      console.log('[v0] FadingVideo: loadeddata')
      video.style.opacity = '0'
      void video.play()
      fadeTo(1, FADE_MS)
    }

    const onTimeUpdate = () => {
      const remaining = video.duration - video.currentTime
      if (!fadingOutRef.current && remaining <= FADE_OUT_LEAD && remaining > 0) {
        fadingOutRef.current = true
        fadeTo(0, FADE_MS)
      }
    }

    const onEnded = () => {
      video.style.opacity = '0'
      setTimeout(() => {
        video.currentTime = 0
        void video.play()
        fadingOutRef.current = false
        fadeTo(1, FADE_MS)
      }, 100)
    }

    const onError = () => console.log('[v0] FadingVideo: error', video.error)
    const onStalled = () => console.log('[v0] FadingVideo: stalled')

    video.style.opacity = '0'
    video.addEventListener('loadeddata', onLoadedData)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('ended', onEnded)
    video.addEventListener('error', onError)
    video.addEventListener('stalled', onStalled)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      video.removeEventListener('loadeddata', onLoadedData)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('error', onError)
      video.removeEventListener('stalled', onStalled)
    }
  }, [])

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      muted
      playsInline
      preload="auto"
      className={className}
      style={{ opacity: 0, ...style }}
    />
  )
}
