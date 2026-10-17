const POINTS =
  "0,150 60,148 120,146 180,141 240,143 300,134 360,136 420,126 480,129 540,117 600,121 660,108 720,112 780,96 840,101 900,86 960,90 1020,72 1080,79 1140,58 1200,64 1260,42 1320,47 1380,22 1440,14";

/** The cumulative line that draws itself along the bottom of the landing. */
export function SignatureLine() {
  return (
    <svg
      viewBox="0 0 1440 160"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="mt-8 block h-28 w-full"
    >
      <polyline
        className="signature-line"
        pathLength={1}
        points={POINTS}
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
