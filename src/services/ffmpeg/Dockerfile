# TODO instll ffmpeg and ffprobe

FROM alpine:latest

RUN apk add --no-cache ffmpeg

COPY audio-transcode.js .

CMD ["node", "audio-transcode.js"]