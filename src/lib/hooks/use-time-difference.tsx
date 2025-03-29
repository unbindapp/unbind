import { useTimestamp } from "@/components/providers/timestamp-provider";

const defaultRtf = new Intl.RelativeTimeFormat("en-US", {
  numeric: "auto",
  style: "short",
});

export function useTimeDifference({
  timestamp,
  rtf = defaultRtf,
}: {
  timestamp?: number;
  rtf?: Intl.RelativeTimeFormat;
}): {
  str: string | null;
} {
  const { timestamp: now } = useTimestamp();

  if (!timestamp) {
    return {
      str: null,
    };
  }

  const differenceMs = timestamp ? now - timestamp : 0;
  const sign = differenceMs < 0 ? 1 : -1;
  const differenceMsAbs = Math.abs(differenceMs);

  const secondsDivider = 1000;
  const minutesDivider = secondsDivider * 60;
  const hoursDivider = minutesDivider * 60;
  const daysDivider = hoursDivider * 24;
  const weeksDivider = daysDivider * 7;
  const monthsDivider = daysDivider * 30;
  const yearsDivider = monthsDivider * 12;

  const differenceYearsAbs = Math.floor(differenceMsAbs / yearsDivider);
  if (differenceYearsAbs >= 1) {
    return {
      str: rtf.format(sign * differenceYearsAbs, "years"),
    };
  }

  const differenceMonthsAbs = Math.floor(differenceMsAbs / monthsDivider);
  if (differenceMonthsAbs >= 1) {
    return {
      str: rtf.format(sign * differenceMonthsAbs, "months"),
    };
  }

  const differenceWeeksAbs = Math.floor(differenceMsAbs / weeksDivider);
  if (differenceWeeksAbs >= 1) {
    return {
      str: rtf.format(sign * differenceWeeksAbs, "weeks"),
    };
  }

  const differenceDaysAbs = Math.floor(differenceMsAbs / daysDivider);
  if (differenceDaysAbs >= 1) {
    return {
      str: rtf.format(sign * differenceDaysAbs, "days"),
    };
  }

  const differenceHoursAbs = Math.floor(differenceMsAbs / hoursDivider);
  if (differenceHoursAbs >= 1) {
    return {
      str: rtf.format(sign * differenceHoursAbs, "hours"),
    };
  }

  const differenceMinutesAbs = Math.floor(differenceMsAbs / minutesDivider);
  if (differenceMinutesAbs >= 1) {
    return {
      str: rtf.format(sign * differenceMinutesAbs, "minutes"),
    };
  }

  const differenceSecondsAbs = Math.floor(differenceMsAbs / secondsDivider);
  return {
    str: rtf.format(sign * differenceSecondsAbs, "seconds"),
  };
}
