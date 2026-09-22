import { cn } from "@/lib/cn";
import Link from "fumadocs-core/link";
import type { ComponentProps, ReactNode } from "react";

// Fumadocs' Card with the app's card hover and active states.
export function Card({
  icon,
  title,
  description,
  href,
  className,
  children,
  ...props
}: Omit<ComponentProps<"a">, "title"> & {
  icon?: ReactNode;
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
      {icon && (
        <div className="not-prose text-muted-foreground bg-muted mb-2 w-fit rounded-lg border p-1.5 [&_svg]:size-4">
          {icon}
        </div>
      )}
      <h3 className="not-prose mb-1 text-sm font-medium">{title}</h3>
      {description && <p className="text-muted-foreground my-0! text-sm">{description}</p>}
      <div className="text-muted-foreground prose-no-margin text-sm empty:hidden">{children}</div>
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
