#!/usr/bin/env bash

if [[ -z "$CURRENT_SERVICE" ]]; then
    CURRENT_SERVICE=$(basename "$PWD")
fi
export COMPOSE_PROJECT_NAME="$CURRENT_SERVICE"
export SONGBOOK_DATA_SUBDIR="$CURRENT_SERVICE"
export COMPOSE_FILE="docker-compose.yml"
docker compose $@
unset COMPOSE_FILE
unset SONGBOOK_DATA_SUBDIR
unset COMPOSE_PROJECT_NAME