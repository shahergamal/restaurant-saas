/** Tiny trend line (Food Cost table). Colour follows direction unless overridden. */
export function Sparkline({ values, tone, width = 56, height = 22, label }: { values: number[]; tone?: 'up' | 'down' | 'flat'; width?: number; height?: number; label?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 3 - ((v - min) / span) * (height - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const dir = tone ?? (values.at(-1)! > values[0]! ? 'up' : values.at(-1)! < values[0]! ? 'down' : 'flat');
  const color = dir === 'up' ? 'rgb(var(--success))' : dir === 'down' ? 'rgb(var(--danger))' : 'rgb(var(--warning))';
  const [lx, ly] = pts.at(-1)!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={2} fill={color} />
    </svg>
  );
}
