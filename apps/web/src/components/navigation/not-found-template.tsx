import { LinkButton } from "@/components/ui/button";
import type { LinkProps } from "@tanstack/react-router";
import { FC } from "react";

type TProps = {
  code: number;
  description: string;
  buttonTo: LinkProps["to"];
  buttonText: string;
  Icon: FC<{ className?: string }>;
};

export default function NotFoundTemplate({
  code,
  description,
  buttonTo,
  buttonText,
  Icon,
}: TProps) {
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-5 pt-8 pb-[calc(2rem+8vh)]">
      <div className="flex w-full max-w-lg flex-col items-center justify-center">
        <div className="flex w-full items-center justify-center gap-2">
          <Icon className="size-11 shrink-0" />
          <p className="min-w-0 shrink text-5xl font-bold">{code}</p>
        </div>
        <h1 className="text-muted-foreground mt-2 text-lg leading-tight">{description}</h1>
        <LinkButton to={buttonTo} className="mt-5">
          {buttonText}
        </LinkButton>
      </div>
    </div>
  );
}
