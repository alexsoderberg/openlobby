/** Already formatted texts for one hero card, plus the numbers behind the avatars and the meter. */
export interface CardContent {
  gameName: string;
  timeText: string;
  spotsText: string;
  count: number;
  maxCount: number;
}

/** Colours and fonts, read from the app's CSS custom properties so the palette is not copied. */
export interface CardStyle {
  surface: string;
  border: string;
  text: string;
  /** The lighter muted text for plates that carry a genre pattern. */
  muted: string;
  /** Border, halo and meter of a full card. */
  glow: string;
  headingFont: string;
  bodyFont: string;
}

/** The genre's look: its accent colour and the art that sits on the card. A missing image is left out. */
export interface CardTheme {
  accent: string;
  pattern?: HTMLImageElement;
  icon?: HTMLImageElement;
}

export const CARD_CANVAS_WIDTH = 640;
export const CARD_CANVAS_HEIGHT = 400;
// Sizes are in canvas pixels. A phone shows the card about 200 CSS px wide, so the small text is 42 px here.
export const CARD_PADDING = 40;
const RADIUS = 40;
// The visible border is 3px: the stroke is centred on the edge, so the outer half is clipped away.
const STROKE_WIDTH = 6;
const PILL_HEIGHT = 68;
const PILL_PADDING = 26;
const METER_HEIGHT = 14;
const NAME_SIZE = 56;
const SMALL_SIZE = 42;
const WEIGHT_STRONG = 600;
const WEIGHT_MEDIUM = 500;
/** Keeps the name clear of the 3D motif, which floats over the right of the card. */
const NAME_MAX_WIDTH = 360;
const NAME_BASELINE = 176;
const ICON_SIZE = PILL_HEIGHT;
const AVATAR_RADIUS = 17;
const AVATAR_GAP = 12;
const AVATAR_ROW_Y = 232;
const AVATAR_OUTLINE_WIDTH = STROKE_WIDTH / 2;
const SPOTS_TEXT_GAP = 18;
export const CARD_TINT_ALPHA = 0.08;
/** The full-state halo: the canvas blur has a sigma of half this value. The contrast test derives its bound from it. */
export const GLOW_BLUR = 24;
export const FULL_STROKE_WIDTH = 14;
/** Fraction of the font size from the visual centre of a line to its baseline. */
const BASELINE_FROM_CENTER = 1 / 3;

export function readCardStyle(element: Element): CardStyle {
  const styles = getComputedStyle(element);
  const read = (name: string) => styles.getPropertyValue(name).trim();
  return {
    surface: read("--color-bg-raised"),
    border: read("--color-border"),
    text: read("--color-text"),
    muted: read("--color-muted-themed"),
    glow: read("--color-online"),
    headingFont: read("--font-heading"),
    bodyFont: read("--font-sans"),
  };
}

/** A custom property's value, for the accent of a genre (`GenreTheme.accentVar`). */
export const readCssValue = (element: Element, name: string) =>
  getComputedStyle(element).getPropertyValue(name).trim();

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

function paintFrame(
  ctx: CanvasRenderingContext2D,
  full: boolean,
  style: CardStyle,
) {
  roundedRect(ctx, 0, 0, CARD_CANVAS_WIDTH, CARD_CANVAS_HEIGHT, RADIUS);
  ctx.fillStyle = style.surface;
  ctx.fill();
  // The stroke is centred on the edge, so the outer half is clipped away.
  ctx.save();
  ctx.clip();
  ctx.lineWidth = full ? FULL_STROKE_WIDTH : STROKE_WIDTH;
  ctx.strokeStyle = full ? style.glow : style.border;
  if (full) {
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = GLOW_BLUR;
  }
  ctx.stroke();
  ctx.restore();
}

function paintArt(ctx: CanvasRenderingContext2D, theme: CardTheme) {
  const tile = theme.pattern && ctx.createPattern(theme.pattern, "repeat");
  if (tile) {
    ctx.save();
    roundedRect(ctx, 0, 0, CARD_CANVAS_WIDTH, CARD_CANVAS_HEIGHT, RADIUS);
    ctx.clip();
    ctx.fillStyle = tile;
    ctx.fillRect(0, 0, CARD_CANVAS_WIDTH, CARD_CANVAS_HEIGHT);
    ctx.restore();
  }
  if (theme.icon)
    ctx.drawImage(
      theme.icon,
      CARD_CANVAS_WIDTH - CARD_PADDING - ICON_SIZE,
      CARD_PADDING,
      ICON_SIZE,
      ICON_SIZE,
    );
}

