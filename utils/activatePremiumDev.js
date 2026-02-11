/**
 * Utilitaire de développement pour activer le premium
 * À utiliser temporairement pour activer le premium sur un compte
 *
 * IMPORTANT: Ce fichier ne doit PAS être utilisé en production
 * Utilise une Cloud Function sécurisée pour modifier le statut premium
 */

import { getAuth } from 'firebase/auth';

// URL de la Cloud Function (à mettre à jour avec votre projet ID)
const CLOUD_FUNCTION_URL = 'https://europe-west1-lini-47633.cloudfunctions.net/managePremium';

/**
 * Active le premium permanent pour un utilisateur
 * @param {string} userEmail - Email de l'utilisateur
 */
export const activatePremiumForUser = async (userEmail) => {
  try {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return { success: false, error: 'Vous devez être connecté' };
    }

    console.log('🔍 Activation du premium pour:', userEmail);

    // Appeler la Cloud Function
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        adminEmail: currentUser.email,
        userEmail: userEmail,
        action: 'activate'
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Erreur:', result.error);
      return { success: false, error: result.error || 'Erreur lors de l\'activation' };
    }

    console.log('✅ Premium activé avec succès!');
    console.log('💎 Statut: Premium Permanent');

    return {
      success: true,
      userId: result.userId,
      message: result.message
    };

  } catch (error) {
    console.error('❌ Erreur lors de l\'activation:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Désactive le premium pour un utilisateur (utile pour les tests)
 * @param {string} userEmail - Email de l'utilisateur
 */
export const deactivatePremiumForUser = async (userEmail) => {
  try {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return { success: false, error: 'Vous devez être connecté' };
    }

    console.log('🔍 Désactivation du premium pour:', userEmail);

    // Appeler la Cloud Function
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        adminEmail: currentUser.email,
        userEmail: userEmail,
        action: 'deactivate'
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Erreur:', result.error);
      return { success: false, error: result.error || 'Erreur lors de la désactivation' };
    }

    console.log('✅ Premium désactivé');

    return {
      success: true,
      userId: result.userId,
      message: result.message
    };

  } catch (error) {
    console.error('❌ Erreur:', error);
    return { success: false, error: error.message };
  }
};
