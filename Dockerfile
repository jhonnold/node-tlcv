FROM node:lts-alpine as build

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

RUN npm install

COPY . ./

RUN npm run build

VOLUME /config
VOLUME /pgns

ENV LOG_LEVEL=info \
    TLCV_PASSWORD=admin \
    PGNS_DIR=/pgns \
    CONFIG_DIR=/config

EXPOSE 8080
CMD ["npm", "start"]
