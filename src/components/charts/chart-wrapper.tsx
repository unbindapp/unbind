import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/components/ui/utils";
import { ReactNode } from "react";

type Props = {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
};

export default function ChartWrapper({
  title,
  description,
  className,
  children,
}: Props) {
  return (
    <div className={cn("w-full p-1 flex", className)}>
      <Card className="w-full border rounded-xl shadow-none flex flex-col justify-start">
        <CardHeader className="px-4 py-2.25 sm:px-5 sm:py-3">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="pb-3 px-4 pt-2 sm:pb-4 sm:px-6 flex-1">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
