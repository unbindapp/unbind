---
name: unbind-template-dev
description: >
  Author one-click app templates for Unbind (the self-hostable PaaS). A template is a Go
  function returning a *schema.TemplateDefinition that bundles one or more services
  (databases + container images), user inputs (domain, sizes, ports), auto-generated
  secrets (passwords, JWTs, bcrypt), and wired-up variable references between services.
  Templates are defined in apps/api/pkg/templates/, seeded to the DB on startup, exposed
  over the API, and rendered into Kubernetes resources by the operator. Use when creating,
  editing, or debugging an Unbind template, or when asked how the templating system works.
compatibility: Designed for Claude Code (or similar products)
metadata:
  author: Unbind
  version: "1.0"
  domain: paas-template-development
  framework: Unbind
  languages: go, typescript
allowed-tools: Bash Read Write Edit
---

# Unbind Template Development

## What a template is

A template is a deployable bundle: N services wired together with generated secrets and
cross-service variable references, plus a small set of inputs the user fills in (domain,
storage size, etc.). WordPress = MySQL + the WordPress image, wired by four env refs.
Supabase = Postgres + a dozen images, wired by JWTs and host references.

A template is a single Go function returning `*schema.TemplateDefinition`. There is no YAML,
no DSL — it's typed Go. The whole system lives in two trees:

- **Definitions + resolution + API + deploy:** `apps/api/`
- **Gallery, deploy form, icons:** `apps/web/`

Read [references/architecture.md](references/architecture.md) for the full e2e flow
(definition → DB seed → API → `ResolveTemplate` → Service/ServiceConfig records → operator
CRD). You do not need it to write a template, but read it before debugging deploy behavior.

## The 5-minute version

1. Copy [assets/template-skeleton.go](assets/template-skeleton.go) to
   `apps/api/pkg/templates/<name>.go`.
2. Fill in metadata, inputs, services, variables, references.
3. Register it in `apps/api/pkg/templates/templater.go` → `AvailableTemplates()`.
4. Add an icon to `apps/web/src/components/icons/brand.tsx` (see Step 6).
5. `cd apps/api && go test ./pkg/templates/` then `go build ./...`.

## Coding style

These hold for the Go you write here (definitions, and any renderer/generator edits) and the
TSX icon blocks. Match the surrounding code.

- **Don't over-comment.** No comments on self-explanatory code. A doc comment on the template
  func is enough; don't narrate every field. Let the struct read as data.
- **Guard clauses.** Return/continue early on the exception; don't nest the happy path inside
  `if` blocks. The resolver functions in `renderer.go` are the pattern — bail when the input
  map is empty, handle the case, move on.
- **Prefer `switch`/`case`** over `if`/`else if` chains, especially when branching on a type
  or enum (`Generator.Type`, `Input.Type`, `ServiceType`). Reads cleaner and extends cleanly.

## Step 1: Scaffold the definition

Every template file is one function. Match the existing files — `pocketbase.go` is the
smallest complete example (single service + volume), `wordpress.go` is the smallest
multi-service example (DB + app + refs), `supabase_lite.go` is the kitchen sink.

```go
package templates

import (
	"github.com/unbindapp/unbind-api/ent/schema"
	"github.com/unbindapp/unbind-api/internal/common/utils"
)

func myAppTemplate() *schema.TemplateDefinition {
	return &schema.TemplateDefinition{
		Name:        "MyApp",
		DisplayRank: uint(15000), // lower sorts higher in the gallery
		Icon:        "myapp",     // MUST match a brand.tsx entry (Step 6)
		Keywords:    []string{"myapp", "cms", "whatever people search"},
		Description: "One blunt sentence.",
		Version:     1,
		ResourceRecommendations: schema.TemplateResourceRecommendations{
			MinimumCPUs:  1,
			MinimumRAMGB: 0.5,
		},
		Inputs:   []schema.TemplateInput{ /* Step 3 */ },
		Services: []schema.TemplateService{ /* Step 2 */ },
	}
}
```

Pointers everywhere: wrap scalars with `utils.ToPtr(...)`. That's the house idiom for
`*string`, `*int32`, `*Protocol`, etc.

## Step 2: Define services

Two service shapes. Full field reference: [references/schema-reference.md](references/schema-reference.md).

**Container image** (`Type: ServiceTypeDockerimage`, `Builder: ServiceBuilderDocker`):

