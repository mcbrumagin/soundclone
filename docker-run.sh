#!/bin/bash

# Docker test script for SoundClone microservices
# Runs main service + ffmpeg service in separate containers with networking

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐳 SoundClone Docker Test Environment${NC}"
echo ""

# Configuration
NETWORK_NAME="soundclone-network"
MAIN_CONTAINER="soundclone-main"
FFMPEG_CONTAINER="soundclone-ffmpeg"
MAIN_PORT=4000
FFMPEG_PORT=4001

# Use environment variables from shell or defaults
export ENVIRONMENT="${ENVIRONMENT:-dev}"
export LOG_LEVEL="${LOG_LEVEL:-debug}"
export LOG_INCLUDE_LINES="${LOG_INCLUDE_LINES:-true}"
export LOG_EXCLUDE_FULL_PATH_IN_LOG_LINES="${LOG_EXCLUDE_FULL_PATH_IN_LOG_LINES:-true}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export S3_BUCKET_NAME="${S3_BUCKET_NAME:-soundclone-data}"
export S3_PREFIX="${S3_PREFIX:-soundclone-local/}"
export ADMIN_USER="${ADMIN_USER:-admin}"
export ADMIN_SECRET="${ADMIN_SECRET:-password}"

# Check for required AWS credentials
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo -e "${YELLOW}⚠️  Warning: AWS credentials not found in environment${NC}"
  echo -e "${YELLOW}   Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY for S3 functionality${NC}"
  echo ""
fi

# Cleanup function
cleanup() {
  echo ""
  echo -e "${YELLOW}🧹 Cleaning up containers...${NC}"
  docker stop $MAIN_CONTAINER $FFMPEG_CONTAINER 2>/dev/null || true
  docker rm $MAIN_CONTAINER $FFMPEG_CONTAINER 2>/dev/null || true
  echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Trap Ctrl+C and cleanup
trap cleanup EXIT INT TERM

# Create Docker network if it doesn't exist
echo -e "${BLUE}📡 Setting up Docker network...${NC}"
docker network inspect $NETWORK_NAME >/dev/null 2>&1 || \
  docker network create $NETWORK_NAME
echo -e "${GREEN}✓ Network ready: $NETWORK_NAME${NC}"
echo ""

# Build main service using buildx with shared lib context
echo -e "${BLUE}🔨 Building main service with buildx...${NC}"
docker buildx build \
  --load \
  --build-context shared-lib=src/lib \
  -t soundclone-main:latest \
  -f src/app/Dockerfile \
  src/app/
echo -e "${GREEN}✓ Main service built${NC}"
echo ""

# Build ffmpeg service using buildx with shared lib context
echo -e "${BLUE}🔨 Building ffmpeg service with buildx...${NC}"
docker buildx build \
  --load \
  --build-context shared-lib=src/lib \
  -t soundclone-ffmpeg:latest \
  -f src/ffmpeg/Dockerfile \
  src/ffmpeg/
echo -e "${GREEN}✓ FFmpeg service built${NC}"
echo ""

# # Stop and remove existing containers
# docker stop $MAIN_CONTAINER $FFMPEG_CONTAINER 2>/dev/null || true
# docker rm $MAIN_CONTAINER $FFMPEG_CONTAINER 2>/dev/null || true

# Start main service
echo -e "${BLUE}🚀 Starting main service...${NC}"
docker run -d \
  --name $MAIN_CONTAINER \
  --network $NETWORK_NAME \
  -p $MAIN_PORT:10000 \
  -e MICRO_REGISTRY_URL="http://$MAIN_CONTAINER:10000" \
  -e ENVIRONMENT="$ENVIRONMENT" \
  -e NODE_MODULES_DIR="../../node_modules" \
  -e LOG_LEVEL="$LOG_LEVEL" \
  -e LOG_INCLUDE_LINES="$LOG_INCLUDE_LINES" \
  -e LOG_EXCLUDE_FULL_PATH_IN_LOG_LINES="$LOG_EXCLUDE_FULL_PATH_IN_LOG_LINES" \
  -e AWS_REGION="$AWS_REGION" \
  -e S3_BUCKET_NAME="$S3_BUCKET_NAME" \
  -e S3_PREFIX="$S3_PREFIX" \
  -e ADMIN_USER="$ADMIN_USER" \
  -e ADMIN_SECRET="$ADMIN_SECRET" \
  -e AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}" \
  -e AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}" \
  soundclone-main:latest

echo -e "${GREEN}✓ Main service started on http://localhost:$MAIN_PORT${NC}"
echo ""

# Wait for main service to be ready
echo -e "${BLUE}⏳ Waiting for main service to be ready...${NC}"
sleep 3

# Start ffmpeg service
echo -e "${BLUE}🚀 Starting ffmpeg service...${NC}"
docker run -d \
  --name $FFMPEG_CONTAINER \
  --network $NETWORK_NAME \
  -p $FFMPEG_PORT:11000 \
  -e MICRO_REGISTRY_URL="http://$MAIN_CONTAINER:10000" \
  -e MICRO_SERVICE_URL="http://$FFMPEG_CONTAINER:11000" \
  -e ENVIRONMENT="$ENVIRONMENT" \
  -e LOG_LEVEL="$LOG_LEVEL" \
  soundclone-ffmpeg:latest

echo -e "${GREEN}✓ FFmpeg service started${NC}"
echo ""

# Show running containers
echo -e "${BLUE}📊 Running containers:${NC}"
docker ps --filter "name=soundclone-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Show logs
echo -e "${BLUE}📋 Streaming logs (Ctrl+C to stop):${NC}"
echo -e "${YELLOW}─────────────────────────────────────────────────────────${NC}"
echo ""

# Follow logs from both containers
docker logs -f $MAIN_CONTAINER 2>&1 &
MAIN_PID=$!
docker logs -f $FFMPEG_CONTAINER 2>&1 &
FFMPEG_PID=$!

# Wait for user interrupt
wait $MAIN_PID $FFMPEG_PID

