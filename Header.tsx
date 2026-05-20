export function HexLogo({ size = 40 }: { size?: number }) {
  const id = `hexgrad-${size}-${Math.random().toString(36).slice(2, 6)}`;
  return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00FF88" />
          <stop offset="100%" stopColor="#00D9FF" />
        </linearGradient>
      </defs>
      <polygon
        points="20,2 36,12 36,28 20,38 4,28 4,12"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="2"
      />
      <text
        x="20"
        y="27"
        textAnchor="middle"
        fontSize="18"
        fontWeight="900"
        fontFamily="Orbitron, monospace"
        fill={`url(#${id})`}
      >
        N
      </text>
    </svg>
  );
}
