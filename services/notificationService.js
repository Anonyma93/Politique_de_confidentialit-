import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Configuration des notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Créer les canaux de notification pour Android
const setupNotificationChannels = async () => {
  if (Platform.OS === 'android') {
    // Canal pour les incidents
    await Notifications.setNotificationChannelAsync('incidents', {
      name: 'Incidents',
      description: 'Notifications pour les nouveaux incidents signalés',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });

    // Canal pour les commentaires
    await Notifications.setNotificationChannelAsync('comments', {
      name: 'Commentaires',
      description: 'Notifications pour les nouveaux commentaires sur vos posts',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4A90E2',
    });

    // Canal pour les likes
    await Notifications.setNotificationChannelAsync('likes', {
      name: 'Likes',
      description: 'Notifications pour les likes reçus sur vos posts',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 150, 150, 150],
      lightColor: '#FF6B9D',
    });

    // Canal pour les confirmations
    await Notifications.setNotificationChannelAsync('confirmations', {
      name: 'Confirmations',
      description: 'Notifications pour les confirmations reçues sur vos posts',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 150, 150, 150],
      lightColor: '#4CAF50',
    });

    console.log('✅ Canaux de notification Android créés');
  }
};

// Initialiser les canaux au démarrage
setupNotificationChannels();

// Demander les permissions de notification
export const requestNotificationPermissions = async () => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return { success: false, error: 'Permission refusée' };
    }

    // Configuration pour iOS
    if (Platform.OS === 'ios') {
      await Notifications.setNotificationCategoryAsync('incident', [
        {
          identifier: 'view',
          buttonTitle: 'Voir',
          options: {
            opensAppToForeground: true,
          },
        },
      ]);
    }

    return { success: true };
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return { success: false, error: error.message };
  }
};

// Vérifier si on doit envoyer une notification selon les préférences
export const shouldSendNotification = async (post) => {
  try {
    // Vérifier si les notifications sont activées
    const notificationsEnabled = await AsyncStorage.getItem('notificationsEnabled');
    if (notificationsEnabled !== 'true') {
      return false;
    }

    // Vérifier la gravité
    const selectedSeveritiesStr = await AsyncStorage.getItem('selectedSeverities');
    if (selectedSeveritiesStr) {
      const selectedSeverities = JSON.parse(selectedSeveritiesStr);
      if (!selectedSeverities.includes(post.severity)) {
        return false;
      }
    }

    // Vérifier le jour de la semaine
    const selectedDaysStr = await AsyncStorage.getItem('selectedDays');
    if (selectedDaysStr) {
      const selectedDays = JSON.parse(selectedDaysStr);
      const currentDay = new Date().getDay();
      if (!selectedDays.includes(currentDay)) {
        return false;
      }
    }

    // Vérifier l'heure
    const startHourStr = await AsyncStorage.getItem('startHour');
    const endHourStr = await AsyncStorage.getItem('endHour');
    if (startHourStr && endHourStr) {
      const currentHour = new Date().getHours();
      const startHour = parseInt(startHourStr);
      const endHour = parseInt(endHourStr);

      // Gérer les plages horaires qui traversent minuit (ex: 23h-1h)
      if (startHour <= endHour) {
        // Plage normale (ex: 8h-18h)
        if (currentHour < startHour || currentHour >= endHour) {
          return false;
        }
      } else {
        // Plage qui traverse minuit (ex: 23h-1h)
        if (currentHour < startHour && currentHour >= endHour) {
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking notification preferences:', error);
    return false;
  }
};

// Envoyer une notification locale pour un incident
export const sendIncidentNotification = async (post, ligne) => {
  try {
    const severityLabels = {
      perturbe: 'Perturbé',
      tres_perturbe: 'Très perturbé',
      interrompu: 'Interrompu',
    };

    const severityEmojis = {
      perturbe: '⚠️',
      tres_perturbe: '🚨',
      interrompu: '🛑',
    };

    const emoji = severityEmojis[post.severity] || '📢';
    const severityLabel = severityLabels[post.severity] || post.severity;

    // Titre avec ligne ou station
    const title = ligne?.label
      ? `${emoji} Incident ${ligne.label}`
      : `${emoji} Incident à ${post.station}`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: `${severityLabel} - ${post.incident} à ${post.station}`,
        data: {
          postId: post.id,
          line: post.line,
          station: post.station,
          severity: post.severity,
        },
        sound: true,
        badge: 1,
        categoryIdentifier: 'incident',
      },
      trigger: null, // Notification immédiate
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: error.message };
  }
};

// Effacer toutes les notifications
export const clearAllNotifications = async () => {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
    return { success: true };
  } catch (error) {
    console.error('Error clearing notifications:', error);
    return { success: false, error: error.message };
  }
};

// Obtenir le badge count actuel
export const getBadgeCount = async () => {
  try {
    const count = await Notifications.getBadgeCountAsync();
    return count;
  } catch (error) {
    console.error('Error getting badge count:', error);
    return 0;
  }
};

// Définir le badge count
export const setBadgeCount = async (count) => {
  try {
    await Notifications.setBadgeCountAsync(count);
    return { success: true };
  } catch (error) {
    console.error('Error setting badge count:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtenir et enregistrer le token Expo Push
 * pour les notifications push via Expo Push Notification Service
 */
export const registerForPushNotifications = async (userId) => {
  try {
    console.log('🔔 registerForPushNotifications: Début pour userId:', userId);

    // Demander les permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('🔔 Permission status existant:', existingStatus);
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log('🔔 Demande de permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('🔔 Nouveau permission status:', finalStatus);
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Permission refusée pour les notifications push');
      return { success: false, error: 'Permission refusée' };
    }

    console.log('🔔 Obtention du token Expo Push...');
    // Obtenir le token Expo Push (format: ExponentPushToken[xxx])
    const expoPushToken = await Notifications.getExpoPushTokenAsync({
      projectId: 'b60a62e4-093d-4ba2-89e6-054e1924ac77',
    });
    const token = expoPushToken.data;

    console.log('📱 Expo Push Token obtenu:', token);
    console.log('📱 Platform:', Platform.OS);

    // Enregistrer le token dans Firestore
    if (userId) {
      console.log('🔔 Enregistrement du token dans Firestore pour userId:', userId);
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        expoPushToken: token, // Token Expo Push
        platform: Platform.OS, // 'ios' ou 'android'
        notificationsEnabled: true,
      }, { merge: true });

      console.log('✅ Token Expo Push enregistré dans Firestore avec succès!');
      console.log('✅ Données enregistrées:', { expoPushToken: token, platform: Platform.OS, notificationsEnabled: true });
    } else {
      console.warn('⚠️ Aucun userId fourni, token non enregistré');
    }

    return {
      success: true,
      token: token,
      platform: Platform.OS,
    };
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement du token:', error);
    console.error('❌ Stack:', error.stack);
    return {
      success: false,
      error: error.message,
    };
  }
};
