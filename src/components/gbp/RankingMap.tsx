// Mapa de ranking em grade sobre tiles do OpenStreetMap (sem biblioteca de mapas).

type Point = { row: number; col: number; lat: number; lng: number; position: number | null };

const TILE = 256;
const SIZE = 360;

// Verde (top 3), dourado (4º a 10º), bronze (11º a 20º) e vermelho (fora).
export const positionColor = (position: number | null) =>
  position === null ? '#B42318' : position <= 3 ? '#1F7A4D' : position <= 10 ? '#C9A227' : '#A0602A';

// Texto preto sobre o dourado (legível); branco nos demais.
const positionTextColor = (position: number | null) => (position !== null && position > 3 && position <= 10 ? '#111111' : '#ffffff');

const project = (lat: number, lng: number, zoom: number) => {
  const scale = TILE * 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale,
  };
};

// Maior zoom em que a grade inteira cabe no quadro com folga.
function pickZoom(points: Point[]) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  for (let zoom = 16; zoom >= 10; zoom--) {
    const a = project(Math.max(...lats), Math.min(...lngs), zoom);
    const b = project(Math.min(...lats), Math.max(...lngs), zoom);
    if (Math.abs(b.x - a.x) <= SIZE * 0.75 && Math.abs(b.y - a.y) <= SIZE * 0.75) return zoom;
  }
  return 10;
}

export function RankingMap({ points, center }: { points: Point[]; center: { lat: number; lng: number } }) {
  const zoom = pickZoom(points);
  const middle = Math.floor(Math.sqrt(points.length) / 2);
  const c = project(center.lat, center.lng, zoom);
  const origin = { x: c.x - SIZE / 2, y: c.y - SIZE / 2 };
  const tiles: { x: number; y: number }[] = [];
  for (let tx = Math.floor(origin.x / TILE); tx <= Math.floor((origin.x + SIZE) / TILE); tx++) {
    for (let ty = Math.floor(origin.y / TILE); ty <= Math.floor((origin.y + SIZE) / TILE); ty++) {
      tiles.push({ x: tx, y: ty });
    }
  }
  const radius = points.length > 9 ? 15 : 18;

  return (
    <div className="space-y-1">
      <div className="relative overflow-hidden rounded-lg border bg-muted" style={{ width: SIZE, height: SIZE, maxWidth: '100%' }}>
        {tiles.map((t) => (
          <img
            key={`${t.x}-${t.y}`}
            src={`https://tile.openstreetmap.org/${zoom}/${t.x}/${t.y}.png`}
            alt=""
            draggable={false}
            className="absolute select-none"
            style={{ left: t.x * TILE - origin.x, top: t.y * TILE - origin.y, width: TILE, height: TILE }}
          />
        ))}
        <svg className="absolute inset-0" width={SIZE} height={SIZE}>
          {points.map((p) => {
            const pos = project(p.lat, p.lng, zoom);
            const x = pos.x - origin.x;
            const y = pos.y - origin.y;
            const isCenter = p.row === middle && p.col === middle;
            return (
              <g key={`${p.row}-${p.col}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={positionColor(p.position)}
                  fillOpacity={0.9}
                  stroke={isCenter ? '#111827' : '#ffffff'}
                  strokeWidth={isCenter ? 3 : 2}
                />
                <text x={x} y={y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill={positionTextColor(p.position)}>
                  {p.position ?? '20+'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Mapa ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">
          OpenStreetMap
        </a>{' '}
        · ponto com borda escura = endereço do negócio
      </p>
    </div>
  );
}
