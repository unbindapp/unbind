#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

CLUSTER=unbind-dev
COMPOSE=deploy/compose/docker-compose.yaml
RUN_DIR=apps/api/.data/dev
PID_FILE=$RUN_DIR/dev.pid
LOG_FILE=$RUN_DIR/dev.log
START_TIMEOUT=900

log() { printf '\033[1;34m[dev-env]\033[0m %s\n' "$*"; }

usage() {
  echo "usage: $0 status|start|stop|reset" >&2
  exit 1
}

compose_state() {
  local running all
  running=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -c '^unbind_\(postgres\|redis\)$' || true)
  all=$(docker ps -a --format '{{.Names}}' 2>/dev/null | grep -c '^unbind_\(postgres\|redis\)$' || true)
  if [ "$running" = 2 ]; then
    echo up
  elif [ "$all" -gt 0 ]; then
    echo stopped
  else
    echo missing
  fi
}

cluster_state() {
  k3d cluster list --no-headers 2>/dev/null | awk -v c="$CLUSTER" '
    $1 == c { split($2, s, "/"); state = (s[1] > 0) ? "up" : "stopped" }
    END { print (state ? state : "missing") }'
}

http_state() {
  if curl -fsS -o /dev/null --max-time 2 "$1" 2>/dev/null; then
    echo up
  else
    echo down
  fi
}

dev_pid() {
  [ -f "$PID_FILE" ] || return 1
  local pid
  pid=$(cat "$PID_FILE")
  kill -0 "$pid" 2>/dev/null || return 1
  echo "$pid"
}

status() {
  local api ui pid
  api=$(http_state http://localhost:8089/health)
  ui=$(http_state http://localhost:5173)
  if pid=$(dev_pid); then
    [ "$api" = up ] || api=starting
    [ "$ui" = up ] || ui=starting
  fi
  printf 'postgres+redis   %s\n' "$(compose_state)"
  printf 'cluster          %s\n' "$(cluster_state)"
  printf 'api    :8089     %s\n' "$api"
  printf 'ui     :5173     %s\n' "$ui"
  if [ -n "${pid:-}" ]; then
    printf 'dev.sh           pid %s, log %s\n' "$pid" "$LOG_FILE"
  fi
}

start() {
  if dev_pid >/dev/null; then
    log "already running"
    status
    return
  fi
  if [ "$(http_state http://localhost:8089/health)" = up ]; then
    log "something else is already serving :8089 (make dev in another terminal?); leaving it alone"
    status
    return
  fi

  mkdir -p "$RUN_DIR"
  setsid nohup ./scripts/dev.sh >"$LOG_FILE" 2>&1 </dev/null &
  echo $! >"$PID_FILE"
  log "starting in the background, log at $LOG_FILE"

  local waited=0
  until [ "$(http_state http://localhost:5173)" = up ]; do
    if ! dev_pid >/dev/null; then
      log "dev.sh exited before the UI came up; last log lines:"
      tail -20 "$LOG_FILE"
      exit 1
    fi
    if [ "$waited" -ge "$START_TIMEOUT" ]; then
      log "gave up waiting after ${START_TIMEOUT}s; see $LOG_FILE"
      exit 1
    fi
    sleep 2
    waited=$((waited + 2))
    if [ $((waited % 30)) -eq 0 ]; then
      log "still starting (${waited}s)"
    fi
  done
  status
}

stop_processes() {
  local pid
  pid=$(dev_pid) || return 0
  log "stopping dev.sh (pid $pid)"
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  local waited=0
  while kill -0 "$pid" 2>/dev/null && [ "$waited" -lt 30 ]; do
    sleep 1
    waited=$((waited + 1))
  done
  kill -KILL -- "-$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
}

stop() {
  stop_processes
  if [ "$(cluster_state)" = up ]; then
    log "stopping cluster $CLUSTER"
    k3d cluster stop "$CLUSTER"
  fi
  if [ "$(compose_state)" = up ]; then
    log "stopping Postgres + Redis"
    docker compose -f "$COMPOSE" stop
  fi
  status
}

reset() {
  stop_processes
  if [ "$(cluster_state)" != missing ]; then
    log "deleting cluster $CLUSTER"
    ./scripts/dev-cluster.sh down
  fi
  log "removing Postgres + Redis and their data"
  docker compose -f "$COMPOSE" down
  find deploy/compose/.data/postgres -mindepth 1 ! -name .gitkeep -exec rm -rf {} +
  rm -f "$LOG_FILE"
  status
}

case "${1:-}" in
  status) status ;;
  start) start ;;
  stop) stop ;;
  reset) reset ;;
  *) usage ;;
esac
