'use client';

import { ChefHat, DoorOpen, Wine } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/cn';

export type FloorTable = { id: string; label: number; seats: number; x: number; y: number; shape: 'square' | 'round'; status: string; section?: string; needsAttention?: boolean };
type Rect = { x: number; y: number; w: number; h: number };
export type FloorLayout = {
  walls?: boolean;
  kitchen?: Rect;
  bar?: Rect & { stools?: number; vertical?: boolean };
  booth?: Rect;
  plants?: [number, number][];
  entrance?: { x: number; w: number };
  featured?: boolean;
};
export type Floor = { id: string; nameAr: string; nameEn: string; sort: number; layout: FloorLayout; tables: FloorTable[] };

// One status scheme everywhere (Tables reference): occupied orange, available green, cleaning violet, out of service grey, attention red.
export const TABLE_COLORS: Record<string, { fill: string; chair: string; dot: string }> = {
  occupied: { fill: '#F8651D', chair: '#F9B48C', dot: 'bg-accent' },
  available: { fill: '#238A4B', chair: '#8CC7A2', dot: 'bg-success-table' },
  cleaning: { fill: '#6B55E9', chair: '#B7ABF4', dot: 'bg-violet' },
  out_of_service: { fill: '#807F80', chair: '#C4C3C4', dot: 'bg-neutral' },
  attention: { fill: '#E5484D', chair: '#F2A3A5', dot: 'bg-danger' },
};

export const W = 1000;
export const H = 700;

function Plant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} aria-hidden>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx={0} cy={-11} rx={6} ry={13} fill={a % 120 ? '#6FA35A' : '#4E8A3E'} transform={`rotate(${a})`} />
      ))}
      <circle r={5} fill="#3F7431" />
    </g>
  );
}

function Chair({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) {
  return <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={4} fill={color} />;
}

function TableShape({ t, selected, compact, onSelect, disabled }: { t: FloorTable; selected: boolean; compact?: boolean; onSelect?: (t: FloorTable) => void; disabled?: boolean }) {
  const { t: tr } = useI18n();
  const key = t.needsAttention ? 'attention' : t.status;
  const c = TABLE_COLORS[key] ?? TABLE_COLORS.available!;
  const round = t.shape === 'round';
  const size = round ? (t.seats >= 6 ? 64 : 58) : t.seats <= 2 ? 50 : t.seats >= 6 ? 66 : 56;
  const half = size / 2;
  const chairs: React.ReactNode[] = [];
  if (round) {
    const n = Math.max(t.seats, 4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const r = half + 9;
      chairs.push(<circle key={i} cx={Math.cos(a) * r} cy={Math.sin(a) * r} r={8.5} fill={c.chair} />);
    }
  } else {
    // Side chairs left/right always; top/bottom for 4+ seats.
    chairs.push(<Chair key="l" x={-half - 8} y={0} w={10} h={size * 0.62} color={c.chair} />, <Chair key="r" x={half + 8} y={0} w={10} h={size * 0.62} color={c.chair} />);
    if (t.seats >= 4) chairs.push(<Chair key="t" x={0} y={-half - 8} w={size * 0.62} h={10} color={c.chair} />, <Chair key="b" x={0} y={half + 8} w={size * 0.62} h={10} color={c.chair} />);
  }
  const label = `${tr('common.table', { n: t.label })}, ${tr(`status.${key}`)}, ${tr('tables.seats', { n: t.seats })}`;
  const interactive = !!onSelect && !disabled;
  return (
    <g
      transform={`translate(${t.x} ${t.y})${compact ? ' scale(1.45)' : ''}`}
      role={onSelect ? 'button' : 'img'}
      aria-label={label}
      aria-pressed={onSelect ? selected : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? () => onSelect!(t) : undefined}
      onKeyDown={interactive ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect!(t)) : undefined}
      className={cn('outline-none', interactive && 'cursor-pointer [&:focus-visible>.ring]:opacity-100 [&:hover>.body]:brightness-110', disabled && 'opacity-35')}
    >
      <title>{label}</title>
      <g>{chairs}</g>
      {round ? (
        <circle className="ring opacity-0" r={half + 21} fill="none" stroke="#141414" strokeWidth={2.5} strokeDasharray="5 4" style={selected ? { opacity: 1 } : undefined} />
      ) : (
        <rect className="ring opacity-0" x={-half - 19} y={-half - 19} width={size + 38} height={size + 38} rx={14} fill="none" stroke="#141414" strokeWidth={2.5} strokeDasharray="5 4" style={selected ? { opacity: 1 } : undefined} />
      )}
      {round ? <circle className="body" r={half} fill={c.fill} /> : <rect className="body" x={-half} y={-half} width={size} height={size} rx={9} fill={c.fill} />}
      <text y={compact ? 6 : 7} textAnchor="middle" fontSize={compact ? 17 : 20} fontWeight={600} fill="#fff" style={{ fontFamily: 'Inter Variable, sans-serif' }}>
        {t.label}
      </text>
      {compact ? (
        <text y={half + 30} textAnchor="middle" fontSize={15} fill="#6E6B66" style={{ fontFamily: 'Inter Variable, sans-serif' }}>
          {t.seats}
        </text>
      ) : null}
    </g>
  );
}

/**
 * Restaurant floor plan. Physical layout is not mirrored in RTL (the room is the room); only labels are localized.
 * `compact` = Orders mini-map (fit to tables, seat counts under each table).
 */
