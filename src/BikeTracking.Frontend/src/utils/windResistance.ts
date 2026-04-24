import type { CompassDirection } from "../services/ridesService";

const COMPASS_DEGREES: Record<CompassDirection, number> = {
  North: 0,
  NE: 45,
  East: 90,
  SE: 135,
  South: 180,
  SW: 225,
  West: 270,
  NW: 315,
};

function shorterArc(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return diff > 180 ? 360 - diff : diff;
}

export function calculateWindResistance(
  windSpeedMph: number,
  travelDirection: CompassDirection,
  windFromDeg: number
): number {
  const travelDeg = COMPASS_DEGREES[travelDirection];
  const angleDeg = shorterArc(travelDeg, windFromDeg);
  const angleRad = (angleDeg * Math.PI) / 180;
  const raw = (windSpeedMph * Math.cos(angleRad)) / 5;
  const rounded = Math.round(raw);
  return Math.max(-4, Math.min(4, rounded));
}

export function resistanceToDifficulty(resistance: number): number {
  if (resistance <= -3) return 1;
  if (resistance === -2 || resistance === -1) return 2;
  if (resistance === 0) return 3;
  if (resistance === 1 || resistance === 2) return 4;
  return 5;
}

/** Returns a suggested difficulty (1-5) given ride wind data. Returns null when insufficient data. */
export function suggestDifficulty(
  windSpeedMph: number | undefined,
  travelDirection: CompassDirection,
  windFromDeg: number | undefined
): number | null {
  // FR-012: zero or missing wind speed → calm conditions → difficulty 1
  if (!windSpeedMph || windSpeedMph === 0) return 1;
  if (windFromDeg === undefined) return null;
  const resistance = calculateWindResistance(windSpeedMph, travelDirection, windFromDeg);
  return resistanceToDifficulty(resistance);
}
