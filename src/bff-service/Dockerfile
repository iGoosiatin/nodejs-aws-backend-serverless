FROM node:22-alpine
WORKDIR /app
COPY ./package*.json ./
RUN npm ci
COPY ./index.ts .
USER node
EXPOSE 80
CMD ["npm", "start"]