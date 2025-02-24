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
    <div className={cn("w-full p-1", className)}>
      <Card className="w-full border rounded-2xl">
        <CardHeader className="py-4 px-6">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="h-64 pt-2">{children}</CardContent>
      </Card>
    </div>
  );
}
