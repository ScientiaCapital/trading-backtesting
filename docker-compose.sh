#!/bin/bash
# Docker Compose wrapper script

export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
export DOCKER_CONFIG="$HOME/.docker"

# Run docker compose with all arguments
exec /Applications/Docker.app/Contents/Resources/bin/docker compose "$@"
