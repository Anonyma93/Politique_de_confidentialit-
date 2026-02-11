#!/bin/bash
echo "🌐 Démarrage d'Expo avec adresse LAN..."
export REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.96
npx expo start --lan
