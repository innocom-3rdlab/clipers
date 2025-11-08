# Stage 1: Base image with Node.js and system dependencies
FROM node:18-bullseye-slim

# Install Python and yt-dlp for video downloading
# Also install ffmpeg which is required for video processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    yt-dlp \
    ffmpeg \
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
