#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

CLUSTER=unbind-dev
NAMESPACE=unbind-system
KUBECONFIG_PATH=apps/api/.data/kubernetes/k3d.kubeconfig.yaml
# Flux's preflight check requires Kubernetes >=1.33; k3d's default k3s is older.
K3S_IMAGE=rancher/k3s:v1.36.2-k3s1
# longhorn can't run on k3d (busybox nodes, no iscsiadm); hostpath CSI stands in as the
# expandable default class since local-path has no resizer and resizes on it never complete
CSI_HOSTPATH_REPO=https://github.com/kubernetes-csi/csi-driver-host-path.git
CSI_HOSTPATH_REF=v1.17.0
# outside the repo: anything under apps/ gets picked up by the pre-commit hooks
CSI_HOSTPATH_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/unbind-dev/csi-driver-host-path"

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

install_csi_hostpath() {
  if ! kubectl get csidriver hostpath.csi.k8s.io >/dev/null 2>&1; then
    if [ ! -d "$CSI_HOSTPATH_DIR" ]; then
      mkdir -p "$(dirname "$CSI_HOSTPATH_DIR")"
      git clone --depth 1 --branch "$CSI_HOSTPATH_REF" "$CSI_HOSTPATH_REPO" "$CSI_HOSTPATH_DIR"
    fi
    # its VolumeSnapshotClass apply fails harmlessly, the CRD isn't installed
    (cd "$CSI_HOSTPATH_DIR" && ./deploy/kubernetes-latest/deploy.sh) || true
    kubectl -n default rollout status statefulset/csi-hostpathplugin --timeout=180s
  fi

  kubectl apply -f - <<'YAML'
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: csi-hostpath-sc
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: hostpath.csi.k8s.io
reclaimPolicy: Delete
volumeBindingMode: Immediate
allowVolumeExpansion: true
YAML
  kubectl annotate sc local-path storageclass.kubernetes.io/is-default-class=false --overwrite
}

cluster_running() {
  k3d cluster list -o json 2>/dev/null | python3 -c '
import json, sys
name = sys.argv[1]
for c in json.load(sys.stdin):
    if c["name"] == name:
        sys.exit(0 if c["serversRunning"] > 0 else 1)
sys.exit(1)' "$CLUSTER"
}

up() {
  if k3d cluster get "$CLUSTER" >/dev/null 2>&1 && ! cluster_running; then
    k3d cluster start "$CLUSTER"
  fi

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
  # The unbind-app chart normally creates the builder and updater SA/RBAC; dev skips that release.
  kubectl apply -f deploy/k8s/builder/rbac.yaml
  kubectl apply -f deploy/k8s/updater/rbac.yaml

  if [ "${SYNC:-}" = 1 ] || ! helm status unbind-operator -n "$NAMESPACE" >/dev/null 2>&1; then
    helmfile -f deploy/charts/helmfile.yaml.gotmpl -e dev sync
  fi

  install_csi_hostpath

  # directory-backed provisioners report the whole host disk as every volume's usage
  if ! kubectl -n "$NAMESPACE" get vmnodescrape victoria-metrics-k8s-stack-kubelet -o jsonpath='{.spec.metricRelabelConfigs[*].regex}' | grep -q kubelet_volume_stats; then
    kubectl -n "$NAMESPACE" patch vmnodescrape victoria-metrics-k8s-stack-kubelet --type=json \
      -p '[{"op":"add","path":"/spec/metricRelabelConfigs/-","value":{"action":"drop","regex":"kubelet_volume_stats_.*","source_labels":["__name__"]}}]'
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