```go
{
	ID:       "service_myapp",            // unique within the template; used by DependsOn + refs
	Name:     "MyApp",
	Type:     schema.ServiceTypeDockerimage,
	Builder:  schema.ServiceBuilderDocker,
	Image:    utils.ToPtr("ghcr.io/org/myapp:v1.2.3"), // PIN the tag, never :latest
	InputIDs: []string{"input_domain", "input_storage_size"},
	Ports:    []schema.PortSpec{{Port: 8080, Protocol: utils.ToPtr(schema.ProtocolTCP)}},
	Resources: &schema.Resources{
		CPURequestsMillicores: 20,
		CPULimitsMillicores:   400,
	},
	HealthCheck: &schema.HealthCheck{
		Type: utils.ToPtr(schema.HealthCheckTypeHTTP),
		Path: "/health",
		Port: utils.ToPtr(int32(8080)),
		// startup/health timing — copy from pocketbase.go
	},
	Variables:          []schema.TemplateVariable{ /* Step 4 */ },
	VariableReferences: []schema.TemplateVariableReference{ /* Step 5 */ },
}
```

**Database** (`Type: ServiceTypeDatabase`, `Builder: ServiceBuilderDatabase`). No image —
`DatabaseType` selects the operator-backed engine (`"postgres"`, `"mysql"`, `"redis"`, ...).
Sizing comes from a `database-size` input.

```go
{
	ID:           "service_db",
	Name:         "PostgreSQL",
	Type:         schema.ServiceTypeDatabase,
	Builder:      schema.ServiceBuilderDatabase,
	DatabaseType: utils.ToPtr("postgres"),
	InputIDs:     []string{"input_database_size"},
	DatabaseConfig: &schema.DatabaseConfig{
		DefaultDatabaseName: "myapp",
		Version:             "17",
		// InitDB: "-- optional SQL run once at init",
	},
}
```

A database service auto-exposes these variables for other services to reference:
`DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_DEFAULT_DB_NAME`, `DATABASE_HOST`,
`DATABASE_PORT`. You do not declare them — you reference them (Step 5).

`DependsOn: []string{"service_db"}` controls startup ordering by service ID.

## Step 3: Define inputs

Inputs render as the deploy form. Each is keyed by `ID` and attached to services via the
service's `InputIDs`. Types (full table in [references/inputs-and-generators.md](references/inputs-and-generators.md)):

| Type | Renders as | Notes |
|------|-----------|-------|
| `InputTypeHost` | Domain field | Routes ingress. `TargetPort` picks which service port. |
| `InputTypeVolumeSize` | Storage slider | **`Volume` field required** (Name + MountPath). Appends a volume to the service. |
| `InputTypeDatabaseSize` | Storage slider | Sets `DatabaseConfig.StorageSize` on the DB service. |
| `InputTypeGeneratedNodePort` | (hidden/host) | Appends a NodePort to the service. |
| `InputTypeGeneratedPassword` | hidden | A password generated once at deploy, reusable across services via `${INPUT_<ID>_VALUE}`. |
| `InputTypeVariable` | Text field | Plain user value. |

```go
Inputs: []schema.TemplateInput{
	{
		ID: "input_domain", Name: "Domain", Type: schema.InputTypeHost,
		Description: "Domain for MyApp.", Required: true,
	},
	{
		ID: "input_storage_size", Name: "Storage Size", Type: schema.InputTypeVolumeSize,
		Volume:      &schema.TemplateVolume{Name: "myapp-data", MountPath: "/data"},
		Description: "Disk for MyApp.", Required: true, Default: utils.ToPtr("1"),
	},
}
```

`Hidden: true` keeps an input out of the form (used for `InputTypeGeneratedPassword` shared
secrets). `Default` is a `*string`; sizes are in GB without the `Gi` suffix.

## Step 4: Variables and generators

Static var: `{Name: "FOO", Value: "bar"}`. Generated var: set a `Generator` and leave `Value`
empty. Generators run during `ResolveTemplate`. Full behavior:
[references/inputs-and-generators.md](references/inputs-and-generators.md).

```go
Variables: []schema.TemplateVariable{
	{Name: "ADMIN_EMAIL",    Generator: &schema.ValueGenerator{Type: schema.GeneratorTypeEmail}},
	{Name: "ADMIN_PASSWORD", Generator: &schema.ValueGenerator{Type: schema.GeneratorTypePassword}},
	{Name: "SITE_URL", Generator: &schema.ValueGenerator{
		Type: schema.GeneratorTypeInput, InputID: "input_domain", AddPrefix: "https://",
	}},
}
```

Generator types: `Email`, `Password` (32 chars), `PasswordBcrypt` (emits `<NAME>` as the hash
plus `<NAME-minus-_HASH>_PLAINTEXT`), `Input` (echoes an input value, supports `AddPrefix`),
`JWT` (emits three vars via `JWTParams`), `StringReplace` (deferred templating — see below).

**StringReplace** is the escape hatch for config-file-as-env-var. The `Value` is a template
string resolved last, after all other vars exist. Available placeholders:

- `${NAMESPACE}`
- `${<SERVICE_ID_UPPER>_<VARNAME>}` — any non-stringreplace var with a value
- `${<SERVICE_ID_UPPER>_KUBE_NAME}` — the deployed k8s service name
- `${<INPUT_ID_UPPER>_VALUE}` — a user input value

