# Inputs, Generators, and Variable References

The three mechanisms that turn a static definition into a live, secret-wired deployment.
Resolution happens in `apps/api/pkg/templates/renderer.go` → `ResolveTemplate(template,
inputs, kubeNameMap, namespace)`, called from the deploy service.

## Input types

`TemplateInputType` in `template.go`. Each input attaches to a service via that service's
`InputIDs`.

| Type | Const | Form UI | Resolver effect |
|------|-------|---------|-----------------|
| Domain | `InputTypeHost` | Domain field | Routes ingress to the service. `TargetPort` selects the port. |
| Volume size | `InputTypeVolumeSize` | Storage slider | Appends a `TemplateVolume` to the service using `input.Volume` (Name+MountPath). **`Volume` required** or deploy errors. Value GB → `Gi`. |
| Database size | `InputTypeDatabaseSize` | Storage slider | Sets `service.DatabaseConfig.StorageSize`. Validated as a storage quantity. |
| Node port | `InputTypeGeneratedNodePort` | (host/hidden) | Appends a `PortSpec{IsNodePort:true, ...}`. Uses `input.PortProtocol` (default TCP). |
| Generated password | `InputTypeGeneratedPassword` | hidden | One password generated at deploy, shared across services via `${<ID_UPPER>_VALUE}`. Mark `Hidden: true`. |
| Node IP | `InputTypeGeneratedNodeIP` | — | Cluster node IP (e.g. WireGuard). |
| Variable | `InputTypeVariable` | Text field | Plain user-supplied value. |

`input.Default` is `*string`; sizes are entered as GB integers without the `Gi` suffix
(`utils.ToPtr("1")`).

### Visibility: `Hidden` vs `Collapsed`

Two independent visibility flags on `TemplateInput`:

- `Hidden: true` — the input never renders in the form (used for shared generated secrets).
- `Collapsed: true` — the input still renders, but tucked under a collapsed dropdown so it
  doesn't crowd the default view.

**Storage collapse convention:** when a template exposes **2 or more** storage inputs
(`InputTypeVolumeSize` and `InputTypeDatabaseSize` combined), set `Collapsed: true` on every
one of those storage inputs. A single storage input stays expanded. See `plausible.go`
(two `database-size`) or `supabase_lite.go` (`database-size` + `volume-size`) for examples.

### The shared-secret pattern

Supabase needs the same internal password baked into many connection strings. It declares a
hidden `InputTypeGeneratedPassword` input and references it everywhere as
`${INPUT_INTERNAL_PASSWORD_VALUE}`:

```go
{ID: "input_internal_password", Name: "Internal Password",
 Type: schema.InputTypeGeneratedPassword, Hidden: true},
```

## Generators

`ValueGenerator.Type` in `template.go`. Set on a `TemplateVariable`; the resolver fills
`Value`. Generation runs in `resolveGeneratedVariables` (renderer.go) — except
`StringReplace`, deferred to the end.

| Type | Const | Produces |
|------|-------|----------|
| Email | `GeneratorTypeEmail` | `admin@<BaseDomain>`. `BaseDomain` is auto-set to the install's external UI URL. |
| Password | `GeneratorTypePassword` | Random 32-char string. Optional `HashType` (`sha256`/`sha512`). |
| Bcrypt | `GeneratorTypePasswordBcrypt` | Bcrypt hash in `<NAME>`; **also injects `<NAME w/o _HASH>_PLAINTEXT`** with the raw value. Name your var `FOO_HASH` to get `FOO_PLAINTEXT` free. |
| Input | `GeneratorTypeInput` | Echoes input `InputID`. Supports `AddPrefix` (e.g. `"https://"`). |
| JWT | `GeneratorTypeJWT` | Needs `JWTParams`. Emits three vars (secret + anon token + service token), each valid 10y. |
| String replace | `GeneratorTypeStringReplace` | Templated `Value`, resolved last. See below. |

Optional `ValueGenerator` fields: `InputID`, `BaseDomain`, `AddPrefix`,
`HashType *ValueHashType`, `JWTParams *JWTParams`.

### JWT

