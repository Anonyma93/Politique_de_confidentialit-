#!/bin/bash

echo "🚀 Démarrage complet de l'app sur Android..."

# Configuration
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools

# 1. Nettoyer tout
echo "🧹 Nettoyage..."
pkill -9 -f qemu-system-aarch64 2>/dev/null
pkill -9 -f "node.*expo" 2>/dev/null
$ANDROID_HOME/platform-tools/adb kill-server 2>/dev/null
sleep 2

# 2. Démarrer ADB
echo "🔧 Démarrage ADB..."
$ANDROID_HOME/platform-tools/adb start-server

# 3. Lancer l'émulateur
echo "📱 Lancement de l'émulateur..."
$ANDROID_HOME/emulator/emulator -avd Medium_Phone_API_36 -no-snapshot-load > /dev/null 2>&1 &
EMULATOR_PID=$!

# 4. Attendre que l'émulateur soit prêt
echo "⏳ Attente du démarrage de l'émulateur (30-60 secondes)..."
$ANDROID_HOME/platform-tools/adb wait-for-device
sleep 10  # Attendre que le système soit complètement chargé

# 5. Lancer Expo
echo "🎯 Lancement de l'app Expo..."
cd /Users/quentinmichaud/Desktop/Lini
npx expo start --android

echo ""
echo "✅ Terminé ! Pressez Ctrl+C pour tout arrêter."
