import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/components/ui/utils";
import { FC, ReactNode } from "react";

type TProps = {
  title: string;
  description: string;
  Icon: FC<{ className?: string }>;
  children: ReactNode;
  className?: string;
};

export default function ChartWrapper({ title, description, Icon, className, children }: TProps) {
  return (
    <div className={cn("flex w-full p-1", className)}>
      <Card className="bg-background flex w-full flex-col justify-start rounded-xl border shadow-none">
        <CardHeader className="px-4 py-2.25 sm:px-5 sm:py-3">
          <CardTitle className="flex items-start gap-2 text-lg">
            <div className="line-icon">
              <Icon className="size-5 shrink-0" />
            </div>
            <span className="min-w-0 shrink">{title}</span>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 px-4 pt-2 pb-3 sm:px-5 sm:pb-4">{children}</CardContent>
      </Card>
    </div>
  );
}
