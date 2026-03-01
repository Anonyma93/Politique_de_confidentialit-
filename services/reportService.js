import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const VALID_REASONS = ['spam', 'inappropriate', 'dangerous', 'misinformation'];
const VALID_CONTENT_TYPES = ['post', 'comment'];

/**
 * Soumettre un signalement pour un post ou un commentaire
 */
export const submitReport = async ({ contentType, contentId, postId, reason, currentUser }) => {
  try {
    if (!currentUser) {
      return { success: false, error: 'Utilisateur non connecté' };
    }

    if (!VALID_CONTENT_TYPES.includes(contentType)) {
      return { success: false, error: 'Type de contenu invalide' };
    }

    if (!VALID_REASONS.includes(reason)) {
      return { success: false, error: 'Raison invalide' };
    }

    // Vérifier si l'utilisateur a déjà signalé ce contenu
    const existingQuery = query(
      collection(db, 'reports'),
      where('reporterId', '==', currentUser.uid),
      where('contentId', '==', contentId)
    );

    const existingSnapshot = await getDocs(existingQuery);
    if (!existingSnapshot.empty) {
      return { success: false, alreadyReported: true };
    }

    // Créer le signalement
    await addDoc(collection(db, 'reports'), {
      contentType,
      contentId,
      postId: postId || contentId,
      reporterId: currentUser.uid,
      reason,
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Erreur lors du signalement:', error);
    return { success: false, error: error.message };
  }
};