```go
{
	Name:      "DATABASE_URL",
	Generator: &schema.ValueGenerator{Type: schema.GeneratorTypeStringReplace},
	Value:     "postgres://user:${SERVICE_DB_DATABASE_PASSWORD}@${SERVICE_DB_KUBE_NAME}.${NAMESPACE}:5432/myapp",
}
```

## Step 5: Wire services together (VariableReferences)

A reference pulls a variable from another service into this one at deploy time. This is how
the app gets the DB password without you hardcoding it.

```go
VariableReferences: []schema.TemplateVariableReference{
	// Plain: copy source var -> target name
	{SourceID: "service_db", SourceName: "DATABASE_PASSWORD", TargetName: "MYAPP_DB_PASSWORD"},

	// Host: resolve to the source service's internal k8s DNS name
	{SourceID: "service_db", TargetName: "MYAPP_DB_HOST", IsHost: true},

	// TemplateString: wrap a referenced value inside a larger string
	{
		SourceID: "service_db", SourceName: "DATABASE_HOST", TargetName: "MYAPP_DB_URI",
		TemplateString: "postgresql://authenticator:${INPUT_INTERNAL_PASSWORD_VALUE}@${DATABASE_HOST}:5432/postgres?sslmode=disable",
	},
}
```

Details and edge cases (`AdditionalTemplateSources`, `ResolveAsNormalVariable`, the moco
MySQL host prefix) in [references/inputs-and-generators.md](references/inputs-and-generators.md).

## Step 6: Add the icon (REQUIRED — easy to forget)

Icons are **hardcoded SVGs**, not files in a folder. `Icon: "myapp"` matches an entry in
`apps/web/src/components/icons/brand.tsx`. No entry → the UI renders a `BanIcon` (the
"missing" symbol).

Add a block before the final `return <BanIcon ... />` fallback:

```tsx
if (brand === "myapp") {
  return (
    <svg className={cn(defaultClassName, className)} viewBox="0 0 24 24" {...rest}>
      <path d="..." />
    </svg>
  );
}
```

Optional brand color: add `--myapp` / `--color-myapp` vars in `apps/web/src/globals.css`
(`:root`, `.dark`, and `@theme inline`), then `color === "brand" && "text-myapp"` in the
className. Both the template and each service can set `Icon`. Details:
[references/frontend-and-icons.md](references/frontend-and-icons.md).

## Step 7: Register, build, test

1. Add your func to `AvailableTemplates()` in `apps/api/pkg/templates/templater.go`.
2. `cd apps/api && go build ./... && go test ./pkg/templates/`.
3. The renderer test (`renderer_test.go`) covers generation/replacement/volumes — add a case
   if you do anything non-obvious.

## Pushing edits to an existing template (the seeding gotcha)

Templates seed to the DB on API startup via `UpsertPredefinedTemplates`
(`internal/repositories/template/mutations.go`). The upsert is
`OnConflict(Name, Version) DoNothing`.

**Consequence:** editing a shipped template without changing anything else will NOT update
the DB row — the conflict on `(Name, Version)` makes it a no-op. **Bump `Version`** whenever
you change a template that has already been seeded, or the change never reaches running
installs.

## Common mistakes

1. **Forgot to register** in `AvailableTemplates()` — template silently never appears.
2. **Edited a template but didn't bump `Version`** — DB keeps the old definition.
3. **Missing icon entry** in `brand.tsx` — UI shows a "ban" icon. Easy to miss in review.
4. **`InputTypeVolumeSize` without `Volume`** — `ResolveTemplate` errors at deploy time.
5. **`:latest` image tag** — pin a digest/tag; templates must be reproducible.
6. **Referencing a DB var that doesn't exist** — DB services expose a fixed set
   (`DATABASE_USERNAME/PASSWORD/HOST/PORT/DEFAULT_DB_NAME`); spelling counts.
7. **`${...}` placeholder that resolves to nothing** — StringReplace leaves unmatched
   placeholders untouched, shipping a literal `${FOO}` into the container. Check the keys.
8. **Service `ID` collisions or stale `DependsOn`/`SourceID`** — refs are by service `ID`
   string; a typo wires nothing and fails silently.

## Reference files

- [references/schema-reference.md](references/schema-reference.md) — every struct + field
  (`TemplateDefinition`, `TemplateService`, `TemplateInput`, `HealthCheck`, `PortSpec`,
  `Resources`, `DatabaseConfig`, ...).
- [references/inputs-and-generators.md](references/inputs-and-generators.md) — input types,
  generator behaviors, variable-reference resolution, StringReplace placeholder map.
- [references/architecture.md](references/architecture.md) — e2e flow API → operator,
  where to look when a deploy misbehaves.
- [references/frontend-and-icons.md](references/frontend-and-icons.md) — gallery, deploy
  form generation, the icon registry.
- [assets/template-skeleton.go](assets/template-skeleton.go) — copy-paste starting point.
