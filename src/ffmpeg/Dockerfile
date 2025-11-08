# Build
FROM node:lts-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY . .

RUN apk add --no-cache ffmpeg
RUN npm install

# Deploy
FROM node:lts-alpine
WORKDIR /app

# Copy application files
COPY --from=build /app/*.js ./
COPY --from=build /app/node_modules/ ./node_modules/

# Copy shared library files from src-ffmpeg
COPY src-ffmpeg/lib/ ./lib/

# Copy ffmpeg/ffprobe binaries and dependencies from build stage
COPY --from=build /usr/bin/ffmpeg /usr/bin/ffmpeg
COPY --from=build /usr/bin/ffprobe /usr/bin/ffprobe
COPY --from=build /usr/lib/libavcodec.so* /usr/lib/
COPY --from=build /usr/lib/libavformat.so* /usr/lib/
COPY --from=build /usr/lib/libavutil.so* /usr/lib/
COPY --from=build /usr/lib/libswresample.so* /usr/lib/
COPY --from=build /usr/lib/libswscale.so* /usr/lib/
COPY --from=build /usr/lib/libpostproc.so* /usr/lib/
COPY --from=build /usr/lib/libavfilter.so* /usr/lib/

ENV MICRO_REGISTRY_URL="http://localhost:10000"
ENV MICRO_SERVICE_URL="http://localhost:11000"

EXPOSE 11000

CMD ["node", "server.js"]

