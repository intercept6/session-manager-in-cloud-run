FROM node:16.13-alpine3.14

ENV TINI_VERSION v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]

WORKDIR /opt/app

COPY package*.json ./
RUN npm ci
COPY . ./
RUN npm run compile

CMD ["npm", "start"]
