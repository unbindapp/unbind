import { cn } from "@/components/ui/utils";

type TProps = {
  className?: string;
};

export default function WebhooksList({ className }: TProps) {
  return <div className={cn("", className)}></div>;
}
