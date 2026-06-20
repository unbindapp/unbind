# Architecture: definition → API → operator

End-to-end flow. Read this when a deploy misbehaves and you need to know which layer to
inspect. File:line refs are starting points, not exact across edits.

## 1. Definition

- One func per template in `apps/api/pkg/templates/<name>.go`, returning
  `*schema.TemplateDefinition`.
- Registered in `pkg/templates/templater.go` → `AvailableTemplates()`.
- Pure data. No I/O, no side effects.

## 2. Seed to DB (startup)

- `internal/repositories/template/mutations.go` → `UpsertPredefinedTemplates`.
- Called from `cmd/api/main.go` during boot.
- Writes each definition into the `templates` ent table: `name`, `version`, `icon`,
  `description`, `keywords`, `resource_recommendations`, full `definition` JSON,
  `immutable = true`.
- **Conflict policy: `OnConflict(name, version) DoNothing`.** Editing a template without
  bumping `Version` is a no-op against an already-seeded DB. This is the #1 "my change
  didn't show up" cause.

## 3. API

`internal/api/handlers/templates/`:

- `GET /templates/list` → `ListTemplates` — gallery, filtered by cluster capabilities
  (`RequiredCapabilities`).
- `GET /templates/get?id=` → `GetTemplateByID` — full definition for the deploy panel.
- `POST /templates/deploy` → `DeployTemplate`.

Business logic in `internal/services/templates/`. Input to deploy:
`team_id`, `project_id`, `environment_id`, `template_id`, `group_name`, and `inputs[]`
(`{id, value}` pairs from the form).

## 4. Resolve

`internal/services/templates/deploy.go` → `DeployTemplate`:

1. Permission check (Editor on the environment), fetch template from DB.
2. Resolve host inputs (domains).
3. Build `kubeNameMap`: `templateServiceID → k8s slug name`.
4. **`templater.ResolveTemplate(&def, inputs, kubeNameMap, namespace)`** (`renderer.go`):
   - Generate variables (passwords, JWTs, emails, bcrypt) — `resolveGeneratedVariables`.
   - `resolveVolumes` — `volume-size` inputs → `service.Volumes` (appends `Gi`).
   - `resolveNodePorts` — `generated-node-port` inputs → `service.Ports`.
   - `resolveDatabaseSizes` — `database-size` inputs → `DatabaseConfig.StorageSize`.
   - Run StringReplace across vars, ref `TemplateString`s, and `DatabaseConfig.InitDB`.
   Returns a fully materialized `TemplateDefinition`.

## 5. Persist as Service records

Still in `deploy.go`, inside a transaction, per resolved service:

- For `database` services: `dbProvider.FetchDatabaseDefinition(...)` (`pkg/databases/`)
  loads the operator/Helm definition (port, schema, allowed versions) for the
  `DatabaseType`, validates `DatabaseConfig.Version`.
- Create k8s `Secret` (`k8s.GetOrCreateSecret`) holding the service's variables.
- Create `ent.Service` (kubernetes name, type, db type, `template_id`,
  `template_instance_id` grouping all services of one deploy, `service_group_id`).
- Create `ent.ServiceConfig` (`repositories/service/mutations.go` → `CreateConfig`): maps
  builder, ports, hosts, `DatabaseConfig`, health check, security context, resources, init
  containers, variable mounts, volumes.
- Create PVCs for volumes.
- Resolve `VariableReferences` into DB `VariableReference` rows linking source → target
  (`repositories/variables`). Host refs build the internal DNS value; MySQL gets the
  `moco-` prefix.

## 6. Deploy to Kubernetes

- `deployCtl.PopulateBuildEnvironment` then enqueue: `EnqueueDeploymentJob` (independent) or
  `EnqueueDependentDeployment` (has refs). Redis-backed build queue.
- Build worker turns each `ServiceConfig` into an `unbindv1.Service` CRD
  (`pkg/builder/k8s/crd.go` → `CreateServiceObject`).
- `internal/infrastructure/k8s/unbind_service_deploy.go` → `DeployUnbindService` applies the
  CRD (GVR `unbind.unbind.app/v1 / services`) into the team namespace.
- The unbind-operator reconciles the CRD into Deployments/StatefulSets, Services, ingress,
  and (for `database` type) hands off to the database operator, which runs `InitDB` SQL.

## Where to look when X breaks

| Symptom | Look |
|---------|------|
| Template not in gallery | Registered in `AvailableTemplates()`? `RequiredCapabilities` filtering it out? |
| Edit didn't apply | Bump `Version` (seed conflict). Restart API to re-seed. |
| Generated value wrong/empty | `renderer.go` `resolveGeneratedVariables`; generator type + params. |
| `${FOO}` shows up literally in container | StringReplace key mismatch; check the placeholder map in inputs-and-generators.md. |
| Ref var empty in target | `SourceID`/`SourceName` typo; source var has no value; check `resolve_references.go`. |
| DB version rejected | `pkg/databases/` definition's allowed versions for that `DatabaseType`. |
| InitDB didn't run / wrong creds | `InitDBReplacers` mapping; operator logs for the db service. |
| Icon missing (ban symbol) | No `brand.tsx` entry for `Icon`. See frontend-and-icons.md. |

## Key files

| Layer | File |
|-------|------|
| Definitions | `apps/api/pkg/templates/*.go` |
| Registry | `apps/api/pkg/templates/templater.go` |
| Resolver | `apps/api/pkg/templates/renderer.go` |
| Schema types | `apps/api/ent/schema/template.go`, `service_config_types.go`, `service.go` |
| Seed | `apps/api/internal/repositories/template/mutations.go` |
| API handlers | `apps/api/internal/api/handlers/templates/` |
| Deploy logic | `apps/api/internal/services/templates/deploy.go` |
| Ref resolution | `apps/api/internal/services/variables/resolve_references.go` |
| DB definitions | `apps/api/pkg/databases/` |
| CRD build | `apps/api/pkg/builder/k8s/crd.go` |
| CRD apply | `apps/api/internal/infrastructure/k8s/unbind_service_deploy.go` |
| Frontend gallery/form | `apps/web/src/components/templates/`, `command-panel/.../items/template.tsx` |
| Icons | `apps/web/src/components/icons/brand.tsx` |
