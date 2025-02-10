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

  const differenceMs = timestamp ? timestamp - now : 0;

  const differenceDays = Math.ceil(differenceMs / 1000 / 60 / 60 / 24);
  const differenceHours = Math.ceil(differenceMs / 1000 / 60 / 60);
  const differenceMinutes = Math.ceil(differenceMs / 1000 / 60);
  const differenceSeconds = Math.ceil(differenceMs / 1000);

  const diffDaysStr = rtf.format(differenceDays, "days");
  const diffHoursStr = rtf.format(differenceHours, "hours");
  const diffMinutesStr = rtf.format(differenceMinutes, "minutes");
  const diffSecondsStr = rtf.format(differenceSeconds, "seconds");

  const differenceStr =
    Math.abs(differenceDays) >= 1
      ? diffDaysStr
      : Math.abs(differenceHours) >= 1
      ? diffHoursStr
      : Math.abs(differenceMinutes) >= 1
      ? diffMinutesStr
      : diffSecondsStr;

  return {
    str: timestamp ? differenceStr : null,
  };
}
