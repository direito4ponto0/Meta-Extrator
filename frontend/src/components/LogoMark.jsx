export default function LogoMark({ size = 32, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Magnifying glass lens */}
      <circle cx="17" cy="17" r="13" stroke="currentColor" strokeWidth="3" fill="none" />
      {/* Handle */}
      <line
        x1="26.5"
        y1="26.5"
        x2="36"
        y2="36"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="square"
      />
      {/* Letter M inside the lens */}
      <text
        x="17"
        y="22.5"
        textAnchor="middle"
        fontFamily="Montserrat, sans-serif"
        fontWeight="900"
        fontSize="14"
        fill="currentColor"
        letterSpacing="-0.5"
      >
        M
      </text>
    </svg>
  );
}
