"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export const toastErrorProps = {
  duration: 5000,
  closeButton: false,
};

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="group/sonner font-sans!"
      toastOptions={{
        unstyled: true,
        style: { pointerEvents: "auto" },
        classNames: {
          icon: "text-foreground shrink-0 group-data-[type=error]/toast:text-destructive! group-data-[type=success]/toast:text-success! group-data-[type=warning]/toast:text-warning! size-4! mt-0.5! [&>svg]:size-full",
          default: "w-full group/toast shadow-lg shadow-shadow-color/shadow-opacity",
          title:
            "text-foreground -mt-0.25 group-data-[type=error]/toast:text-destructive! group-data-[type=success]/toast:text-success! group-data-[type=warning]/toast:text-warning! font-semibold leading-tight!",
          toast:
            "bg-background border border-border rounded-xl px-4 py-3 flex flex-row items-start gap-1.5",
          content: "shrink min-w-0 flex flex-col gap-1!",
          description:
            "group-data-[type=error]/toast:text-foreground! group-data-[type=warning]/toast:text-foreground! group-data-[type=success]/toast:text-foreground! text-muted-foreground! text-sm leading-snug!",
          closeButton:
            "absolute size-6! p-1! before:left-1/2! before:top-1/2! before:-translate-1/2! has-hover:hover:text-foreground! active:text-foreground! text-muted-foreground! shadow-md shadow-shadow-color/shadow-opacity border border-border before:w-full before:h-full before:min-w-[48px] before:min-h-[48px] before:z-[-1] z-10 before:bg-transparent before:absolute border-border! active:bg-border! has-hover:hover:bg-border! bg-background! -left-1.75 -top-1.75 rounded-full",
          actionButton: "group/toast:bg-primary! group/toast:text-primary-foreground!",
          cancelButton: "group/toast:bg-muted! group-[.toast]:text-muted-foreground!",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
