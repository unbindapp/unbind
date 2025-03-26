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
}) {
  const { timestamp: now } = useTimestamp();

  const differenceMs = timestamp ? now - timestamp : 0;
  const sign = differenceMs < 0 ? 1 : -1;
  const differenceMsAbs = Math.abs(differenceMs);

  const differenceDaysAbs = Math.floor(differenceMsAbs / 1000 / 60 / 60 / 24);
  const differenceHoursAbs = Math.floor(differenceMsAbs / 1000 / 60 / 60);
  const differenceMinutesAbs = Math.floor(differenceMsAbs / 1000 / 60);
  const differenceSecondsAbs = Math.floor(differenceMsAbs / 1000);

  const diffDaysStr = rtf.format(sign * differenceDaysAbs, "days");
  const diffHoursStr = rtf.format(sign * differenceHoursAbs, "hours");
  const diffMinutesStr = rtf.format(sign * differenceMinutesAbs, "minutes");
  const diffSecondsStr = rtf.format(sign * differenceSecondsAbs, "seconds");

  const differenceStr =
    differenceDaysAbs >= 1
      ? diffDaysStr
      : differenceHoursAbs >= 1
        ? diffHoursStr
        : differenceMinutesAbs >= 1
          ? diffMinutesStr
          : diffSecondsStr;

  return {
    str: timestamp ? differenceStr : null,
  };
}
