# Dockerfile for DB Client Backend
FROM golang:1.24-alpine AS builder

# Install dependencies
RUN apk add --no-cache gcc musl-dev

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build with CGO enabled for SQLite
ENV CGO_ENABLED=1
RUN go build -o db-server .

# Production stage
FROM alpine:latest

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/db-server .
COPY --from=builder /app/frontend/dist ./frontend/dist

ENV DB_CLIENT_DATA_DIR=/data
ENV DB_CLIENT_LANG=zh

VOLUME ["/data"]

EXPOSE 8080

CMD ["./db-server"]
