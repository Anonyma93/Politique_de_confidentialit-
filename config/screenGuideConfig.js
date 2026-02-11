/**
 * Configuration des guides par écran
 *
 * Un seul message par écran, affiché dans un bottom sheet
 * à la première visite de chaque écran.
 */

export const SCREEN_GUIDES = {
  Home: {
    icon: 'home-outline',
    title: 'Accueil',
    message:
      "Bienvenue ! Cette page résume l'essentiel de la journée : nombre de posts publiés, lignes et gares concernées, ainsi que les lignes perturbées dans la dernière heure. Si tout est calme, vous le saurez en un coup d'œil.",
  },
  Feed: {
    icon: 'newspaper-outline',
    title: "Fil d'actualité",
    message:
      "Retrouvez ici tous les incidents et infos trafic signalés par la communauté. Utilisez les filtres rapides « Mes lignes » et « Mes arrêts » pour ne voir que ce qui vous concerne. Tous les posts sont réinitialisés chaque jour à 4h pour ne garder que l'info fraîche.",
  },
  Post: {
    icon: 'create-outline',
    title: 'Nouveau post',
    message:
      "Signalez un incident ou partagez une info trafic en quelques étapes : choisissez le type (incident ou information), sélectionnez la ligne, la direction et la station, puis ajoutez un commentaire. Pour un incident, indiquez aussi la gravité et la durée estimée.",
  },
  Profile: {
    icon: 'person-outline',
    title: 'Profil',
    message:
      "Gérez vos informations personnelles, consultez vos statistiques et suivez votre grade de contribution. Sélectionnez vos lignes et arrêts préférés pour personnaliser vos filtres et recevoir des notifications ciblées.",
  },
  Options: {
    icon: 'settings-outline',
    title: 'Paramètres',
    message:
      "Personnalisez votre expérience : changez le thème et la taille du texte, configurez vos notifications par ligne, station, gravité et horaires, et gérez votre compte. Vous pouvez aussi relancer ce tutoriel à tout moment depuis cette page.",
  },
};

/**
 * Obtenir tous les noms d'écrans configurés
 * @returns {string[]}
 */
export const getAllScreenNames = () => Object.keys(SCREEN_GUIDES);

/**
 * Obtenir la config du guide pour un écran donné
 * @param {string} screenName
 * @returns {Object|null}
 */
export const getGuideForScreen = (screenName) =>
  SCREEN_GUIDES[screenName] || null;
