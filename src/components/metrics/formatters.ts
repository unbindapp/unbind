export function bytesToHumanReadable(v: number) {
  const kb = 1024;
  const mb = kb * 1024;
  const gb = mb * 1024;
  const tb = gb * 1024;

  if (v < kb) {
    return `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} B`;
  }

  if (v < mb) {
    return `${(v / kb).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })} KB`;
  }

  if (v < gb) {
    return `${(v / mb).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })} MB`;
  }

  if (v < tb) {
    return `${(v / gb).toLocaleString(undefined, {
      maximumFractionDigits: 1,
    })} GB`;
  }

  return `${(v / tb).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })} TB`;
}

export function cpuToHumanReadable(v: number) {
  const str = `${v.toLocaleString(undefined, { maximumSignificantDigits: 3 })}`;
  return str.startsWith("0.") ? str.substring(1) : str;
}
