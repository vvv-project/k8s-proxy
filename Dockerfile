FROM node:12.13.0

WORKDIR /usr/src/app

COPY package*.json ./

COPY *.js ./

RUN npm install

EXPOSE 3000

CMD ["npm", "start"]