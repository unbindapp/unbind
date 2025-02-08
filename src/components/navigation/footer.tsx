import { cn } from "@/components/ui/utils";

type Props = {
  className?: string;
};

export default function Footer({ className }: Props) {
  return <footer className={cn("", className)}></footer>;
}
