#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE=deploy/compose/docker-compose.yaml

if ! command -v k3d >/dev/null; then
  exec nix develop --command ./scripts/dev.sh "$@"
fi

if ! docker ps --format '{{.Names}}' | grep -q '^unbind_postgres$'; then
  docker compose -f "$COMPOSE" up -d
fi

./scripts/dev-cluster.sh up

K3D_KUBECONFIG=./.data/kubernetes/k3d.kubeconfig.yaml
env_kubeconfig=$(sed -n 's/^KUBECONFIG=//p' apps/api/.env)
if [ "$env_kubeconfig" != "$K3D_KUBECONFIG" ]; then
  echo "apps/api/.env KUBECONFIG pointed at '${env_kubeconfig:-<unset>}'; pinning to the local k3d cluster"
  grep -v '^KUBECONFIG=' apps/api/.env > apps/api/.env.tmp || true
  printf 'KUBECONFIG=%s\n' "$K3D_KUBECONFIG" >> apps/api/.env.tmp
  mv apps/api/.env.tmp apps/api/.env
fi

grep -q '^BUILDER_POSTGRES_HOST=' apps/api/.env || printf 'BUILDER_POSTGRES_HOST=172.17.0.1\n' >> apps/api/.env

if [ ! -d apps/web/node_modules ]; then
  (cd apps/web && npm ci)
fi

trap 'kill 0' INT TERM EXIT

export KUBECONFIG="$PWD/apps/api/.data/kubernetes/k3d.kubeconfig.yaml"
# port-forward dies when the target pod restarts; keep them alive
(while true; do kubectl -n unbind-system port-forward svc/loki-gateway 3100:80 >/dev/null 2>&1; sleep 2; done) &
(while true; do kubectl -n unbind-system port-forward svc/vmsingle-victoria-metrics-k8s-stack 8428:8428 >/dev/null 2>&1; sleep 2; done) &

(cd apps/api && go run ./cmd/api) &
(cd apps/web && VITE_DEV_API_PROXY=http://localhost:8089 npm run dev) &

echo "API on http://localhost:8089, UI on http://localhost:5173 (Ctrl-C stops both)"
wait
