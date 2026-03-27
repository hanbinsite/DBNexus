#!/bin/bash

# Build script for DB Client

echo "Building DB Client..."

# Create frontend dist directory if it doesn't exist
mkdir -p frontend/dist

# Build the application
wails build

echo "Build complete!"