import { useEffect, useState } from "react"

const SCREEN_SIZES = ["xs", "sm", "md", "lg", "xl", "2xl"]

const sizeOrder = {
  xs: 0,
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
  "2xl": 5,
}

/**
 * A class that allows for easy comparison of screen size names (xs, sm, md, lg, xl, 2xl).
 */
class ComparableScreenSize {
  constructor(value) {
    this.value = value
  }

  toString() {
    return this.value
  }

  valueOf() {
    return sizeOrder[this.value]
  }

  equals(other) {
    return this.value === other
  }

  lessThan(other) {
    return this.valueOf() < sizeOrder[other]
  }

  greaterThan(other) {
    return this.valueOf() > sizeOrder[other]
  }

  lessThanOrEqual(other) {
    return this.valueOf() <= sizeOrder[other]
  }

  greaterThanOrEqual(other) {
    return this.valueOf() >= sizeOrder[other]
  }
}

/**
 * Hook that returns the current screen size and provides comparison methods.
 * Debounced to optimize performance during window resizing.
 * 
 * @returns {ComparableScreenSize} Current screen size object with comparison methods
 */
const useScreenSize = () => {
  const [screenSize, setScreenSize] = useState("xs")

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth

      if (width >= 1536) {
        setScreenSize("2xl")
      } else if (width >= 1280) {
        setScreenSize("xl")
      } else if (width >= 1024) {
        setScreenSize("lg")
      } else if (width >= 768) {
        setScreenSize("md")
      } else if (width >= 640) {
        setScreenSize("sm")
      } else {
        setScreenSize("xs")
      }
    }

    let timeoutId
    const debouncedHandleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(handleResize, 150)
    }

    handleResize()
    window.addEventListener("resize", debouncedHandleResize)
    return () => {
      window.removeEventListener("resize", debouncedHandleResize)
      clearTimeout(timeoutId)
    }
  }, [])

  return new ComparableScreenSize(screenSize)
}

export { useScreenSize }
