import { cn } from "@/components/ui/utils";

type TProps = {
  children: React.ReactNode;
  className?: string;
};

export default function InputSectionWrapper({ children, className }: TProps) {
  return <div className={cn("-mx-1 w-[calc(100%+0.5rem)]", className)}>{children}</div>;
}
