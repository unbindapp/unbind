-- +goose Up
-- modify "service_configs" table
ALTER TABLE "service_configs" ADD COLUMN "max_request_body_size_mb" integer NULL;

-- +goose Down
-- reverse: modify "service_configs" table
ALTER TABLE "service_configs" DROP COLUMN "max_request_body_size_mb";
