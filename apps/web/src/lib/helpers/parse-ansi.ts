import type { TLogMessageSegment } from "@/lib/helpers/format-log-message";
import type { CSSProperties } from "react";

// Matches SGR sequences (capturing their params), then all other CSI/OSC/Fe
// escapes so they can be stripped instead of rendered as garbage.
const ansiSequenceRegex =
  // eslint-disable-next-line no-control-regex
  /\u001b(?:\[([0-9;:]*)m|\[[0-9;:?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)?|\([@-~]|[@-_=><])?/g;

type TAnsiState = {
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  inverse: boolean;
  fg: string | null;
  bg: string | null;
};

export function containsAnsi(message: string): boolean {
  return message.includes("\u001b");
}

export function parseAnsi(message: string): TLogMessageSegment[] {
  const segments: TLogMessageSegment[] = [];
  const state = createDefaultState();
  let lastIndex = 0;

  for (const match of message.matchAll(ansiSequenceRegex)) {
    if (match.index > lastIndex) {
      segments.push({ text: message.slice(lastIndex, match.index), style: stateToStyle(state) });
    }
    lastIndex = match.index + match[0].length;
    if (match[1] !== undefined) {
      applySgrParams(state, match[1]);
    }
  }
  if (lastIndex < message.length) {
    segments.push({ text: message.slice(lastIndex), style: stateToStyle(state) });
  }

  return segments;
}

function createDefaultState(): TAnsiState {
  return {
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    strikethrough: false,
    inverse: false,
    fg: null,
    bg: null,
  };
}

function applySgrParams(state: TAnsiState, params: string) {
  const codes = params.split(/[;:]/).map((code) => (code === "" ? 0 : parseInt(code, 10)));

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    if (Number.isNaN(code)) continue;

    if (code === 0) Object.assign(state, createDefaultState());
    else if (code === 1) state.bold = true;
    else if (code === 2) state.dim = true;
    else if (code === 3) state.italic = true;
    else if (code === 4) state.underline = true;
    else if (code === 7) state.inverse = true;
    else if (code === 9) state.strikethrough = true;
    else if (code === 22) {
      state.bold = false;
      state.dim = false;
    } else if (code === 23) state.italic = false;
    else if (code === 24) state.underline = false;
    else if (code === 27) state.inverse = false;
    else if (code === 29) state.strikethrough = false;
    else if (code >= 30 && code <= 37) state.fg = `var(--ansi-${code - 30})`;
    else if (code === 39) state.fg = null;
    else if (code >= 40 && code <= 47) state.bg = `var(--ansi-${code - 40})`;
    else if (code === 49) state.bg = null;
    else if (code >= 90 && code <= 97) state.fg = `var(--ansi-${code - 82})`;
    else if (code >= 100 && code <= 107) state.bg = `var(--ansi-${code - 92})`;
    else if (code === 38 || code === 48) i = applyExtendedColor(state, codes, i);
  }
}

function applyExtendedColor(state: TAnsiState, codes: number[], index: number): number {
  const target = codes[index] === 38 ? "fg" : "bg";

  if (codes[index + 1] === 5) {
    const color = ansi256ToColor(codes[index + 2]);
    if (color) state[target] = color;
    return index + 2;
  }
  if (codes[index + 1] === 2) {
    const [r, g, b] = codes.slice(index + 2, index + 5);
    if ([r, g, b].every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) {
      state[target] = `rgb(${r} ${g} ${b})`;
    }
    return index + 4;
  }
  return index;
}

function ansi256ToColor(code: number): string | null {
  if (!Number.isInteger(code) || code < 0 || code > 255) return null;
  if (code < 16) return `var(--ansi-${code})`;
  if (code < 232) {
    const cubeIndex = code - 16;
    const [r, g, b] = [
      Math.floor(cubeIndex / 36),
      Math.floor(cubeIndex / 6) % 6,
      cubeIndex % 6,
    ].map((v) => (v === 0 ? 0 : v * 40 + 55));
    return `rgb(${r} ${g} ${b})`;
  }
  const gray = 8 + (code - 232) * 10;
  return `rgb(${gray} ${gray} ${gray})`;
}

function stateToStyle(state: TAnsiState): CSSProperties | null {
  const style: CSSProperties = {};

  const fg = state.inverse ? (state.bg ?? "var(--background)") : state.fg;
  const bg = state.inverse ? (state.fg ?? "var(--foreground)") : state.bg;
  if (fg) style.color = fg;
  if (bg) style.backgroundColor = bg;

  if (state.bold) style.fontWeight = 600;
  if (state.dim) style.opacity = 0.7;
  if (state.italic) style.fontStyle = "italic";

  const decorations = [state.underline && "underline", state.strikethrough && "line-through"]
    .filter(Boolean)
    .join(" ");
  if (decorations) style.textDecoration = decorations;

  return Object.keys(style).length > 0 ? style : null;
}
