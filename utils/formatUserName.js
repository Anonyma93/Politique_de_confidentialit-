/**
 * Formate le nom d'un utilisateur en fonction des préférences de confidentialité
 * @param {string} firstName - Prénom de l'utilisateur
 * @param {string} lastName - Nom de famille de l'utilisateur
 * @param {boolean} hideLastNames - Si true, masque le nom de famille (sauf pour l'utilisateur lui-même)
 * @param {string} userId - ID de l'utilisateur dont on veut afficher le nom
 * @param {string} currentUserId - ID de l'utilisateur connecté
 * @returns {string} - Nom formaté
 */
export const formatUserName = (firstName, lastName, hideLastNames, userId, currentUserId) => {
  // Si hideLastNames est désactivé, afficher le nom complet
  if (!hideLastNames) {
    return `${firstName} ${lastName}`.trim();
  }

  // Si c'est l'utilisateur connecté, toujours afficher son nom complet
  if (userId === currentUserId) {
    return `${firstName} ${lastName}`.trim();
  }

  // Sinon, masquer le nom de famille
  return firstName.trim();
};

/**
 * Hook/fonction helper pour obtenir la préférence hideLastNames depuis Firestore
 * Cette fonction peut être utilisée dans les composants pour récupérer la préférence
 */
export const getUserHideLastNamesPreference = async (db, userId) => {
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data().hideLastNames || false;
    }
    return false;
  } catch (error) {
    console.error('Error getting hideLastNames preference:', error);
    return false;
  }
};
