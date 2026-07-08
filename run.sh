#!/usr/bin/env bash

if [[ -z "$CURRENT_SERVICE" ]]; then
    CURRENT_SERVICE=$(basename "$PWD")
fi
export COMPOSE_PROJECT_NAME="$CURRENT_SERVICE"
export SONGBOOK_DATA_SUBDIR="$CURRENT_SERVICE"

ensure_network() {
    local net=$1
    if ! docker network inspect "$net" >/dev/null 2>&1; then
        echo "Creating network: $net"
        docker network create "$net"
    fi
}
ensure_network caddy_net

export ADMIN_PASSWORD_HASH=$(echo -n "$ADMIN_PASSWORD" | sha256sum | awk '{print $1}')
export COMPOSE_FILE="docker-compose.yml"
docker compose $@
unset COMPOSE_FILE
unset SONGBOOK_DATA_SUBDIR
unset COMPOSE_PROJECT_NAME