# Frontend & Icons

The web app is `apps/web/` (Next.js + React Query + Zustand). You touch it for one required
thing — the icon — and otherwise the deploy form is generated automatically from your
inputs.

## Icons (required, hardcoded)

Icons are **hardcoded SVG blocks**, not asset files. There is no icon folder and no registry
JSON. Everything is in:

```
apps/web/src/components/icons/brand.tsx
```

`BrandIcon` is a chain of `if (brand === "x") return <svg>...</svg>` blocks ending in a
fallback:

```tsx
return <BanIcon className={cn("scale-85", defaultClassName, className)} {...rest} />;
```

So `Icon: "myapp"` with no matching block → users see a "ban" (∅) icon. Both the template's
`Icon` and each service's `Icon` resolve through this same component.

### Add an icon

Insert a block before the final `return <BanIcon .../>`:

```tsx
if (brand === "myapp") {
  return (
    <svg
      className={cn(defaultClassName, className)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path d="..." />
    </svg>
  );
}
```

Keep `className={cn(defaultClassName, className)}` and spread `{...rest}` so sizing and props
pass through. `defaultClassName` is `"size-5 shrink-0"`.

### Optional brand color

Monochrome icons inherit `currentColor` — usually fine. For a brand-colored icon (rendered
when the caller passes `color="brand"`):

1. Add the color in `apps/web/src/globals.css` in **three** places: `:root` (light), `.dark`,
   and `@theme inline`:
   ```css
   /* :root and .dark */
   --myapp: hsl(210 50% 40%);
   /* @theme inline */
   --color-myapp: var(--myapp);
   ```
2. In the icon block: `className={cn(defaultClassName, color === "brand" && "text-myapp", className)}`.

Pocketbase is a monochrome example; `go` and `postgresql` are colored examples.

## Where templates appear

Templates are browsed from the **command panel** ("New Service" flow), not a standalone
marketplace page:

- `apps/web/src/components/command-panel/context-command-panel/items/template.tsx` — builds
  one command item per template: title `name`, subtitle `description`, search `keywords`,
  the template `icon`, service count, and the set of service icons.

Selecting one creates a draft (`components/templates/template-draft-store.ts`, persisted to
localStorage, max 10) and opens the deploy panel.

## Deploy form (auto-generated)

`apps/web/src/components/templates/panel/template-draft-panel-content.tsx` builds the form
from `template.definition.inputs`, skipping `hidden` inputs. Field by `type`:

| Input type | Component |
|------------|-----------|
| `host` | `DomainInput` (auto-fills the install's wildcard domain) |
| `database-size`, `volume-size` | `StorageSizeInput` slider (min/max/step from system storage settings; GB) |
| `variable`, `generated-*` | text field |

`required`, `default`, and `description` drive validation, prefill, and help text. You get
the form for free by declaring inputs correctly — no frontend work needed beyond the icon.

The services list in the panel renders each service's `icon`, `name`, and a subtitle (image
tag, or `database_type:version`).

## API client / types

`apps/web/src/lib/server/client.gen.ts` is a **generated** TypeScript + Zod SDK from the Go
OpenAPI spec — do not hand-edit. Regenerate it when the Go template schema changes (see the
web app's codegen script). Queries live in `apps/web/src/lib/queries/templates.ts`
(`templatesListQuery`, get-by-id, `deployTemplate`).
