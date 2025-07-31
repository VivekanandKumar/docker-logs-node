FROM node:24-alpine

# Set working directory
WORKDIR /projects/docker-logs

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code after installing dependencies
COPY src ./src

# Start the application
CMD [ "node","./src/index.js" ]
