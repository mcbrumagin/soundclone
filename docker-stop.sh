#!/bin/bash

# Stop and cleanup SoundClone Docker containers

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

NETWORK_NAME="soundclone-network"
MAIN_CONTAINER="soundclone-main"
FFMPEG_CONTAINER="soundclone-ffmpeg"

echo -e "${BLUE}🛑 Stopping SoundClone containers...${NC}"

# Stop containers
docker stop $MAIN_CONTAINER $FFMPEG_CONTAINER 2>/dev/null || true

# Remove containers
docker rm $MAIN_CONTAINER $FFMPEG_CONTAINER 2>/dev/null || true

# Remove network
docker network rm $NETWORK_NAME 2>/dev/null || true

echo -e "${GREEN}✓ All containers and network cleaned up${NC}"

