import { AUSTRALIA_SVG_PATHS } from '@/lib/geo/australia-path';
import { AU_MAP, mapDots } from '@/lib/geo/project';
import type { PostcodeRow } from '@/lib/aggregate';
import { CHECK_REPORT_INK, CHECK_REPORT_YELLOW } from '@/lib/report-spec';

export function BuyerMap({
  postcodes,
  width = AU_MAP.width,
  height = AU_MAP.height,
}: {
  postcodes: PostcodeRow[];
  width?: number;
  height?: number;
}) {
  const dots = mapDots(postcodes, 10);
  if (dots.length === 0) {
    return <p style={{ fontSize: 12, color: '#5A5A57', margin: 0 }}>No mapped Australian postcodes in this check.</p>;
  }

  return (
    <svg
      viewBox={`0 0 ${AU_MAP.width} ${AU_MAP.height}`}
      width={width}
      height={height}
      role="img"
      aria-label="Buyer postcodes on a map of Australia"
      style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
    >
      {AUSTRALIA_SVG_PATHS.map((d) => (
        <path key={d.slice(0, 24)} d={d} fill="#F4F4F2" stroke="#C8C8C4" strokeWidth={1} />
      ))}
      {dots.map((dot) => (
        <g key={dot.postcode}>
          <circle cx={dot.x} cy={dot.y} r={dot.r} fill={CHECK_REPORT_YELLOW} stroke={CHECK_REPORT_INK} strokeWidth={0.8} />
          <text
            x={dot.x + dot.r + 3}
            y={dot.y + 3}
            fontSize={9}
            fill={CHECK_REPORT_INK}
            fontFamily="Montserrat, system-ui, sans-serif"
          >
            {dot.postcode}
          </text>
        </g>
      ))}
    </svg>
  );
}
