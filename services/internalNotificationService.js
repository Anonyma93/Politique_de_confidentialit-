import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  getDocs,
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Types de notifications internes
 */
export const NOTIFICATION_TYPES = {
  LIKE: 'like',
  COMMENT: 'comment',
  POST_MENTION: 'post_mention', // Pour les futures mentions
};

/**
 * Créer une notification interne
 * @param {string} recipientId - ID de l'utilisateur qui reçoit la notification
 * @param {string} type - Type de notification (like, comment, confirmation)
 * @param {Object} data - Données de la notification
 */
export const createNotification = async (recipientId, type, data) => {
  try {
    // Ne pas créer de notification si l'utilisateur interagit avec son propre contenu
    if (data.senderId === recipientId) {
      return { success: true, skipped: true };
    }

    const notificationData = {
      recipientId,
      type,
      read: false,
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
      ...data, // postId, senderId, senderName, senderPhoto, commentText, etc.
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationData);

    return {
      success: true,
      notificationId: docRef.id,
    };
  } catch (error) {
    console.error('Erreur lors de la création de la notification:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Créer une notification pour un like
 */
export const notifyLike = async (postOwnerId, likerId, likerName, likerPhoto, postId) => {
  return createNotification(postOwnerId, NOTIFICATION_TYPES.LIKE, {
    senderId: likerId,
    senderName: likerName,
    senderPhoto: likerPhoto,
    postId,
  });
};

/**
 * Créer une notification pour un commentaire
 */
export const notifyComment = async (postOwnerId, commenterId, commenterName, commenterPhoto, postId, commentText) => {
  return createNotification(postOwnerId, NOTIFICATION_TYPES.COMMENT, {
    senderId: commenterId,
    senderName: commenterName,
    senderPhoto: commenterPhoto,
    postId,
    commentText: commentText.substring(0, 100), // Limiter à 100 caractères
  });
};

/**
 * Marquer une notification comme lue
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    const notifRef = doc(db, 'notifications', notificationId);
    await updateDoc(notifRef, {
      read: true,
      readAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error('Erreur lors du marquage de la notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Marquer toutes les notifications d'un utilisateur comme lues
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    snapshot.docs.forEach((document) => {
      batch.update(document.ref, {
        read: true,
        readAt: new Date().toISOString(),
      });
    });

    await batch.commit();

    return { success: true, count: snapshot.size };
  } catch (error) {
    console.error('Erreur lors du marquage des notifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Marquer toutes les notifications liées à un post comme lues
 */
export const markPostNotificationsAsRead = async (userId, postId) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      where('postId', '==', postId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    snapshot.docs.forEach((document) => {
      batch.update(document.ref, {
        read: true,
        readAt: new Date().toISOString(),
      });
    });

    await batch.commit();

    return { success: true, count: snapshot.size };
  } catch (error) {
    console.error('Erreur lors du marquage des notifications du post:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Écouter les notifications non lues d'un utilisateur
 */
export const subscribeToUnreadNotifications = (userId, callback) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      where('read', '==', false),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(notifications);
    }, (error) => {
      console.error('Erreur lors de l\'écoute des notifications:', error);
      callback([]);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Erreur lors de l\'écoute des notifications:', error);
    callback([]);
    return null;
  }
};

/**
 * Compter les notifications non lues d'un utilisateur
 */
export const getUnreadCount = async (userId) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Erreur lors du comptage des notifications:', error);
    return 0;
  }
};

/**
 * Compter les notifications non lues par post
 */
export const getUnreadCountForPost = async (userId, postId) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      where('postId', '==', postId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Erreur lors du comptage des notifications du post:', error);
    return 0;
  }
};

/**
 * Obtenir toutes les notifications d'un utilisateur (lues et non lues)
 */
export const getUserNotifications = async (userId, limit = 50) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const notifications = snapshot.docs.slice(0, limit).map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { success: true, notifications };
  } catch (error) {
    console.error('Erreur lors de la récupération des notifications:', error);
    return { success: false, notifications: [], error: error.message };
  }
};
