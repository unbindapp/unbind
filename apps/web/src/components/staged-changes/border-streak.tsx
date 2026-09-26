import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

// Share of the border the streak covers, from 0 to 1
const streakLengthRatio = 0.2;
// Share of the streak that fades in at its head, from 0 to 1
const tipRatio = 0.5;
const lapMs = 6000;
// One copy of the streak per blur, stacked in this order
const layerBlurs = ["blur-md", "blur-sm", "blur-xs", "blur-none"];

type TRegion = [x: number, y: number, width: number, height: number];

// A straight edge or a corner arc of the border, in drawing order. Corners take a conic
// gradient around their center, so the fade runs along the curve like it does on the edges
type TBorderPart = {
  region: TRegion;
  length: number;
  // How much of the gradient's offset range the part spans
  span: number;
  createGradient: (ctx: CanvasRenderingContext2D) => CanvasGradient;
};

function borderParts(width: number, height: number, radius: number): TBorderPart[] {
  const r = radius;
  const edgeX = width - 2 * r;
  const edgeY = height - 2 * r;
  const arc = ((r - 0.5) * Math.PI) / 2;
  const edge = (
    region: TRegion,
    [x0, y0, x1, y1]: [number, number, number, number],
    length: number,
  ): TBorderPart => ({
    region,
    length,
    span: 1,
    createGradient: (ctx) => ctx.createLinearGradient(x0, y0, x1, y1),
  });
  const corner = (x: number, y: number, cx: number, cy: number, angle: number): TBorderPart => ({
    region: [x, y, r, r],
    length: arc,
    span: 0.25,
    createGradient: (ctx) => ctx.createConicGradient(angle, cx, cy),
  });

  return [
    edge([r, 0, edgeX, r], [r, 0, width - r, 0], edgeX),
    corner(width - r, 0, width - r, r, -Math.PI / 2),
    edge([width - r, r, r, edgeY], [0, r, 0, height - r], edgeY),
    corner(width - r, height - r, width - r, height - r, 0),
    edge([r, height - r, edgeX, r], [width - r, 0, r, 0], edgeX),
    corner(0, height - r, r, height - r, Math.PI / 2),
    edge([0, r, r, edgeY], [0, height - r, 0, r], edgeY),
    corner(0, 0, r, r, Math.PI),
  ];
}

type TStreakFrame = {
  width: number;
  height: number;
  radius: number;
  color: string;
  progress: number;
};

function drawStreak(ctx: CanvasRenderingContext2D, frame: TStreakFrame) {
  const { width, height, radius, color, progress } = frame;
  const parts = borderParts(width, height, radius);
  const perimeter = parts.reduce((sum, part) => sum + part.length, 0);
  const streakLength = perimeter * streakLengthRatio;
  const tipLength = streakLength * tipRatio;
  const head = progress * perimeter;
  const alphaAt = (distance: number) => {
    const behind = (((head - distance) % perimeter) + perimeter) % perimeter;
    if (behind > streakLength) return 0;
    if (behind < tipLength) return behind / tipLength;
    return 1 - (behind - tipLength) / (streakLength - tipLength);
  };
  const breakpoints = [-1, 0, 1].flatMap((lap) => [
    head + lap * perimeter,
    head - tipLength + lap * perimeter,
    head - streakLength + lap * perimeter,
  ]);
  const epsilon = 1e-3;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, radius);
  ctx.roundRect(1, 1, width - 2, height - 2, radius - 1);
  ctx.clip("evenodd");

  let start = 0;
  for (const part of parts) {
    const end = start + part.length;
    const gradient = part.createGradient(ctx);
    const offsetAt = (distance: number) => ((distance - start) / part.length) * part.span;
    gradient.addColorStop(0, `rgba(0,0,0,${alphaAt(start + epsilon)})`);
    for (const point of breakpoints.filter((p) => p > start && p < end).sort((a, b) => a - b)) {
      gradient.addColorStop(offsetAt(point), `rgba(0,0,0,${alphaAt(point - epsilon)})`);
      gradient.addColorStop(offsetAt(point), `rgba(0,0,0,${alphaAt(point + epsilon)})`);
    }
    gradient.addColorStop(part.span, `rgba(0,0,0,${alphaAt(end - epsilon)})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(...part.region);
    start = end;
  }

  // The gradients only carry the fade, the color goes on top of them
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function fitCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  if (canvas.width === width && canvas.height === height) return;
  canvas.width = width;
  canvas.height = height;
}

// A light that runs along the border with a fading tail. The blurred copies spread it past
// the border so it reads as light rather than a line. The first canvas is drawn, the rest copy it
export default function BorderStreak() {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const [source, ...copies] = root.querySelectorAll("canvas");
    const ctx = source?.getContext("2d");
    if (!source || !ctx) return;
    const canvases = [source, ...copies];

    let frameId = requestAnimationFrame(function render(now) {
      frameId = requestAnimationFrame(render);
      const width = root.clientWidth;
      const height = root.clientHeight;
      if (width === 0 || height === 0) return;
      const scale = window.devicePixelRatio;
      const pixelWidth = Math.round(width * scale);
      const pixelHeight = Math.round(height * scale);
      for (const canvas of canvases) fitCanvas(canvas, pixelWidth, pixelHeight);

      const style = getComputedStyle(root);
      ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
      drawStreak(ctx, {
        width,
        height,
        radius: parseFloat(style.borderTopLeftRadius),
        color: style.color,
        progress: (now % lapMs) / lapMs,
      });
      for (const copy of copies) {
        const copyCtx = copy.getContext("2d");
        if (!copyCtx) continue;
        copyCtx.clearRect(0, 0, pixelWidth, pixelHeight);
        copyCtx.drawImage(source, 0, 0);
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, [reducedMotion]);

  if (reducedMotion) return null;
  return (
    <div
      ref={rootRef}
      aria-hidden
      className="text-change/9-10 pointer-events-none absolute -inset-px rounded-lg"
    >
      {layerBlurs.map((blur) => (
        <canvas key={blur} className={`absolute inset-0 size-full ${blur}`} />
      ))}
    </div>
  );
}
