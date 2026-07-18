.PHONY: help dev dev-infra dev-infra-down dev-cluster dev-cluster-down dev-api dev-web web embed app run clean gen-web-types check-web-types \
	api-ent api-interfaces api-migrate api-migrate-checksum api-test api-fmt api-run \
	web-build web-dev web-lint web-typecheck web-gen \
	operator-generate operator-manifests operator-build operator-run operator-test \
	installer-build installer-run

WEB_DIR := apps/web
API_DIR := apps/api
OPERATOR_DIR := apps/operator
INSTALLER_DIR := apps/installer
EMBED_DIR := $(API_DIR)/internal/web/dist
COMPOSE := deploy/compose/docker-compose.yaml

help:
	@echo "Local development (no Docker for the app itself):"
	@echo "  make dev              - Everything: infra + cluster + API + Vite dev server (hot reload)"
	@echo "  make dev-infra        - Start Postgres + Redis (docker compose)"
	@echo "  make dev-infra-down   - Stop Postgres + Redis"
	@echo "  make dev-cluster      - Create the local k3d cluster (full helmfile stack; SYNC=1 to re-sync charts)"
	@echo "  make dev-cluster-down - Delete the local k3d cluster"
	@echo "  make dev-api          - Run the API with hot reload-free Go (serves the stub SPA + API on :8089)"
	@echo "  make dev-web          - Run the Vite dev server (:5173), proxying /api/go to the API"
	@echo ""
	@echo "Production-like single binary (SPA embedded in the API):"
	@echo "  make web              - Build the SPA to $(WEB_DIR)/dist"
	@echo "  make embed            - Copy the SPA build into $(EMBED_DIR)"
	@echo "  make app              - web + embed + build $(API_DIR)/bin/unbind"
	@echo "  make run              - Build the single binary and run it on :8089"
	@echo ""
	@echo "Web client types (generated from the API's OpenAPI spec, no server needed):"
	@echo "  make gen-web-types    - Regenerate apps/web client types from the local API code"
	@echo "  make check-web-types  - Fail if the committed web types are out of sync with the API"
	@echo ""
	@echo "API (apps/api):"
	@echo "  make api-ent          - Generate ent entities"
	@echo "  make api-interfaces   - Generate interfaces and mocks"
	@echo "  make api-migrate NAME=x - Create a migration"
	@echo "  make api-migrate-checksum - Regenerate migration checksum"
	@echo "  make api-test         - Run API tests"
	@echo "  make api-fmt          - Format API code"
	@echo "  make api-run          - Run the API"
	@echo ""
	@echo "Web (apps/web):"
	@echo "  make web-build / web-dev / web-lint / web-typecheck / web-gen"
	@echo ""
	@echo "Operator (apps/operator):"
	@echo "  make operator-generate / operator-manifests / operator-build / operator-run / operator-test"
	@echo ""
	@echo "Installer (apps/installer):"
	@echo "  make installer-build / installer-run"

dev:
	./scripts/dev.sh

# --- Local infra ---
dev-infra:
	docker compose -f $(COMPOSE) up -d

dev-infra-down:
	docker compose -f $(COMPOSE) down

dev-cluster:
	SYNC=$(SYNC) ./scripts/dev-cluster.sh up

dev-cluster-down:
	./scripts/dev-cluster.sh down

# --- Two-process dev loop (hot reload for the UI) ---
dev-api:
	cd $(API_DIR) && go run ./cmd/api

dev-web:
	cd $(WEB_DIR) && VITE_DEV_API_PROXY=http://localhost:8089 npm run dev

# --- Single-binary build (the API serves the real SPA) ---
web:
	cd $(WEB_DIR) && npm run build

embed: web
	rm -rf $(EMBED_DIR)
	cp -r $(WEB_DIR)/dist $(EMBED_DIR)

app: embed
	cd $(API_DIR) && CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o bin/unbind ./cmd/api

run: app
	cd $(API_DIR) && ./bin/unbind

clean:
	rm -rf $(WEB_DIR)/dist $(API_DIR)/bin
	git checkout -- $(EMBED_DIR)/index.html 2>/dev/null || true

# --- Web client type generation ---
gen-web-types:
	./scripts/gen-web-types.sh

check-web-types:
	./scripts/check-web-types.sh

# --- API (apps/api) ---
api-ent:
	$(MAKE) -C $(API_DIR) ent

api-interfaces:
	$(MAKE) -C $(API_DIR) interfaces

api-migrate:
	$(MAKE) -C $(API_DIR) migrate NAME=$(NAME)

api-migrate-checksum:
	$(MAKE) -C $(API_DIR) migrate:checksum

api-test:
	$(MAKE) -C $(API_DIR) tests

api-fmt:
	$(MAKE) -C $(API_DIR) fmt

api-run:
	cd $(API_DIR) && go run ./cmd/api

# --- Web (apps/web) ---
web-build:
	cd $(WEB_DIR) && npm run build

web-dev:
	cd $(WEB_DIR) && npm run dev

web-lint:
	cd $(WEB_DIR) && npm run lint

web-typecheck:
	cd $(WEB_DIR) && npm run typecheck

web-gen:
	cd $(WEB_DIR) && npm run generate-sdk

# --- Operator (apps/operator) ---
operator-generate:
	$(MAKE) -C $(OPERATOR_DIR) generate

operator-manifests:
	$(MAKE) -C $(OPERATOR_DIR) manifests

operator-build:
	$(MAKE) -C $(OPERATOR_DIR) build

operator-run:
	$(MAKE) -C $(OPERATOR_DIR) run

operator-test:
	$(MAKE) -C $(OPERATOR_DIR) test

# --- Installer (apps/installer) ---
installer-build:
	cd $(INSTALLER_DIR) && go build -o bin/installer ./cmd

installer-run:
	cd $(INSTALLER_DIR) && go run ./cmd