export function FloorMap({
  floor,
  selectedId,
  onSelect,
  compact,
  zoom = 1,
  isDisabled,
  className,
}: {
  floor: Floor;
  selectedId?: string | null;
  onSelect?: (t: FloorTable) => void;
  compact?: boolean;
  zoom?: number;
  isDisabled?: (t: FloorTable) => boolean;
  className?: string;
}) {
  const { t, name } = useI18n();
  const L = floor.layout ?? {};
  let vb = { x: 0, y: 0, w: W, h: H };
  if (compact && floor.tables.length) {
    const xs = floor.tables.map((t) => t.x);
    const ys = floor.tables.map((t) => t.y);
    const extra = L.bar ? [L.bar.x, L.bar.x + L.bar.w] : [];
    const minX = Math.min(...xs, ...extra) - 90;
    const maxX = Math.max(...xs, ...extra) + 90;
    const minY = Math.min(...ys) - 85;
    const maxY = Math.max(...ys) + 105;
    vb = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  const cx = vb.x + vb.w / 2;
  const cy = vb.y + vb.h / 2;
  const zw = vb.w / zoom;
  const zh = vb.h / zoom;
  const viewBox = `${cx - zw / 2} ${cy - zh / 2} ${zw} ${zh}`;
  const wall = '#CDC8C0';
  return (
    <svg viewBox={viewBox} className={cn('block h-auto w-full select-none', className)} role="group" aria-label={name(floor)} preserveAspectRatio="xMidYMid meet" style={{ direction: "ltr" }}>
      <rect x={vb.x - 2000} y={vb.y - 2000} width={vb.w + 4000} height={vb.h + 4000} fill="#F7F2EC" />
      {L.walls !== false && !compact ? (
        <g aria-hidden>
          <rect x={8} y={8} width={W - 16} height={H - 16} rx={10} fill="none" stroke={wall} strokeWidth={14} />
          {L.entrance ? <rect x={L.entrance.x - L.entrance.w / 2} y={H - 22} width={L.entrance.w} height={28} fill="#F7F2EC" /> : null}
        </g>
      ) : null}
      {compact && L.walls !== false ? <rect x={vb.x + 6} y={vb.y + 6} width={vb.w - 12} height={vb.h - 12} rx={12} fill="none" stroke={wall} strokeWidth={8} aria-hidden /> : null}
      {L.kitchen && !compact ? (
        <g aria-hidden>
          <rect x={L.kitchen.x} y={L.kitchen.y} width={L.kitchen.w} height={L.kitchen.h} rx={4} fill="#DCD9D5" />
          <foreignObject x={L.kitchen.x} y={L.kitchen.y} width={L.kitchen.w} height={L.kitchen.h}>
            <div className="flex h-full items-center justify-center gap-2 text-[17px] text-ink">
              <ChefHat className="size-6" strokeWidth={1.6} />
              {t('tables.kitchen')}
            </div>
          </foreignObject>
        </g>
      ) : null}
      {L.bar ? (
        <g aria-hidden>
          <rect x={L.bar.x} y={L.bar.y} width={L.bar.w} height={L.bar.h} rx={8} fill="#E3DFDA" stroke="#D2CDC6" />
          <foreignObject x={L.bar.x} y={L.bar.y} width={L.bar.w} height={L.bar.vertical ? L.bar.h * 0.55 : L.bar.h}>
            <div className={cn('flex h-full items-center justify-center gap-1.5 text-ink', compact ? 'text-[26px]' : 'text-[15px]')}>
              {!compact ? <Wine className="size-4" strokeWidth={1.6} /> : null}
              {t('tables.bar')}
            </div>
          </foreignObject>
          {Array.from({ length: L.bar.stools ?? 0 }, (_, i) => {
            const n = L.bar!.stools!;
            const sx = L.bar!.vertical ? L.bar!.x + ((i + 1) * L.bar!.w) / (n + 1) : L.bar!.x + ((i + 0.5) * L.bar!.w) / n;
            const sy = L.bar!.vertical ? L.bar!.y + L.bar!.h * 0.75 : L.bar!.y + L.bar!.h + 22;
            return <ellipse key={i} cx={sx} cy={sy} rx={L.bar!.vertical ? 13 : 17} ry={L.bar!.vertical ? 13 : 12} fill={L.bar!.vertical ? '#F2EFEB' : '#E1B98F'} stroke="#D2B08C" />;
          })}
        </g>
      ) : null}
      {L.booth && !compact ? <rect x={L.booth.x} y={L.booth.y} width={L.booth.w} height={L.booth.h} rx={6} fill="#EDE6DD" stroke="#CFC6BA" strokeWidth={6} aria-hidden /> : null}
      {(L.plants ?? []).map(([x, y], i) => (
        <Plant key={i} x={x} y={y} s={compact ? 1.4 : 1.25} />
      ))}
      {L.entrance && !compact ? (
        <foreignObject x={L.entrance.x - 90} y={H - 40} width={180} height={30} aria-hidden>
          <div className="flex h-full items-center justify-center gap-1.5 text-[14px] text-ink">
            <DoorOpen className="size-4" strokeWidth={1.6} />
            {t('tables.entrance')}
          </div>
        </foreignObject>
      ) : null}
      {floor.tables.map((tb) => (
        <TableShape key={tb.id} t={tb} compact={compact} selected={tb.id === selectedId} onSelect={onSelect} disabled={isDisabled?.(tb)} />
      ))}
    </svg>
  );
}

export function FloorLegend({ attention = true, className }: { attention?: boolean; className?: string }) {
  const { t } = useI18n();
  const keys = ['occupied', 'available', 'cleaning', 'out_of_service', ...(attention ? ['attention'] : [])];
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted', className)} aria-label={t('tables.legend')}>
      {keys.map((k) => (
        <li key={k} className="flex items-center gap-2">
          <span className={cn('size-2.5 rounded-full', TABLE_COLORS[k]!.dot)} aria-hidden />
          {t(`status.${k}`)}
        </li>
      ))}
    </ul>
  );
}
