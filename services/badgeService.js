/**
 * Service pour gérer le badge de l'application
 * Affiche le nombre d'incidents sur les lignes favorites de l'utilisateur
 */

import { setBadgeCount } from './notificationService';

/**
 * Calcule le nombre de posts correspondant aux lignes préférées de l'utilisateur
 * @param {Array} posts - Liste des posts actifs
 * @param {Array} preferredLines - Liste des lignes préférées de l'utilisateur
 * @returns {number} - Nombre de posts sur les lignes préférées
 */
export const calculateBadgeForPreferredLines = (posts, preferredLines) => {
  if (!posts || !Array.isArray(posts) || posts.length === 0) {
    return 0;
  }

  if (!preferredLines || !Array.isArray(preferredLines) || preferredLines.length === 0) {
    return 0;
  }

  // Compter les posts qui correspondent aux lignes préférées
  const matchingPosts = posts.filter(post => {
    return preferredLines.includes(post.line);
  });

  return matchingPosts.length;
};

/**
 * Met à jour le badge de l'application avec le nombre d'incidents sur les lignes favorites
 * @param {number} count - Nombre à afficher sur le badge
 * @returns {Promise<void>}
 */
export const updateFavoriteLineBadge = async (count) => {
  try {
    // Utiliser le service de notification existant pour définir le badge
    await setBadgeCount(count);
    console.log(`🔔 Badge mis à jour: ${count}`);
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour du badge:', error);
  }
};

/**
 * Calcule et met à jour le badge de l'application
 * Combine les deux fonctions ci-dessus
 * @param {Array} posts - Liste des posts actifs
 * @param {Array} preferredLines - Liste des lignes préférées de l'utilisateur
 * @returns {Promise<number>} - Nombre de posts affiché sur le badge
 */
export const updateBadgeForPreferredLines = async (posts, preferredLines) => {
  const count = calculateBadgeForPreferredLines(posts, preferredLines);
  await updateFavoriteLineBadge(count);
  return count;
};
