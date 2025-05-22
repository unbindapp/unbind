export function isDomain(str: string): boolean {
  if (/\s/.test(str)) return false;

  if (!str || str.length > 254) return false;

  const h = str.endsWith(".") ? str.slice(0, -1) : str;
  if (h.length > 253) return false;

  // ── one label: ASCII-punycode OR Unicode letters/numbers ──
  const asciiPuny = "xn--[a-z0-9-]{1,59}";
  const uniLabel = "[\\p{L}\\p{N}](?:[\\p{L}\\p{N}-]{0,61}[\\p{L}\\p{N}])?";
  const part = `(?:${asciiPuny}|${uniLabel})`;

  const re = new RegExp(`^(?:${part}\\.)+${part}$`, "iu");
  return re.test(h);
}
