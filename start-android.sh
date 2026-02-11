#!/bin/bash

# Script pour lancer l'émulateur Android proprement

echo "🚀 Lancement de l'émulateur Android..."

# Configuration
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Tuer les processus existants
echo "🧹 Nettoyage des processus existants..."
pkill -9 qemu-system 2>/dev/null
$ANDROID_HOME/platform-tools/adb kill-server 2>/dev/null

# Attendre un peu
sleep 2

# Démarrer le serveur ADB
echo "🔧 Démarrage du serveur ADB..."
$ANDROID_HOME/platform-tools/adb start-server

# Lancer l'émulateur
echo "📱 Lancement de l'émulateur Medium_Phone_API_36..."
echo "⏳ Attendez 30-60 secondes que l'émulateur démarre complètement..."
$ANDROID_HOME/emulator/emulator -avd Medium_Phone_API_36 -no-snapshot-load &

# Attendre que l'émulateur soit prêt
echo "⌛ Attente du démarrage de l'émulateur..."
$ANDROID_HOME/platform-tools/adb wait-for-device

echo "✅ Émulateur prêt !"
echo ""
echo "Vous pouvez maintenant lancer votre app avec : npm start"
echo "Puis appuyez sur 'a' pour Android"
