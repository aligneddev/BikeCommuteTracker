#!/bin/bash
set -e

echo "🔧 Bike Tracking DevContainer post-creation setup..."

# Install .NET global tools
echo "📦 Installing .NET global tools..."
dotnet tool install csharpier -g 2>/dev/null || dotnet tool update csharpier -g

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd src/BikeTracking.Frontend
npm install
cd ../..

# Restore NuGet packages
echo "📦 Restoring NuGet packages..."
dotnet restore

# Build solution to verify setup
echo "🔨 Building solution..."
dotnet build

echo "✅ DevContainer setup complete!"
echo ""
echo "🚀 To start the full application, run:"
echo "   dotnet run --project src/BikeTracking.AppHost"
echo ""
echo "📝 For more details, see README.md"
