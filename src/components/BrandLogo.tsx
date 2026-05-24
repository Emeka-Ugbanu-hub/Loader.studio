export default function BrandLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 100"
      className="brand-logo"
      role="img"
      aria-label="loader.studio"
    >
      <g transform="translate(30, 50)">
        <rect x="19" y="-2" width="4" height="4" fill="currentColor" />
        <rect x="16.07" y="5.07" width="4" height="4" fill="currentColor" />
        <rect x="9" y="8" width="4" height="4" fill="currentColor" />
        <rect x="1.93" y="5.07" width="4" height="4" fill="currentColor" />
        <rect x="1.93" y="-9.07" width="4" height="4" fill="currentColor" />
        <rect x="9" y="-12" width="4" height="4" fill="currentColor" />
        <rect x="16.07" y="-9.07" width="4" height="4" fill="currentColor" />
        <rect x="9" y="-2" width="4" height="4" fill="currentColor" opacity="0.85" />
      </g>
      <text
        x="75"
        y="58"
        fontFamily="'Courier New', Courier, monospace"
        fontSize="28"
        fontWeight="bold"
        fill="currentColor"
        letterSpacing="1"
      >
        loader<tspan fill="currentColor">.studio</tspan>
      </text>
    </svg>
  )
}
