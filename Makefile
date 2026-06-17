.PHONY: help dev-infra dev-infra-down dev-api dev-web web embed app run clean

WEB_DIR := apps/web
API_DIR := apps/api
EMBED_DIR := $(API_DIR)/internal/web/dist
COMPOSE := deploy/compose/docker-compose.yaml

help:
	@echo "Local development (no Docker for the app itself):"
	@echo "  make dev-infra        - Start Postgres + Redis (docker compose)"
	@echo "  make dev-infra-down   - Stop Postgres + Redis"
	@echo "  make dev-api          - Run the API with hot reload-free Go (serves the stub SPA + API on :8089)"
	@echo "  make dev-web          - Run the Vite dev server (:5173), proxying /api/go to the API"
	@echo ""
	@echo "Production-like single binary (SPA embedded in the API):"
	@echo "  make web              - Build the SPA to $(WEB_DIR)/dist"
	@echo "  make embed            - Copy the SPA build into $(EMBED_DIR)"
	@echo "  make app              - web + embed + build $(API_DIR)/bin/unbind"
	@echo "  make run              - Build the single binary and run it on :8089"

# --- Local infra ---
dev-infra:
	docker compose -f $(COMPOSE) up -d

dev-infra-down:
	docker compose -f $(COMPOSE) down

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
