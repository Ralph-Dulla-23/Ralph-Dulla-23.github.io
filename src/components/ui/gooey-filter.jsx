const GooeyFilter = ({
  id = "goo-filter",
  strength = 4, // Reduced from 10 for performance
}) => {
  return (
    <svg className="hidden absolute">
      <defs>
        <filter id={id} colorInterpolationFilters="sRGB">
          <feGaussianBlur
            in="SourceGraphic"
            stdDeviation={strength}
            result="blur"
          />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
    </svg>
  )
}

export { GooeyFilter }
