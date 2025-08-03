# Use official Node.js base image
FROM node:18

# Set working directory inside the container
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your code
COPY . .

# Expose your app port (change if using something other than 3000)
EXPOSE 5000

# Start the app
CMD ["npm", "run", "start"]
