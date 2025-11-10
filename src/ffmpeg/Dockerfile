# syntax=docker/dockerfile:1
# Build
FROM node:lts-alpine AS build
WORKDIR /ffmpeg

# lib also needs packages, so install them here
COPY package*.json ./
RUN npm install

WORKDIR /ffmpeg/app
COPY *.js ./


# Install ffmpeg and dependencies
RUN apk add --no-cache ffmpeg

# Deploy
FROM node:lts-alpine
WORKDIR /ffmpeg


RUN apk add --no-cache ffmpeg

# Copy application files
COPY --from=build /ffmpeg/app/*.js ./app/
COPY --from=build /ffmpeg/node_modules/ ./node_modules/

# Copy shared library files from build context
COPY --from=shared-lib . ./lib/

# TODO Copy ffmpeg/ffprobe binaries and dependencies from build stage
# COPY --from=build /usr/bin/ffmpeg /usr/bin/ffmpeg
# COPY --from=build /usr/bin/ffprobe /usr/bin/ffprobe
# COPY --from=build /usr/lib/libavcodec.so* /usr/lib/
# COPY --from=build /usr/lib/libavformat.so* /usr/lib/
# COPY --from=build /usr/lib/libavutil.so* /usr/lib/
# COPY --from=build /usr/lib/libswresample.so* /usr/lib/
# COPY --from=build /usr/lib/libswscale.so* /usr/lib/
# COPY --from=build /usr/lib/libpostproc.so* /usr/lib/
# COPY --from=build /usr/lib/libavfilter.so* /usr/lib/

ENV MICRO_REGISTRY_URL="http://localhost:10000"
ENV MICRO_SERVICE_URL="http://localhost:11000"

EXPOSE 11000

WORKDIR /ffmpeg
CMD ["node", "app/app.js"]
