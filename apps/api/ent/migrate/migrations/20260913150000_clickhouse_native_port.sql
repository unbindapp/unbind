-- +goose Up
-- ClickHouse speaks two protocols: native on 9000, which is the port DATABASE_URL and
-- DATABASE_PORT already name, and HTTP on 8123. Services created before both were
-- modelled stored only 8123, so the primary protocol was unreachable. Move the stored
-- port to 9000 and add 8123 alongside it. The new port carries no node port, so an
-- already-public database keeps the one it has until it is toggled.
UPDATE "service_configs" sc
SET "ports" = (
  SELECT jsonb_agg(
    CASE WHEN (port ->> 'port')::int = 8123
      THEN jsonb_set(port, '{port}', '9000'::jsonb)
      ELSE port
    END
  )
  FROM jsonb_array_elements(sc."ports") AS port
) || '[{"port": 8123, "protocol": "TCP", "is_nodeport": false}]'::jsonb
FROM "services" s
WHERE s."id" = sc."service_id"
  AND s."type" = 'database'
  AND s."database" = 'clickhouse'
  AND sc."ports" @> '[{"port": 8123}]'::jsonb
  AND NOT sc."ports" @> '[{"port": 9000}]'::jsonb;

-- +goose Down
UPDATE "service_configs" sc
SET "ports" = (
  SELECT jsonb_agg(
    CASE WHEN (port ->> 'port')::int = 9000
      THEN jsonb_set(port, '{port}', '8123'::jsonb)
      ELSE port
    END
  )
  FROM jsonb_array_elements(sc."ports") AS port
  WHERE (port ->> 'port')::int <> 8123
)
FROM "services" s
WHERE s."id" = sc."service_id"
  AND s."type" = 'database'
  AND s."database" = 'clickhouse'
  AND sc."ports" @> '[{"port": 9000}]'::jsonb;
