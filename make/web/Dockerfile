FROM node:20-alpine

WORKDIR /opt/frontend

# Copy the optimized production build
COPY frontend/nexent-dist /opt/frontend

# Expose the service port
EXPOSE 3000

# Start the server
CMD ["npm", "start"] 