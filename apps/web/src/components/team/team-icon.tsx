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
  const hasImage = !!src && src !== failedSrc;

  return (
    <div
      className={cn("shrink-0 overflow-hidden rounded-full", !hasImage && "bg-border", className)}
    >
      {hasImage ? (
        <img
          src={src}
          alt=""
          draggable={false}
          onError={() => setFailedSrc(src)}
          className="size-full object-cover"
        />
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-full">
          <text
            x="12"
            y="12"
            dy="0.36em"
            textAnchor="middle"
            fontSize="13"
            className="fill-foreground font-semibold"
          >
            {firstLetter(team.name)}
          </text>
        </svg>
      )}
    </div>
  );
}

function firstLetter(name: string) {
  const first = new Intl.Segmenter().segment(name.trim())[Symbol.iterator]().next().value;
  return first?.segment.toLocaleUpperCase() ?? "";
}
