FROM node:8-alpine

ENV NODE_ENV=production
ENV NODE_APP_INSTANCE=docker

RUN apk add --no-cache git
RUN mkdir -p /app
WORKDIR /app
COPY package.json .
RUN npm install --production
RUN npm install sqlite3
COPY swagger swagger/
COPY migrations migrations/
COPY src src/
COPY config/default.yaml config/default-docker.yaml config/custom-environment-variables.yaml config/

EXPOSE 10010 10011

CMD [ "npm", "start" ]
