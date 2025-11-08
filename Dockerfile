# Stage 1: Base image with Node.js and system dependencies
FROM node:18-bullseye-slim

# Install Python, pip, yt-dlp, and ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    && pip3 install --no-cache-dir yt-dlp \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/app

# Install root dependencies
COPY package*.json ./
RUN npm install

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install

# Copy the rest of the application code
COPY . .

# The server listens on port 3000
EXPOSE 3000

# The command to start the server
CMD [ "npm", "start" ]
