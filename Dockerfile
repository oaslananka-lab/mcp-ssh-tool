FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts
COPY . .
RUN npm run build && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["npm", "run", "start:http"]
