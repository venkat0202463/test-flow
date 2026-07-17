# Stage 1: Build the React application
FROM public.ecr.aws/docker/library/node:20-alpine AS build
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Build-time environment variables for Vite
ARG VITE_API_URL
ARG VITE_APP_URL
ARG VITE_ENCRYPTION_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_URL=$VITE_APP_URL
ENV VITE_ENCRYPTION_KEY=$VITE_ENCRYPTION_KEY

# Build the project
RUN npm run build

# Stage 2: Serve the static files with Nginx
FROM public.ecr.aws/docker/library/nginx:stable-alpine
# Copy the build output to nginx document root
COPY --from=build /app/dist /usr/share/nginx/html
# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
