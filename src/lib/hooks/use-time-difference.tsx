import { useNow } from "@/components/providers/now-provider";

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
  const now = useNow();

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

export function getDurationStr({ start, end }: { start: string | number; end: string | number }) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const duration = Math.max(endDate.getTime() - startDate.getTime(), 0);
  const durationInSec = Math.floor(duration / 1000);
  const durationInMin = durationInSec / 60;
  if (durationInSec >= 120) {
    return `${durationInMin.toLocaleString(undefined, { maximumFractionDigits: 1 })}m`;
  }
  return `${Math.ceil(durationInSec)}s`;
}
