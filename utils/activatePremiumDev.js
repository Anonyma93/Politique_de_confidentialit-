/**
 * Utilitaire de développement pour activer le premium
 * À utiliser temporairement pour activer le premium sur un compte
 *
 * IMPORTANT: Ce fichier ne doit PAS être utilisé en production
 */

import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Active le premium permanent pour un utilisateur
 * @param {string} email - Email de l'utilisateur
 */
export const activatePremiumForUser = async (email) => {
  try {
    console.log('🔍 Recherche de l\'utilisateur:', email);

    // Rechercher l'utilisateur par email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log('❌ Aucun utilisateur trouvé avec cet email');
      return { success: false, error: 'Utilisateur non trouvé' };
    }

    const userDoc = querySnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    console.log(`📧 Utilisateur trouvé: ${userData.firstName} ${userData.lastName}`);
    console.log(`🆔 User ID: ${userId}`);

    // Mettre à jour le statut premium
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isPremium: true,
      premiumExpiresAt: null, // Premium permanent
      updatedAt: new Date().toISOString()
    });

    console.log('✅ Premium activé avec succès!');
    console.log('💎 Statut: Premium Permanent');

    return {
      success: true,
      userId,
      message: 'Premium activé avec succès!'
    };

  } catch (error) {
    console.error('❌ Erreur lors de l\'activation:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Désactive le premium pour un utilisateur (utile pour les tests)
 * @param {string} email - Email de l'utilisateur
 */
export const deactivatePremiumForUser = async (email) => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { success: false, error: 'Utilisateur non trouvé' };
    }

    const userDoc = querySnapshot.docs[0];
    const userId = userDoc.id;

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isPremium: false,
      premiumExpiresAt: null,
      updatedAt: new Date().toISOString()
    });

    console.log('✅ Premium désactivé');

    return {
      success: true,
      userId,
      message: 'Premium désactivé'
    };

  } catch (error) {
    console.error('❌ Erreur:', error);
    return { success: false, error: error.message };
  }
};
