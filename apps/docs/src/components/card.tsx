import BrandIcon from "@/components/icons/brand";
import { cn } from "@/lib/cn";
import Link from "fumadocs-core/link";
import type { ComponentProps, ReactNode } from "react";

// Fumadocs' Card with the app's card hover and active states. A brand puts its icon
// in brand color before the title, like the template cards in the app.
export function Card({
  brand,
  title,
  description,
  href,
  className,
  children,
  ...props
}: Omit<ComponentProps<"a">, "title"> & {
  brand?: string;
  title: ReactNode;
  description?: ReactNode;
}) {
  const classes = cn(
    "bg-card text-foreground @max-lg:col-span-full block rounded-xl border p-4",
    href &&
      "has-hover:hover:bg-card-hover active:bg-card-hover focus-visible:ring-primary/8-10 focus-visible:ring-1 focus-visible:outline-hidden",
    className,
  );
  const content = (
    <>
      <h3 className="not-prose -mt-0.5 mb-1.5 flex items-center gap-2 text-base leading-tight font-medium">
        {brand && <BrandIcon brand={brand} color="brand" className="size-4.5" />}
        <span className="min-w-0 truncate">{title}</span>
      </h3>
      {description && <p className="text-muted-foreground my-0! text-sm">{description}</p>}
      <div className="text-muted-foreground prose-no-margin -mb-0.5 text-sm empty:hidden">
        {children}
      </div>
    </>
  );

  if (!href) {
    return (
      <div data-card className={classes}>
        {content}
      </div>
    );
  }
  return (
    <Link data-card href={href} className={classes} {...props}>
      {content}
    </Link>
  );
}
