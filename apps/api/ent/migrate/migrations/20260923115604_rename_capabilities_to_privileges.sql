-- +goose Up
-- Databases that ran 20260923090803 under its earlier name still have the column as "capabilities".
-- +goose StatementBegin
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['api_keys', 'oauth_grants', 'oauth_authorization_codes'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = t AND column_name = 'capabilities'
    ) THEN
      EXECUTE format('ALTER TABLE %I RENAME COLUMN "capabilities" TO "privileges"', t);
    END IF;
  END LOOP;
END $$;
-- +goose StatementEnd

-- +goose Down
-- Nothing to reverse: 20260923090803 owns the column.
