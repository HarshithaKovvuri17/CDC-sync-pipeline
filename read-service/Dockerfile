FROM node:20-alpine

WORKDIR /app

# Install wget for healthcheck
RUN apk add --no-cache wget

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

EXPOSE 8081

ENV NODE_ENV=production

CMD ["node", "src/server.js"]