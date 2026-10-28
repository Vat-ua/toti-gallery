export type CoverFraming = { x: number; y: number; zoom: number };
export const DEFAULT_COVER_FRAMING: CoverFraming = { x: 50, y: 0, zoom: 1 };
export const COVER_MAX_ZOOM = 3;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function validateCoverFraming(value: unknown): CoverFraming | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("O enquadramento da capa é inválido.");
  const frame = value as Record<string, unknown>;
  if (Object.keys(frame).length !== 3 || !["x", "y", "zoom"].every(key => typeof frame[key] === "number" && Number.isFinite(frame[key]))) throw new Error("O enquadramento da capa é inválido.");
  const { x, y, zoom } = frame as CoverFraming;
  if (x < 0 || x > 100 || y < 0 || y > 100 || zoom < 1 || zoom > COVER_MAX_ZOOM) throw new Error("O enquadramento da capa está fora dos limites permitidos.");
  return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, zoom: Math.round(zoom * 1000) / 1000 };
}

/** The same percentages drive object-position and transform-origin in CSS. */
export function moveCoverFraming(frame: CoverFraming, dx: number, dy: number, imageWidth: number, imageHeight: number, width: number, height: number): CoverFraming {
  if (![imageWidth, imageHeight, width, height].every(value => Number.isFinite(value) && value > 0)) return frame;
  const scale = Math.max(width / imageWidth, height / imageHeight) * frame.zoom;
  const overflowX = Math.max(0, imageWidth * scale - width);
  const overflowY = Math.max(0, imageHeight * scale - height);
  return { ...frame,
    x: overflowX > .01 ? clamp(frame.x - dx / overflowX * 100, 0, 100) : frame.x,
    y: overflowY > .01 ? clamp(frame.y - dy / overflowY * 100, 0, 100) : frame.y,
  };
}
