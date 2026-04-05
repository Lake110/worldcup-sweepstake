FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install && npm install d3 @types/d3
COPY . .
EXPOSE 5173