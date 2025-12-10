# Use a lightweight Node image based on Alpine Linux
FROM node:18-alpine

# Install procps (contains top, free, etc.) and coreutils
# Alpine doesn't include these standard versions by default
# Added iproute2 to support the 'ip' command for network stats
RUN apk add --no-cache procps coreutils iproute2

WORKDIR /app

# Create package.json inline for simplicity
RUN echo '{"name":"sys-mon","version":"1.0.0","main":"server.js","dependencies":{"express":"^4.18.2"}}' > package.json

# Install Node dependencies
RUN npm install

# Copy server file
COPY server.js .

# Copy html file (optional, if we wanted to serve it via express, 
# but currently we open index.html directly)
COPY index.html .

EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