/** The time in a pill tinted with the genre accent. */
function paintTimePill(
  ctx: CanvasRenderingContext2D,
  timeText: string,
  style: CardStyle,
  theme: CardTheme,
) {
  ctx.font = `${WEIGHT_STRONG} ${SMALL_SIZE}px ${style.bodyFont}`;
  const width = ctx.measureText(timeText).width + PILL_PADDING * 2;
  roundedRect(ctx, CARD_PADDING, CARD_PADDING, width, PILL_HEIGHT, PILL_HEIGHT);
  ctx.save();
  ctx.globalAlpha = CARD_TINT_ALPHA;
  ctx.fillStyle = theme.accent;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = theme.accent;
  ctx.fillText(
    timeText,
    CARD_PADDING + PILL_PADDING,
    CARD_PADDING + PILL_HEIGHT / 2 + SMALL_SIZE * BASELINE_FROM_CENTER,
  );
}

/** One dot per spot: filled for a player who has arrived, an outline for a free spot. No photo, no name. */
function paintAvatars(
  ctx: CanvasRenderingContext2D,
  content: CardContent,
  style: CardStyle,
  theme: CardTheme,
) {
  ctx.lineWidth = AVATAR_OUTLINE_WIDTH;
  for (let spot = 0; spot < content.maxCount; spot++) {
    ctx.beginPath();
    ctx.arc(
      CARD_PADDING + AVATAR_RADIUS + spot * (AVATAR_RADIUS * 2 + AVATAR_GAP),
      AVATAR_ROW_Y,
      AVATAR_RADIUS,
      0,
      Math.PI * 2,
    );
    if (spot < content.count) {
      ctx.fillStyle = theme.accent;
      ctx.fill();
    } else {
      ctx.strokeStyle = style.border;
      ctx.stroke();
    }
  }
}

/** The players text above a meter that fills with the count. Full cards use the glow colour. */
function paintMeter(
  ctx: CanvasRenderingContext2D,
  content: CardContent,
  style: CardStyle,
  theme: CardTheme,
) {
  const meterWidth = CARD_CANVAS_WIDTH - CARD_PADDING * 2;
  const meterY = CARD_CANVAS_HEIGHT - CARD_PADDING - METER_HEIGHT;
  ctx.font = `${WEIGHT_MEDIUM} ${SMALL_SIZE}px ${style.bodyFont}`;
  ctx.fillStyle = style.muted;
  ctx.fillText(content.spotsText, CARD_PADDING, meterY - SPOTS_TEXT_GAP);

  roundedRect(
    ctx,
    CARD_PADDING,
    meterY,
    meterWidth,
    METER_HEIGHT,
    METER_HEIGHT,
  );
  ctx.fillStyle = style.border;
  ctx.fill();
  roundedRect(
    ctx,
    CARD_PADDING,
    meterY,
    (meterWidth * content.count) / content.maxCount,
    METER_HEIGHT,
    METER_HEIGHT,
  );
  ctx.fillStyle = content.count >= content.maxCount ? style.glow : theme.accent;
  ctx.fill();
}

/** Paints one hero card: time pill, genre art, game name, avatars, players text and meter. */
export function paintHeroCard(
  canvas: HTMLCanvasElement,
  content: CardContent,
  style: CardStyle,
  theme: CardTheme,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, CARD_CANVAS_WIDTH, CARD_CANVAS_HEIGHT);
  ctx.textBaseline = "alphabetic";
  paintFrame(ctx, content.count >= content.maxCount, style);
  paintArt(ctx, theme);
  paintTimePill(ctx, content.timeText, style, theme);

  ctx.font = `${WEIGHT_STRONG} ${NAME_SIZE}px ${style.headingFont}`;
  ctx.fillStyle = style.text;
  ctx.fillText(content.gameName, CARD_PADDING, NAME_BASELINE, NAME_MAX_WIDTH);

  paintAvatars(ctx, content, style, theme);
  paintMeter(ctx, content, style, theme);
}
