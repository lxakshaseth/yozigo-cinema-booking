FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY web/package.json web/package-lock.json ./web/
RUN npm ci --prefix web
COPY . .
RUN npm run db:generate && npm run build

FROM node:24-alpine AS backend
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/web/dist ./web/dist
COPY --from=build /app/scripts/migrate-services.mjs ./scripts/migrate-services.mjs
COPY --from=build /app/scripts/migrate-data-to-services.mjs ./scripts/migrate-data-to-services.mjs
COPY --from=build /app/prisma/services ./prisma/services
CMD ["npm", "start"]

FROM nginx:1.27-alpine AS frontend
COPY --from=build /app/web/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
