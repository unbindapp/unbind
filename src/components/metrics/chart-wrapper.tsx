import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/components/ui/utils";
import { ReactNode } from "react";

type TProps = {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
};

export default function ChartWrapper({ title, description, className, children }: TProps) {
  return (
    <div className={cn("flex w-full p-1", className)}>
      <Card className="flex w-full flex-col justify-start rounded-xl border shadow-none">
        <CardHeader className="px-4 py-2.25 sm:px-5 sm:py-3">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 px-4 pt-2 pb-3 sm:px-5 sm:pb-4">{children}</CardContent>
      </Card>
    </div>
  );
}
