import { cn } from "@/components/ui/utils";
import { teamIconUrl, type TTeam } from "@/lib/queries/teams";
import { useState } from "react";

type TProps = {
  team: Pick<TTeam, "id" | "name" | "icon_updated_at">;
  className?: string;
};

export default function TeamIcon({ team, className }: TProps) {
  const src = teamIconUrl(team);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (src && src !== failedSrc) {
    return (
      <div
        className={cn(
          "bg-background border-border shrink-0 overflow-hidden rounded-full border",
          className,
        )}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          onError={() => setFailedSrc(src)}
          className="size-full object-cover"
        />
      </div>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("shrink-0", className)}>
      <circle cx="12" cy="12" r="12" className="fill-foreground" />
      <text
        x="12"
        y="12"
        dy="0.36em"
        textAnchor="middle"
        fontSize="13"
        className="fill-background font-semibold"
      >
        {firstLetter(team.name)}
      </text>
    </svg>
  );
}

function firstLetter(name: string) {
  const first = new Intl.Segmenter().segment(name.trim())[Symbol.iterator]().next().value;
  return first?.segment.toLocaleUpperCase() ?? "";
}
