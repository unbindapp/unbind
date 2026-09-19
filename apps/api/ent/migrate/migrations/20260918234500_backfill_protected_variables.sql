-- +goose Up
-- Services deployed from a template never stored their protected variables, so a
-- template's database credentials could be edited or deleted.
UPDATE "service_configs" sc
SET "protected_variables" = '["DATABASE_USERNAME", "DATABASE_PASSWORD", "DATABASE_DEFAULT_DB_NAME"]'::jsonb
FROM "services" s
WHERE s."id" = sc."service_id"
  AND s."type" = 'database'
  AND NOT COALESCE(sc."protected_variables", '[]'::jsonb) @> '["DATABASE_PASSWORD"]'::jsonb;

-- Values Unbind derives from an editable secret are locked and rewritten whenever the
-- secret changes. Convex: the admin key is issued for INSTANCE_SECRET.
UPDATE "service_configs" sc
SET "protected_variables" = '["CONVEX_SELF_HOSTED_ADMIN_KEY"]'::jsonb,
    "variable_metadata" =
      CASE WHEN jsonb_typeof(sc."variable_metadata") = 'object' THEN sc."variable_metadata" ELSE '{}'::jsonb END
      || jsonb_build_object('CONVEX_SELF_HOSTED_ADMIN_KEY',
        CASE WHEN jsonb_typeof(sc."variable_metadata" -> 'CONVEX_SELF_HOSTED_ADMIN_KEY') = 'object'
          THEN sc."variable_metadata" -> 'CONVEX_SELF_HOSTED_ADMIN_KEY' ELSE '{}'::jsonb END
        || '{"derived_from": {"type": "convex_admin_key", "sources": ["INSTANCE_SECRET"], "convex_instance_name": "convex"}}'::jsonb)
FROM "services" s
JOIN "templates" t ON t."id" = s."template_id"
WHERE s."id" = sc."service_id"
  AND t."name" = 'Convex'
  AND sc."image" LIKE 'ghcr.io/get-convex/convex-backend%'
  AND sc."variable_metadata" -> 'CONVEX_SELF_HOSTED_ADMIN_KEY' -> 'derived_from' IS NULL;

-- Supabase: both API keys are signed with JWT_SECRET, and kong.yml contains the keys and
-- the dashboard login. "admin" also names a Kong ACL group, so the username stays fixed.
UPDATE "service_configs" sc
SET "protected_variables" = '["DASHBOARD_USERNAME", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_KEY"]'::jsonb,
    "variable_metadata" =
      CASE WHEN jsonb_typeof(sc."variable_metadata") = 'object' THEN sc."variable_metadata" ELSE '{}'::jsonb END
      || jsonb_build_object('SUPABASE_ANON_KEY',
        CASE WHEN jsonb_typeof(sc."variable_metadata" -> 'SUPABASE_ANON_KEY') = 'object'
          THEN sc."variable_metadata" -> 'SUPABASE_ANON_KEY' ELSE '{}'::jsonb END
        || '{"derived_from": {"type": "jwt", "sources": ["JWT_SECRET"], "jwt_issuer": "supabase", "jwt_role": "anon"}}'::jsonb)
      || jsonb_build_object('SUPABASE_SERVICE_KEY',
        CASE WHEN jsonb_typeof(sc."variable_metadata" -> 'SUPABASE_SERVICE_KEY') = 'object'
          THEN sc."variable_metadata" -> 'SUPABASE_SERVICE_KEY' ELSE '{}'::jsonb END
        || '{"derived_from": {"type": "jwt", "sources": ["JWT_SECRET"], "jwt_issuer": "supabase", "jwt_role": "service_role"}}'::jsonb)
      || jsonb_build_object('kong.yml',
        CASE WHEN jsonb_typeof(sc."variable_metadata" -> 'kong.yml') = 'object'
          THEN sc."variable_metadata" -> 'kong.yml' ELSE '{}'::jsonb END
        || '{"derived_from": {"type": "embedded", "sources": ["DASHBOARD_PASSWORD", "DASHBOARD_USERNAME", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_KEY"]}}'::jsonb)
FROM "services" s
JOIN "templates" t ON t."id" = s."template_id"
WHERE s."id" = sc."service_id"
  AND t."name" = 'Supabase'
  AND sc."image" LIKE 'kong:%'
  AND sc."variable_metadata" -> 'SUPABASE_ANON_KEY' -> 'derived_from' IS NULL;

-- Gluetun: HTTP_PROXY_URL contains the proxy password.
UPDATE "service_configs" sc
SET "variable_metadata" =
      CASE WHEN jsonb_typeof(sc."variable_metadata") = 'object' THEN sc."variable_metadata" ELSE '{}'::jsonb END
      || jsonb_build_object('HTTP_PROXY_URL',
        CASE WHEN jsonb_typeof(sc."variable_metadata" -> 'HTTP_PROXY_URL') = 'object'
          THEN sc."variable_metadata" -> 'HTTP_PROXY_URL' ELSE '{}'::jsonb END
        || '{"derived_from": {"type": "embedded", "sources": ["HTTPPROXY_PASSWORD"]}}'::jsonb)
FROM "services" s
JOIN "templates" t ON t."id" = s."template_id"
WHERE s."id" = sc."service_id"
  AND t."name" = 'Gluetun'
  AND sc."image" LIKE 'qmcgaw/gluetun%'
  AND sc."variable_metadata" -> 'HTTP_PROXY_URL' -> 'derived_from' IS NULL;

-- +goose Down
-- The lists that were missing cannot be told apart from the ones that were not
