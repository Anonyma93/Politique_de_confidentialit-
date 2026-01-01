import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import messaging from '@react-native-firebase/messaging';

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
 * Obtenir et enregistrer le token FCM natif
 * pour les notifications push Firebase Cloud Messaging
 */
export const registerForPushNotifications = async (userId) => {
  try {
    // Demander les permissions pour iOS
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('❌ Permission refusée pour les notifications push');
        return { success: false, error: 'Permission refusée' };
      }

      // Enregistrer pour les notifications remote sur iOS
      await messaging().registerDeviceForRemoteMessages();
    }

    // Demander aussi les permissions Expo pour les notifications locales
    const { status: expoStatus } = await Notifications.getPermissionsAsync();
    if (expoStatus !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }

    // Obtenir le token FCM
    const fcmToken = await messaging().getToken();

    console.log('📱 FCM Token:', fcmToken);

    // Enregistrer le token dans Firestore
    if (userId) {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        fcmToken: fcmToken, // Token FCM natif
        fcmTokenType: Platform.OS, // 'ios' ou 'android'
        notificationsEnabled: true,
      }, { merge: true });

      console.log('✅ Token FCM enregistré dans Firestore');
    }

    // Écouter les rafraîchissements de token
    messaging().onTokenRefresh(async (newToken) => {
      console.log('🔄 Token FCM rafraîchi:', newToken);
      if (userId) {
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, {
          fcmToken: newToken,
        }, { merge: true });
      }
    });

    return {
      success: true,
      token: fcmToken,
      tokenType: Platform.OS,
    };
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement du token:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Configurer les gestionnaires de messages FCM
 */
export const setupFCMMessageHandlers = (onNotificationReceived) => {
  // Gérer les messages reçus en premier plan
  const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
    console.log('📬 Notification reçue en premier plan:', remoteMessage);

    // Afficher une notification locale pour que l'utilisateur la voie
    if (remoteMessage.notification) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: remoteMessage.notification.title,
          body: remoteMessage.notification.body,
          data: remoteMessage.data,
          sound: true,
          badge: 1,
        },
        trigger: null, // Immédiat
      });
    }

    if (onNotificationReceived) {
      onNotificationReceived(remoteMessage);
    }
  });

  // Gérer les messages reçus en arrière-plan (déjà configuré dans index.js)
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('📬 Notification reçue en arrière-plan:', remoteMessage);
  });

  return () => {
    unsubscribeForeground();
  };
};
