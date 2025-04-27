import { TButtonProps, buttonVariants } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  EllipsisIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav role="navigation" aria-label="pagination" className={cn("flex", className)} {...props} />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex flex-row items-center", className)} {...props} />;
}

function PaginationItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("", className)} {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<TButtonProps, "size"> &
  (
    | (React.ComponentProps<typeof Link> & { isButton: false })
    | (React.ComponentProps<"button"> & { isButton: true })
  );

function PaginationLink({
  className,
  isActive,
  isButton,
  size = "sm",
  ...props
}: PaginationLinkProps) {
  const Component = isButton ? "button" : Link;
  return (
    // @ts-expect-error - The the is not matching between button and Link
    <Component
      aria-current={isActive ? "page" : undefined}
      className={cn(
        buttonVariants({
          variant: isActive ? "outline" : "ghost",
          size,
        }),
        "rounded-[0.55rem]",
        className,
      )}
      {...props}
    />
  );
}

function PaginationPrevious({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof PaginationLink> & {
  variant?: "first" | "default";
}) {
  return (
    <PaginationLink
      aria-label={variant === "first" ? "İlk Sayfaya Git" : "Önceki Sayfaya Git"}
      size="icon"
      className={className}
      {...props}
    >
      <span className="sr-only">{variant === "first" ? "İlk" : "Önceki"}</span>
      {variant === "first" ? (
        <ChevronsLeftIcon className="size-5" />
      ) : (
        <ChevronLeftIcon className="size-5" />
      )}
    </PaginationLink>
  );
}

function PaginationNext({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof PaginationLink> & {
  variant?: "last" | "default";
}) {
  return (
    <PaginationLink
      aria-label={variant === "last" ? "Son Sayfaya Git" : "Sonraki Sayfaya Git"}
      size="icon"
      className={className}
      {...props}
    >
      <span className="sr-only">{variant === "last" ? "Sonuncu" : "Sonraki"}</span>
      {variant === "last" ? (
        <ChevronsRightIcon className="size-5" />
      ) : (
        <ChevronRightIcon className="size-5" />
      )}
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      className={cn("flex h-9 w-9 items-center justify-center", className)}
      {...props}
    >
      <EllipsisIcon className="h-4 w-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
