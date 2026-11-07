/** Already formatted texts for one sample card, plus how full the meter is (0..1). */
export interface CardContent {
  gameName: string;
  timeText: string;
  spotsText: string;
  spotsFill: number;
}

/** Colours and fonts, read from the app's CSS custom properties so the palette is not copied. */
export interface CardStyle {
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentTint: string;
  headingFont: string;
  bodyFont: string;
}

export const CARD_CANVAS_WIDTH = 640;
export const CARD_CANVAS_HEIGHT = 400;
const PADDING = 48;
const RADIUS = 40;
// The visible border is 3px: the stroke is centred on the edge, so the outer half is clipped away.
const STROKE_WIDTH = 6;
const PILL_HEIGHT = 56;
const PILL_PADDING = 24;
const METER_HEIGHT = 12;
const NAME_SIZE = 60;
const SMALL_SIZE = 30;
/** Fraction of the font size from the visual centre of a line to its baseline. */
const BASELINE_FROM_CENTER = 1 / 3;
const TEXT_ABOVE_METER = SMALL_SIZE / 2;

export function readCardStyle(element: Element): CardStyle {
  const styles = getComputedStyle(element);
  const read = (name: string) => styles.getPropertyValue(name).trim();
  return {
    surface: read("--color-bg-raised"),
    border: read("--color-border"),
    text: read("--color-text"),
    muted: read("--color-muted"),
    accent: read("--color-accent"),
    accentTint: read("--color-accent-tint"),
    headingFont: read("--font-heading"),
    bodyFont: read("--font-sans"),
  };
}

/** Path with arcTo: ctx.roundRect is missing in older browsers, and the fallback must never be blank. */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/** Paints one card, the picture of a lobby: time pill, game name, players text and meter. */
export function paintLobbyCard(
  canvas: HTMLCanvasElement,
  content: CardContent,
  style: CardStyle,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.textBaseline = "alphabetic";

  roundedRect(ctx, 0, 0, width, height, RADIUS);
  ctx.fillStyle = style.surface;
  ctx.fill();
  ctx.lineWidth = STROKE_WIDTH;
  ctx.strokeStyle = style.border;
  ctx.save();
  ctx.clip();
  ctx.stroke();
  ctx.restore();

  ctx.font = `600 ${SMALL_SIZE}px ${style.bodyFont}`;
  const pillWidth = ctx.measureText(content.timeText).width + PILL_PADDING * 2;
  roundedRect(ctx, PADDING, PADDING, pillWidth, PILL_HEIGHT, PILL_HEIGHT);
  ctx.fillStyle = style.accentTint;
  ctx.fill();
  ctx.fillStyle = style.accent;
  ctx.fillText(
    content.timeText,
    PADDING + PILL_PADDING,
    PADDING + PILL_HEIGHT / 2 + SMALL_SIZE * BASELINE_FROM_CENTER,
  );

  const contentWidth = width - PADDING * 2;
  ctx.font = `600 ${NAME_SIZE}px ${style.headingFont}`;
  ctx.fillStyle = style.text;
  ctx.fillText(
    content.gameName,
    PADDING,
    height / 2 + NAME_SIZE * BASELINE_FROM_CENTER,
    contentWidth,
  );

  ctx.font = `500 ${SMALL_SIZE}px ${style.bodyFont}`;
  ctx.fillStyle = style.muted;
  const meterY = height - PADDING - METER_HEIGHT;
  ctx.fillText(content.spotsText, PADDING, meterY - TEXT_ABOVE_METER);

  roundedRect(ctx, PADDING, meterY, contentWidth, METER_HEIGHT, METER_HEIGHT);
  ctx.fillStyle = style.border;
  ctx.fill();
  roundedRect(
    ctx,
    PADDING,
    meterY,
    contentWidth * content.spotsFill,
    METER_HEIGHT,
    METER_HEIGHT,
  );
  ctx.fillStyle = style.accent;
  ctx.fill();
}