```go
{
	Name: "GENERATED_JWT_VARIABLES",
	Generator: &schema.ValueGenerator{
		Type: schema.GeneratorTypeJWT,
		JWTParams: &schema.JWTParams{
			Issuer:           "supabase",
			SecretOutputKey:  "JWT_SECRET",
			AnonOutputKey:    "SUPABASE_ANON_KEY",
			ServiceOutputKey: "SUPABASE_SERVICE_KEY",
		},
	},
},
```

The host variable (`GENERATED_JWT_VARIABLES`) becomes a placeholder; the three output keys
become real variables on that service. Other services reference them by those key names
(`SourceName: "JWT_SECRET"`, etc.). See `supabase_lite.go` service `service_kong`.

## StringReplace placeholders

`StringReplace` `Value` is resolved after every other variable exists. The substitution map
(`renderer.go`, `stringReplaceMap`) contains:

| Placeholder | Value |
|-------------|-------|
| `${NAMESPACE}` | The team's k8s namespace. |
| `${<SERVICE_ID_UPPER>_<VARNAME>}` | Any non-stringreplace variable that has a value. |
| `${<SERVICE_ID_UPPER>_KUBE_NAME}` | The deployed k8s service name (from `kubeNameMap`). |
| `${<INPUT_ID_UPPER>_VALUE}` | A user input value. |

`<SERVICE_ID_UPPER>` is the service `ID` uppercased: `service_db` → `SERVICE_DB`.

> Unmatched placeholders are left **literally** in the string — a typo'd `${FOO}` ships as
> `${FOO}`. Verify your keys.

Used for config files as variables (Kong's `kong.yml`), connection strings, etc.

## Variable references

`TemplateVariableReference` pulls a variable from another deployed service into this one.
Resolved at deploy time in `internal/services/templates/deploy.go` and at runtime in
`internal/services/variables/resolve_references.go`.

| Field | Effect |
|-------|--------|
| `SourceID` | Source service's `ID`. |
| `SourceName` | Variable name on the source. Omit when `IsHost` and you just want the host. |
| `TargetName` | Variable name created on this service. |
| `IsHost` | Resolve to the source's internal k8s DNS host (adds the `moco-` prefix for MySQL, strips port for DBs). |
| `TemplateString` | Wrap the resolved value in a larger string. `${SOURCE_NAME}` = the referenced value; other `${...}` keys come from the StringReplace map (e.g. `${INPUT_X_VALUE}`). |
| `AdditionalTemplateSources` | Extra source service IDs to pull variables from for the `TemplateString`. |
| `ResolveAsNormalVariable` | Treat as a normal variable instead of a live reference. |

### Patterns (from real templates)

```go
// wordpress.go — plain DB credential wiring
{SourceID: "service_mysql", SourceName: "DATABASE_USERNAME", TargetName: "WORDPRESS_DB_USER"},
{SourceID: "service_mysql", SourceName: "DATABASE_HOST",     TargetName: "WORDPRESS_DB_HOST"},

// supabase_lite.go — host-only reference (no SourceName)
{SourceID: "service_kong", TargetName: "API_EXTERNAL_URL", IsHost: true},

// supabase_lite.go — connection string with input + referenced host
{
	SourceID: "service_postgresql", SourceName: "DATABASE_HOST", TargetName: "PGRST_DB_URI",
	TemplateString: "postgresql://authenticator:${INPUT_INTERNAL_PASSWORD_VALUE}@${DATABASE_HOST}:5432/postgres?sslmode=disable",
},
```

## InitDB replacers

For DB services with `DatabaseConfig.InitDB` SQL containing placeholders, map each
placeholder to a StringReplace key via `service.InitDBReplacers`:

```go
InitDBReplacers: map[string]string{
	"${REPLACEME}": "INPUT_INTERNAL_PASSWORD_VALUE",
},
DatabaseConfig: &schema.DatabaseConfig{
	InitDB: "... password '${REPLACEME}' ...",
},
```

The resolver replaces every `${REPLACEME}` in the SQL with the resolved value of
`INPUT_INTERNAL_PASSWORD_VALUE`. If the key resolves to empty, the literal key is used
(see `renderer.go`). Supabase's `service_postgresql` is the canonical example.
