-- +goose Up
-- modify "deployments" table - add columns if they don't exist
ALTER TABLE "deployments" 
    ADD COLUMN IF NOT EXISTS "builder" character varying,
    ADD COLUMN IF NOT EXISTS "railpack_builder_install_command" character varying,
    ADD COLUMN IF NOT EXISTS "railpack_builder_build_command" character varying,
    ADD COLUMN IF NOT EXISTS "run_command" character varying,
    ADD COLUMN IF NOT EXISTS "docker_builder_dockerfile_path" character varying,
    ADD COLUMN IF NOT EXISTS "docker_builder_build_context" character varying;

-- Populate the new columns from service_configs
UPDATE deployments 
SET 
    builder = sc.builder,
    railpack_builder_install_command = sc.railpack_builder_install_command,
    railpack_builder_build_command = sc.railpack_builder_build_command,
    run_command = sc.run_command,
    docker_builder_dockerfile_path = sc.docker_builder_dockerfile_path,
    docker_builder_build_context = sc.docker_builder_build_context
FROM service_configs sc
WHERE deployments.service_id = sc.service_id;

-- Now set builder as NOT NULL since it's required in service_configs
ALTER TABLE "deployments" ALTER COLUMN "builder" SET NOT NULL;

-- +goose Down
-- reverse: modify "deployments" table
ALTER TABLE "deployments" 
    DROP COLUMN IF EXISTS "docker_builder_build_context", 
    DROP COLUMN IF EXISTS "docker_builder_dockerfile_path", 
    DROP COLUMN IF EXISTS "run_command", 
    DROP COLUMN IF EXISTS "railpack_builder_build_command", 
    DROP COLUMN IF EXISTS "railpack_builder_install_command", 
    DROP COLUMN IF EXISTS "builder";