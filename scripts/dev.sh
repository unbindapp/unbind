#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE=deploy/compose/docker-compose.yaml

log() { printf '\033[1;34m[dev]\033[0m %s\n' "$*"; }

if ! command -v k3d >/dev/null; then
  log "k3d not found on PATH; re-launching inside nix develop"
  exec nix develop --command ./scripts/dev.sh "$@"
fi

if docker ps --format '{{.Names}}' | grep -q '^unbind_postgres$'; then
  log "Postgres + Redis already running"
else
  log "starting Postgres + Redis via docker compose"
  docker compose -f "$COMPOSE" up -d
fi

log "bringing up the k3d cluster"
./scripts/dev-cluster.sh up

K3D_KUBECONFIG=./.data/kubernetes/k3d.kubeconfig.yaml
env_kubeconfig=$(sed -n 's/^KUBECONFIG=//p' apps/api/.env)
if [ "$env_kubeconfig" != "$K3D_KUBECONFIG" ]; then
  log "apps/api/.env KUBECONFIG pointed at '${env_kubeconfig:-<unset>}'; pinning to the local k3d cluster"
  grep -v '^KUBECONFIG=' apps/api/.env > apps/api/.env.tmp || true
  printf 'KUBECONFIG=%s\n' "$K3D_KUBECONFIG" >> apps/api/.env.tmp
  mv apps/api/.env.tmp apps/api/.env
fi

grep -q '^BUILDER_POSTGRES_HOST=' apps/api/.env || printf 'BUILDER_POSTGRES_HOST=172.17.0.1\n' >> apps/api/.env

if [ ! -d apps/web/node_modules ]; then
  log "installing web dependencies (npm ci)"
  (cd apps/web && npm ci)
fi

trap 'kill 0' INT TERM EXIT

export KUBECONFIG="$PWD/apps/api/.data/kubernetes/k3d.kubeconfig.yaml"
log "starting port-forwards for Loki (:3100) and VictoriaMetrics (:8428)"
# port-forward dies when the target pod restarts; keep them alive
(while true; do kubectl -n unbind-system port-forward svc/loki-gateway 3100:80 >/dev/null 2>&1; sleep 2; done) &
(while true; do kubectl -n unbind-system port-forward svc/vmsingle-victoria-metrics-k8s-stack 8428:8428 >/dev/null 2>&1; sleep 2; done) &

log "starting the API on :8089 (go run compiles first, this can take a bit)"
(cd apps/api && go run ./cmd/api) &
api_pid=$!

waited=0
until curl -fsS -o /dev/null http://localhost:8089/health 2>/dev/null; do
  if ! kill -0 "$api_pid" 2>/dev/null; then
    log "API process exited before becoming healthy; see the output above"
    exit 1
  fi
  sleep 1
  waited=$((waited + 1))
  if [ $((waited % 10)) -eq 0 ]; then
    log "still waiting for the API to be healthy (${waited}s)"
  fi
done
log "API is healthy after ${waited}s"

log "starting the Vite dev server on :5173"
(cd apps/web && VITE_DEV_API_PROXY=http://localhost:8089 npm run dev) &

log "API on http://localhost:8089, UI on http://localhost:5173 (Ctrl-C stops both)"
wait
