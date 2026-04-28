import React, { useEffect, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useDimensions } from "@/components/hooks/use-debounced-dimensions"

const PixelTrail = ({
  pixelSize = 20,
  fadeDuration = 500,
  delay = 0,
  className,
  pixelColor = "currentColor", // Now uses color directly
}) => {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const dimensions = useDimensions(containerRef)
  
  // Keep track of active pixels to draw
  // Using a Map for O(1) lookups and updates
  const activePixels = useRef(new Map())
  const rafRef = useRef(null)

  const draw = useCallback((timestamp) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Set fill color - we'll handle opacity manually
    ctx.fillStyle = pixelColor

    const now = performance.now()
    
    // Iterate and draw active pixels
    for (const [key, startTime] of activePixels.current.entries()) {
      const elapsed = now - startTime - delay
      
      if (elapsed < 0) {
        // Pixel is in delay phase, draw nothing yet or handle as you like
        continue
      }

      const progress = Math.min(elapsed / fadeDuration, 1)
      const opacity = 1 - progress

      if (opacity <= 0) {
        activePixels.current.delete(key)
        continue
      }

      const [x, y] = key.split("-").map(Number)
      
      ctx.globalAlpha = opacity
      ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize)
    }

    if (activePixels.current.size > 0) {
      rafRef.current = requestAnimationFrame(draw)
    } else {
      rafRef.current = null
    }
  }, [pixelSize, fadeDuration, delay, pixelColor])

  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current || !canvasRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / pixelSize)
    const y = Math.floor((e.clientY - rect.top) / pixelSize)

    const key = `${x}-${y}`
    const now = performance.now()
    
    activePixels.current.set(key, now)

    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(draw)
    }
  }, [pixelSize, draw])

  // Sync canvas size with container
  useEffect(() => {
    if (canvasRef.current && dimensions.width && dimensions.height) {
      canvasRef.current.width = dimensions.width
      canvasRef.current.height = dimensions.height
      // Trigger a redraw if we have active pixels
      if (activePixels.current.size > 0 && !rafRef.current) {
        rafRef.current = requestAnimationFrame(draw)
      }
    }
  }, [dimensions, draw])

  // Cleanup
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute inset-0 w-full h-full pointer-events-auto",
        className
      )}
      onMouseMove={handleMouseMove}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
      />
    </div>
  )
}

export { PixelTrail }
