# Frontend image (ADR 0008 operations base, item 10). Build from the repository root, so that the build stage
# can copy frontend/ and the runtime stage can copy infra/frontend/nginx.conf. No host build is needed first.
# Build stage: npm ci and npm run build in frontend/. Runtime stage: built files on the official nginx image.
FROM node:22-alpine AS build
WORKDIR /app/frontend
COPY frontend/ ./
RUN npm ci && npm run build

FROM nginx:1.31.2-alpine
COPY infra/frontend/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
USER 101
