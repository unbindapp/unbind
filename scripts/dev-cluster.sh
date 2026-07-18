#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

CLUSTER=unbind-dev
NAMESPACE=unbind-system
KUBECONFIG_PATH=apps/api/.data/kubernetes/k3d.kubeconfig.yaml
# Flux's preflight check requires Kubernetes >=1.33; k3d's default k3s is older.
K3S_IMAGE=rancher/k3s:v1.36.2-k3s1

usage() {
  echo "usage: $0 up|down" >&2
  exit 1
}

require_tools() {
  for tool in k3d kubectl helm helmfile; do
    command -v "$tool" >/dev/null && continue
    echo "$tool not found; enter the dev shell first: nix develop" >&2
    exit 1
  done
}

up() {
  if ! k3d cluster get "$CLUSTER" >/dev/null 2>&1; then
    k3d cluster create "$CLUSTER" \
      --image "$K3S_IMAGE" \
      --registry-config deploy/k3d/registries.yaml \
      -p 80:80@loadbalancer \
      -p 443:443@loadbalancer \
      --k3s-arg "--disable=traefik@server:0" \
      --k3s-arg "--kubelet-arg=eviction-hard=nodefs.available<5%,imagefs.available<5%@server:0" \
      --kubeconfig-update-default=false \
      --kubeconfig-switch-context=false \
      --wait
  fi

  mkdir -p "$(dirname "$KUBECONFIG_PATH")"
  k3d kubeconfig get "$CLUSTER" > "$KUBECONFIG_PATH"
  export KUBECONFIG="$PWD/$KUBECONFIG_PATH"

  kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
  kubectl apply --server-side -f apps/operator/config/crd/bases
  # The unbind-app chart normally creates the builder SA/RBAC; dev skips that release.
  kubectl apply -f deploy/k8s/builder/rbac.yaml

  if [ "${SYNC:-}" = 1 ] || ! helm status unbind-operator -n "$NAMESPACE" >/dev/null 2>&1; then
    helmfile -f deploy/charts/helmfile.yaml.gotmpl -e dev sync
  fi

  if [ ! -f apps/api/.env ]; then
    cp apps/api/.env.example apps/api/.env
  fi

  echo "Cluster '$CLUSTER' ready; kubeconfig written to $KUBECONFIG_PATH"
}

down() {
  k3d cluster delete "$CLUSTER"
  rm -f "$KUBECONFIG_PATH"
}

require_tools

case "${1:-}" in
  up) up ;;
  down) down ;;
  *) usage ;;
esac
