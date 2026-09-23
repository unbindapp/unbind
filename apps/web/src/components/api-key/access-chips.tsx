import { describeResource, privilegeOptions, roleOptions } from "@/components/api-key/helpers";
import { cn } from "@/components/ui/utils";
import type { TApiKeyShallow } from "@/lib/queries/api-keys";
import {
  EyeIcon,
  ListFilterIcon,
  ScrollTextIcon,
  ShieldHalfIcon,
  SquarePenIcon,
} from "lucide-react";

export type TAccessSummary = Pick<
  TApiKeyShallow,
  "role" | "full_access" | "resources" | "privileges"
>;

const placeholderChips = Array.from({ length: 2 }, (_, i) => i);

// The role, access and privilege chips shared by the API key and connected app cards
export function AccessChips({ access }: { access: TAccessSummary | undefined }) {
  return (
    <div className="flex w-full flex-wrap items-start justify-start gap-1.5 text-xs">
      <Chip
        data-variant={access?.role}
        className="text-foreground bg-foreground/6-10 data-[variant=admin]:text-destructive data-[variant=admin]:bg-destructive/4-10 data-[variant=admin]:border-destructive/4-10 data-[variant=editor]:text-warning data-[variant=editor]:bg-warning/4-10 data-[variant=editor]:border-warning/4-10 data-[variant=viewer]:text-process data-[variant=viewer]:bg-process/4-10 data-[variant=viewer]:border-process/4-10 font-medium"
      >
        {access?.role === "admin" && (
          <ShieldHalfIcon className="mr-1 mb-0.5 -ml-0.5 inline-block size-3" />
        )}
        {access?.role === "editor" && (
          <SquarePenIcon className="mr-1 mb-0.5 -ml-0.5 inline-block size-3" />
        )}
        {access?.role === "viewer" && (
          <EyeIcon className="mr-1 mb-0.5 -ml-0.5 inline-block size-3" />
        )}
        {access ? roleTitle(access.role) : "Viewer"}
      </Chip>
      {access ? (
        access.full_access ? (
          <Chip>
            <ScrollTextIcon className="mr-1 mb-0.5 -ml-0.5 inline-block size-3" />
            Everything I can access
          </Chip>
        ) : (
          access.resources.map((resource) => (
            <Chip
              key={resource.resource_id}
              className={resource.path.length === 0 ? "text-destructive" : undefined}
            >
              <ListFilterIcon className="mr-1 mb-0.5 -ml-0.5 inline-block size-3" />
              {describeResource(resource)}
            </Chip>
          ))
        )
      ) : (
        placeholderChips.map((i) => <Chip key={i}>Loading loading</Chip>)
      )}
      {access &&
        privilegeOptions
          .filter((option) => access.privileges.includes(option.value))
          .map((option) => (
            <Chip key={option.value}>
              <option.Icon className="mr-1 mb-0.5 -ml-0.5 inline-block size-3" />
              {option.title}
            </Chip>
          ))}
    </div>
  );
}

function roleTitle(role: TAccessSummary["role"]) {
  return roleOptions.find((option) => option.value === role)?.title ?? role;
}

export function Chip({ className, children, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "bg-foreground/2-10 border-foreground/2-10 text-muted-foreground group-data-placeholder/item:border-muted-more-foreground group-data-placeholder/item:bg-muted-more-foreground group-data-placeholder/item:animate-skeleton max-w-full rounded-sm border px-1.5 py-0.5 text-xs leading-tight group-data-placeholder/item:text-transparent",
        className,
      )}
      {...rest}
    >
      {children}
    </p>
  );
}
