interface ResourceCurveProps {
  label: string;
  values: number[];
}

const WIDTH = 172;
const HEIGHT = 34;

function toPoints(values: number[]): string {
  if (values.length === 0) return `0,${HEIGHT}`;
  const step = values.length > 1 ? WIDTH / (values.length - 1) : WIDTH;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = HEIGHT - (Math.max(0, Math.min(100, value)) / 100) * HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function ResourceCurve({ label, values }: ResourceCurveProps) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={label}
      className="h-7 w-full overflow-visible text-[var(--app-accent)]"
      preserveAspectRatio="none"
    >
      <line
        x1="0"
        y1={HEIGHT - 0.5}
        x2={WIDTH}
        y2={HEIGHT - 0.5}
        stroke="var(--app-border-subtle)"
        strokeWidth="1"
      />
      <polyline
        points={toPoints(values)}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
