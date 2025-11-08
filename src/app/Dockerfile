# syntax=docker/dockerfile:1
# Build
FROM node:lts-alpine AS build
WORKDIR /soundclone

COPY package*.json ./
RUN npm install

WORKDIR /soundclone/app
COPY . .


# Deploy
FROM node:lts-alpine
WORKDIR /soundclone

# Copy application files and dependencies
COPY --from=build /soundclone/app/ ./app/
COPY --from=build /soundclone/node_modules/ ./node_modules/

# Copy shared library files from build context
COPY --from=shared-lib . ./lib/

ENV MICRO_REGISTRY_URL="http://localhost:10000"
ENV ADMIN_USER="admin"
ENV ADMIN_SECRET="password"

EXPOSE 10000

WORKDIR /soundclone
CMD ["node", "app/app.js"]
