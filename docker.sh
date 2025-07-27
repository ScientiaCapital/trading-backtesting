#!/bin/bash
# Docker wrapper script to use the correct Docker binary

export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
export DOCKER_CONFIG="$HOME/.docker"

# Run docker with all arguments
exec /Applications/Docker.app/Contents/Resources/bin/docker "$@"
