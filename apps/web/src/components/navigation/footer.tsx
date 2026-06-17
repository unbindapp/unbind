import { cn } from "@/components/ui/utils";

type TProps = {
  className?: string;
};

export default function Footer({ className }: TProps) {
  return <footer className={cn("", className)}></footer>;
}
