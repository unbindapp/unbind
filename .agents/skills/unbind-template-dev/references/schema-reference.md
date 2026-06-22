# Schema Reference

Every type a template author touches. Definitions live in:

- `apps/api/ent/schema/template.go` — template-specific types
- `apps/api/ent/schema/service_config_types.go` — shared service config (ports, health, resources)
- `apps/api/ent/schema/service.go` — service enums

`TemplateDefinition` is stored as a JSON blob in the `templates` DB table's `definition`
column. The `json` tags below are the wire/storage names and the frontend Zod schema names.

## TemplateDefinition

`template.go`

| Field | Go type | Req | Meaning |
|-------|---------|-----|---------|
| `Name` | `string` | yes | Display name. Part of the seed conflict key `(name, version)`. |
| `DisplayRank` | `uint` | yes | Gallery sort. Lower = higher. Existing templates use 10000-step values. |
| `Icon` | `string` | no | Must match a `brand.tsx` entry. |
| `Description` | `string` | yes | One line. |
| `Keywords` | `[]string` | no | Search terms in the gallery. |
| `Version` | `int` | yes | **Bump to push edits** (seed is `OnConflict(name,version) DoNothing`). |
| `Services` | `[]TemplateService` | yes | The services to deploy. |
| `Inputs` | `[]TemplateInput` | yes | The deploy form. |
| `ResourceRecommendations` | `TemplateResourceRecommendations` | no | Shown in gallery; advisory. |
| `RequiredCapabilities` | `[]string` | no | Cluster capabilities required (e.g. `"tls"`); empty = runs anywhere. Filters the gallery. |

### TemplateResourceRecommendations
`MinimumCPUs float64`, `MinimumRAMGB float64`. Advisory only.

## TemplateService

`template.go`

| Field | Go type | Req | Meaning |
|-------|---------|-----|---------|
| `ID` | `string` | yes | Unique within template. Target of `DependsOn` and ref `SourceID`. |
| `Name` | `string` | yes | Display name. |
| `Icon` | `string` | no | Per-service icon (gallery shows the set). |
| `Type` | `ServiceType` | yes | `docker-image` / `database` / `github`. |
| `Builder` | `ServiceBuilder` | yes | `docker` / `database` / `railpack`. Pair with `Type`. |
| `Image` | `*string` | for image svcs | Pinned container image. |
| `DatabaseType` | `*string` | for db svcs | `"postgres"`, `"mysql"`, `"redis"`, ... (operator-backed). |
| `DatabaseConfig` | `*DatabaseConfig` | for db svcs | Version, storage, initdb. |
| `InputIDs` | `[]string` | no | Inputs that attach to this service (volume/db size, host, nodeport). |
| `DependsOn` | `[]string` | no | Service IDs that must start first. |
| `Ports` | `[]PortSpec` | no | Exposed ports. |
| `Variables` | `[]TemplateVariable` | no | Env vars (static or generated). |
| `VariableReferences` | `[]TemplateVariableReference` | no | Vars pulled from other services. |
| `Volumes` | `[]TemplateVolume` | no | Usually populated from a `volume-size` input, not hand-written. |
| `HealthCheck` | `*HealthCheck` | no | Startup + liveness probes. |
| `Resources` | `*Resources` | no | CPU/memory requests + limits. |
| `RunCommand` | `*string` | no | Override container command. |
| `InitContainers` | `[]*InitContainer` | no | Run before the main container. |
| `VariablesMounts` | `[]*VariableMount` | no | Mount a variable as a file (e.g. a config file var). |
| `SecurityContext` | `*SecurityContext` | no | Capabilities / privileged. |
| `ProtectedVariables` | `[]string` | no | Vars the user may edit but not delete. |
| `InitDBReplacers` | `map[string]string` | no | `{placeholderInSQL: stringReplaceMapKey}` — substituted into `DatabaseConfig.InitDB`. |

### Database services expose these variables

A `ServiceTypeDatabase` automatically provides, for other services to reference by
`SourceName`:

- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`
- `DATABASE_DEFAULT_DB_NAME`
- `DATABASE_HOST`
- `DATABASE_PORT`

You never declare these. Reference them via `TemplateVariableReference`.

## TemplateInput

`template.go`

| Field | Go type | Req | Meaning |
|-------|---------|-----|---------|
| `ID` | `string` | yes | Referenced by service `InputIDs` and `${<ID_UPPER>_VALUE}`. |
| `Name` | `string` | yes | Form label. |
| `Type` | `TemplateInputType` | yes | See inputs-and-generators.md. |
| `Description` | `string` | yes | Help text. |
| `Required` | `bool` | yes | Enforced by the form. |
| `Hidden` | `bool` | no | Keep out of the form (shared generated secrets). |
| `Collapsed` | `bool` | no | Visible but tucked under a collapsed dropdown in the form. Convention: set on every storage input when a template has 2+ storage inputs. |
| `Default` | `*string` | no | Prefilled value. Sizes are GB w/o `Gi`. |
| `Volume` | `*TemplateVolume` | for volume-size | `Name` + `MountPath`. Required for `InputTypeVolumeSize`. |
| `PortProtocol` | `*Protocol` | for nodeport | Defaults TCP. |
| `TargetPort` | `*int` | no | For `host` inputs: which service port the domain routes to. |

## TemplateVariable

`Name string`, `Value string`, `Generator *ValueGenerator`.
Static → set `Value`. Generated → set `Generator`, leave `Value` empty (except
`StringReplace`, where `Value` is the template string).

## TemplateVariableReference

`Name`d by target. Fields: `SourceID`, `SourceName`, `TargetName`, `IsHost`,
`TemplateString`, `AdditionalTemplateSources []string`, `ResolveAsNormalVariable bool`.
See inputs-and-generators.md for resolution semantics.

## TemplateVolume

`Name string`, `CapacityGB string` (e.g. `"10Gi"` — set by the resolver from the input),
`MountPath string`. You normally only set `Name` + `MountPath` (inside a `volume-size`
input); the resolver fills `CapacityGB`.

## DatabaseConfig

`service_config_types.go`

| Field | Go type | Meaning |
|-------|---------|---------|
| `Version` | `string` | e.g. `"17"` for Postgres. Validated against the db definition's allowed versions. |
| `StorageSize` | `string` | Set by a `database-size` input (resolver appends `Gi`). |
| `DefaultDatabaseName` | `string` | DB created on init. |
| `InitDB` | `string` | SQL run once at init. Supports `InitDBReplacers` substitution. |
| `WalLevel` | `string` | Postgres WAL level (e.g. `"logical"`). |

## HealthCheck

`service_config_types.go`. `Type` is `http` / `exec` / `none`.

- HTTP: set `Path` + `Port`.
- Exec: set `Command` (e.g. `"mc ready local"`).
- Timing (all `*int32`): `StartupPeriodSeconds`, `StartupTimeoutSeconds`,
  `StartupFailureThreshold`, `HealthPeriodSeconds`, `HealthTimeoutSeconds`,
  `HealthFailureThreshold`. Copy values from an existing template.

## PortSpec

`Port int32` (1-65535), `Protocol *Protocol` (default TCP), `IsNodePort bool`,
`NodePort *int32` (auto-assigned if nil). NodePorts usually come from a
`generated-node-port` input, not hand-written.

## Resources

`CPURequestsMillicores int64` (1000 = 1 core, defaults 50 if ≤0),
`CPULimitsMillicores int64`, `MemoryRequestsMegabytes int64` (default 64 if ≤0),
`MemoryLimitsMegabytes int64`.

## Enums

```go
// service.go
ServiceTypeGithub      = "github"
ServiceTypeDockerimage = "docker-image"
ServiceTypeDatabase    = "database"

// service_config_types.go
ServiceBuilderRailpack = "railpack"
ServiceBuilderDocker   = "docker"
ServiceBuilderDatabase = "database"

ProtocolTCP  = "TCP"
ProtocolUDP  = "UDP"
ProtocolSCTP = "SCTP"

HealthCheckTypeHTTP = "http"
HealthCheckTypeExec = "exec"
HealthCheckTypeNone = "none"
```

Pairings that make sense: image service → `Type: docker-image` + `Builder: docker`;
database → `Type: database` + `Builder: database`.

## Other types (rarely needed)

- `VariableMount{Name, Path}` — mount a variable's value as a file.
- `InitContainer{Image, Command}` — run before main.
- `SecurityContext{Capabilities *Capabilities, Privileged *bool}`,
  `Capabilities{Add, Drop []Capability}` — e.g. WireGuard needs `NET_ADMIN`.
