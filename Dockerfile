# Build
FROM node:lts-alpine AS build
WORKDIR /app

COPY package*.json ./

COPY . .

RUN npm install

# Deploy
FROM node:lts-alpine
WORKDIR /app

COPY --from=build /app/src/ ./src/
COPY --from=build /app/node_modules/ ./node_modules/

ENV MICRO_REGISTRY_URL="http://localhost:10000"
ENV ADMIN_USER="admin"
ENV ADMIN_SECRET="password"

EXPOSE 10000

WORKDIR /app/src

CMD ["node", "server.js"]
