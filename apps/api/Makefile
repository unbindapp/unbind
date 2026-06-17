.PHONY: migrate migrate\:checksum interfaces ent tests fmt help

help:
	@echo "Available commands:"
	@echo "  make tests                           - Run tests"
	@echo "  make migrate NAME=initial_migration  - Create a new migration"
	@echo "  make migrate:checksum                - Regenerate checksum"
	@echo "  make interfaces                      - Generate interfaces and mocks"
	@echo "  make ent                             - Generate entities"

migrate:
	@if [ -z "$(NAME)" ]; then \
		echo "❌ Error: NAME parameter is required"; \
		echo "Usage: make migrate NAME=your_migration_name"; \
		exit 1; \
	fi
	@echo "Creating migration: $(NAME)"
	@go run -mod=mod ./ent/migrate/main.go -name=$(NAME)

migrate\:checksum:
	@echo "Regenerating checksum..."
	@go run -mod=mod ./ent/migrate/main.go -checksum

interfaces:
	@echo "Generating interfaces..."
	@go generate ./internal/repositories/...
	@go generate ./internal/infrastructure/...
	@go generate ./internal/services/...
	@go generate ./internal/deployctl/...
	@echo "Generating mocks..."
	@go run github.com/vektra/mockery/v2@latest

ent:
	@echo "Generating entities..."
	@go generate ./ent/...

fmt:
	@echo "Formatting Go code..."
	@go fmt ./...

tests:
	@echo "Running tests..."
	@go test -v ./...
