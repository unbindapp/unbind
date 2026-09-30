-- +goose Up
-- replicas can't share a volume, so a service that mounts one runs a single replica
UPDATE "service_configs" SET "replicas" = 1
WHERE "replicas" > 1
  AND "service_id" IN (SELECT "id" FROM "services" WHERE "type" <> 'database')
  AND CASE WHEN jsonb_typeof("volumes") = 'array' THEN jsonb_array_length("volumes") > 0 ELSE false END;

-- +goose Down
