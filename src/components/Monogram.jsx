/** The PMCC block, redrawn as crisp SVG from the profile's red logo. */
export default function Monogram({ className = "h-8" }) {
  return (
    <svg viewBox="0 0 96 40" className={className} aria-label="PMCC">
      <rect width="96" height="40" fill="#C8102E" />
      <text
        x="48"
        y="27.5"
        textAnchor="middle"
        fill="#EFE9DD"
        style={{
          font: "800 19px 'Inter Variable', system-ui, sans-serif",
          letterSpacing: "0.06em",
        }}
      >
        PMCC
      </text>
    </svg>
  );
}
