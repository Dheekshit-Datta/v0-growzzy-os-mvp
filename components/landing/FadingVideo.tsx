"use client"

import { useEffect, useRef, type CSSProperties } from "react"

type Props = {
  src: string
  className?: string
  style?: CSSProperties
}

export function FadingVideo({ src, className, style }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const play = async () => {
      try {
        await video.play()
      } catch {
        // Autoplay can be blocked until user interaction; ignore.
      }
    }

    const onPause = () => {
      if (!video.ended && document.visibilityState === "visible") {
        void play()
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && video.paused) {
        void play()
      }
    }

    video.addEventListener("pause", onPause)
    document.addEventListener("visibilitychange", onVisibilityChange)

    video.load()
    void play()

    return () => {
      video.removeEventListener("pause", onPause)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [src])

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
      style={style}
    />
  )
}
