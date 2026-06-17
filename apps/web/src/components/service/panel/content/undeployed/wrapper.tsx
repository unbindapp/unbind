import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { HTMLAttributes, ReactNode } from "react";

type TWrapperFormProps = {
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLFormElement>;

export function WrapperForm({ className, children, ...rest }: TWrapperFormProps) {
  return (
    <form
      className={cn("mt-4 flex w-full flex-1 flex-col overflow-hidden border-t sm:mt-6", className)}
      {...rest}
    >
      {children}
    </form>
  );
}

type TWrapperInnerProps = {
  className?: string;
  children: ReactNode;
};

export function WrapperInner({ children }: TWrapperInnerProps) {
  return (
    <ScrollArea classNameViewport="pb-8">
      <div className="-mt-1 flex w-full flex-1 flex-col gap-5 px-3 py-4 sm:p-6 md:gap-6">
        {children}
      </div>
    </ScrollArea>
  );
}
