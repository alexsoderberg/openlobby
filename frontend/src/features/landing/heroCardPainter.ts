/** Already formatted texts for one hero card, plus the numbers behind the spot squares and the meter. */
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
  /** The card edge and the meter track. */
  border: string;
  /** The outline of a free spot: a control line, so it reads at 3:1 (WCAG 1.4.11). */
  line: string;
  text: string;
  muted: string;
  headingFont: string;
  bodyFont: string;
}

export const CARD_CANVAS_WIDTH = 640;
export const CARD_CANVAS_HEIGHT = 400;
// Sizes are in canvas pixels. A phone shows the card about 200 CSS px wide, so the small text is 40 px here.
const CARD_PADDING = 40;
// About the app's --radius at the size the card is shown.
const RADIUS = 16;
const SPOT_RADIUS = 6;
// The stroke is centred on the edge and the outer half is clipped away, so the visible edge is half of it.
const STROKE_WIDTH = 4;
const TIME_SIZE = 104;
const TIME_BASELINE = 124;
const NAME_SIZE = 44;
const NAME_BASELINE = 186;
const NAME_MAX_WIDTH = CARD_CANVAS_WIDTH - CARD_PADDING * 2;
const SMALL_SIZE = 40;
// The weights the page already loads (the headline and the buttons), so the canvas never paints a fallback font.
const WEIGHT_HEAVY = 800;
const WEIGHT_STRONG = 600;
const WEIGHT_TEXT = 400;
const SPOT_SIZE = 34;
const SPOT_GAP = 12;
const SPOT_ROW_TOP = 222;
const METER_HEIGHT = 12;
const SPOTS_TEXT_GAP = 18;

export function readCardStyle(element: Element): CardStyle {
  const styles = getComputedStyle(element);
  const read = (name: string) => styles.getPropertyValue(name).trim();
  return {
    surface: read("--color-surface"),
    border: read("--color-rule"),
    line: read("--color-control-line"),
    text: read("--color-text"),
    muted: read("--color-muted"),
    headingFont: read("--font-heading"),
    bodyFont: read("--font-text"),
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

/** A full card takes the text colour on its edge, as a seat I hold does in the app. No glow (ADR 0028 section 7). */
function paintFrame(
  ctx: CanvasRenderingContext2D,
  full: boolean,
  style: CardStyle,
) {
  roundedRect(ctx, 0, 0, CARD_CANVAS_WIDTH, CARD_CANVAS_HEIGHT, RADIUS);
  ctx.fillStyle = style.surface;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.lineWidth = STROKE_WIDTH;
  ctx.strokeStyle = full ? style.text : style.border;
  ctx.stroke();
  ctx.restore();
}

/** One square per spot, as the app's avatars: filled for a player who has arrived, an outline for a free spot. */
function paintSpots(
  ctx: CanvasRenderingContext2D,
  content: CardContent,
  style: CardStyle,
) {
  ctx.lineWidth = STROKE_WIDTH / 2;
  for (let spot = 0; spot < content.maxCount; spot++) {
    const x = CARD_PADDING + spot * (SPOT_SIZE + SPOT_GAP);
    roundedRect(ctx, x, SPOT_ROW_TOP, SPOT_SIZE, SPOT_SIZE, SPOT_RADIUS);
    if (spot < content.count) {
      ctx.fillStyle = style.text;
      ctx.fill();
    } else {
      ctx.strokeStyle = style.line;
      ctx.stroke();
    }
  }
}

/** The players text above a meter that fills with the count. */
function paintMeter(
  ctx: CanvasRenderingContext2D,
  content: CardContent,
  style: CardStyle,
) {
  const meterWidth = CARD_CANVAS_WIDTH - CARD_PADDING * 2;
  const meterY = CARD_CANVAS_HEIGHT - CARD_PADDING - METER_HEIGHT;
  ctx.font = `${WEIGHT_TEXT} ${SMALL_SIZE}px ${style.bodyFont}`;
  ctx.fillStyle = style.muted;
  ctx.fillText(content.spotsText, CARD_PADDING, meterY - SPOTS_TEXT_GAP);

  ctx.fillStyle = style.border;
  ctx.fillRect(CARD_PADDING, meterY, meterWidth, METER_HEIGHT);
  ctx.fillStyle = style.text;
  ctx.fillRect(
    CARD_PADDING,
    meterY,
    (meterWidth * content.count) / content.maxCount,
    METER_HEIGHT,
  );
}

/** Paints one hero card: the start time large, as the line-up shows it, then game name, spots, players text and meter. */
export function paintHeroCard(
  canvas: HTMLCanvasElement,
  content: CardContent,
  style: CardStyle,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, CARD_CANVAS_WIDTH, CARD_CANVAS_HEIGHT);
  ctx.textBaseline = "alphabetic";
  paintFrame(ctx, content.count >= content.maxCount, style);

  ctx.fillStyle = style.text;
  ctx.font = `${WEIGHT_HEAVY} ${TIME_SIZE}px ${style.headingFont}`;
  ctx.fillText(content.timeText, CARD_PADDING, TIME_BASELINE, NAME_MAX_WIDTH);
  ctx.font = `${WEIGHT_STRONG} ${NAME_SIZE}px ${style.bodyFont}`;
  ctx.fillText(content.gameName, CARD_PADDING, NAME_BASELINE, NAME_MAX_WIDTH);

  paintSpots(ctx, content, style);
  paintMeter(ctx, content, style);
}
