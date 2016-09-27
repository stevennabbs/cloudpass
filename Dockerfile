FROM node:4

ENV NODE_ENV=production
ENV NODE_APP_INSTANCE=docker

RUN mkdir -p /app
WORKDIR /app
COPY package.json .
RUN npm install --production
RUN npm install sqlite3
COPY swagger swagger/
COPY migrations migrations/
COPY src src/
COPY config/default.yaml config/default-docker.yaml config/custom-environment-variables.yaml config/

EXPOSE 10010

CMD [ "npm", "start" ]
