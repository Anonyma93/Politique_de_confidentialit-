import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Ajouter un commentaire à un post
 */
export const addComment = async (postId, userId, userDisplayName, userPhotoURL, text, userIsPremium = false) => {
  try {
    const commentData = {
      postId,
      userId,
      userDisplayName,
      userPhotoURL: userPhotoURL || null,
      userIsPremium,
      text,
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    };

    // Ajouter le commentaire
    const docRef = await addDoc(collection(db, 'comments'), commentData);

    // Incrémenter le compteur de commentaires sur le post
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, {
      commentsCount: increment(1)
    });

    return {
      success: true,
      commentId: docRef.id,
      message: 'Commentaire ajouté avec succès',
    };
  } catch (error) {
    console.error('Erreur lors de l\'ajout du commentaire:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Écouter les commentaires d'un post en temps réel
 */
export const subscribeToComments = (postId, callback) => {
  try {
    const q = query(
      collection(db, 'comments'),
      where('postId', '==', postId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const comments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(comments);
    }, (error) => {
      // Gestion de l'erreur d'index manquant
      console.error('Erreur lors de l\'écoute des commentaires:', error);
      console.log('📌 Créez l\'index Firestore pour activer les commentaires');
      // Retourner un tableau vide en attendant que l'index soit créé
      callback([]);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Erreur lors de l\'écoute des commentaires:', error);
    callback([]);
    return null;
  }
};

/**
 * Supprimer un commentaire
 */
export const deleteComment = async (commentId, postId) => {
  try {
    // Supprimer le commentaire
    await deleteDoc(doc(db, 'comments', commentId));

    // Décrémenter le compteur de commentaires sur le post
    if (postId) {
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        commentsCount: increment(-1)
      });
    }

    return {
      success: true,
      message: 'Commentaire supprimé avec succès',
    };
  } catch (error) {
    console.error('Erreur lors de la suppression du commentaire:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Compter les commentaires d'un post
 */
export const getCommentsCount = async (postId) => {
  try {
    const q = query(
      collection(db, 'comments'),
      where('postId', '==', postId)
    );

    return new Promise((resolve) => {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        resolve(snapshot.size);
        unsubscribe();
      });
    });
  } catch (error) {
    console.error('Erreur lors du comptage des commentaires:', error);
    return 0;
  }
};
