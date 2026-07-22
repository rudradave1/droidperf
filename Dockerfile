FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY . .

EXPOSE 9000

ENV NODE_ENV=production

CMD ["node", "bin/droidperf.js", "ui", "--port", "9000"]
