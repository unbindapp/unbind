import { appLocale } from "@/lib/constants";

export function formatGB(value: number, precision: number = 3): string {
  // Handle zero, NaN, and Infinity cases
  if (value === 0) return "0";
  if (!isFinite(value)) return String(value);

  const valueInBytes = value * 1e9; // Convert GB to bytes

  // Handle negative values
  const isNegative = value < 0;
  const absValue = Math.abs(valueInBytes);

  // Define thresholds and corresponding suffixes
  const thresholds = [
    { value: 1e12, suffix: "TB" },
    { value: 1e9, suffix: "GB" },
    { value: 1e6, suffix: "MB" },
    { value: 1e3, suffix: "KB" },
    { value: 1, suffix: "B" },
  ];

  // Find the appropriate threshold
  const threshold = thresholds.find((t) => absValue >= t.value);

  if (!threshold) {
    // Handle small numbers (less than 1)
    return isNegative ? `-${absValue.toFixed(precision)}` : absValue.toFixed(precision);
  }

  // Calculate the scaled value
  const scaledValue = absValue / threshold.value;

  // Format with specified precision
  // Use toPrecision instead of toFixed to handle very small numbers properly
  const formattedValue = scaledValue.toPrecision(precision);

  // Remove trailing zeros and unnecessary decimal point
  const cleanedValue = parseFloat(formattedValue).toLocaleString(appLocale);

  // Combine with suffix and sign
  return `${isNegative ? "-" : ""}${cleanedValue} ${threshold.suffix}`;
}
