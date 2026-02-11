import { Dimensions, Platform } from 'react-native';

// Obtenir les dimensions de l'écran
const { width, height } = Dimensions.get('window');

// Déterminer si on est sur iPad
export const isTablet = () => {
  // Sur iOS, détecte si c'est un iPad
  if (Platform.OS === 'ios') {
    return Platform.isPad || (width >= 768 && height >= 1024);
  }
  // Sur Android, détecte les tablettes (écrans >= 600dp)
  return width >= 600;
};

// Valeurs responsive pour les layouts
export const getResponsiveValue = (phoneValue, tabletValue) => {
  return isTablet() ? tabletValue : phoneValue;
};

// Largeur maximale du contenu sur tablette
export const getMaxContentWidth = () => {
  return isTablet() ? 600 : width;
};

// Padding horizontal adaptatif
export const getHorizontalPadding = () => {
  return isTablet() ? 40 : 20;
};

// Nombre de colonnes pour les grilles
export const getGridColumns = () => {
  return isTablet() ? 2 : 1;
};

// Dimensions de la fenêtre actuelle
export const screenWidth = width;
export const screenHeight = height;

// Hook pour obtenir les dimensions responsive
import { useState, useEffect } from 'react';

export const useResponsive = () => {
  const [dimensions, setDimensions] = useState({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({
        width: window.width,
        height: window.height,
      });
    });

    return () => subscription?.remove();
  }, []);

  return {
    ...dimensions,
    isTablet: dimensions.width >= 768,
    maxContentWidth: dimensions.width >= 768 ? 600 : dimensions.width,
    horizontalPadding: dimensions.width >= 768 ? 40 : 20,
    gridColumns: dimensions.width >= 768 ? 2 : 1,
  };
};

// Styles pour centrer le contenu sur tablette
export const getCenteredContainerStyle = () => {
  if (isTablet()) {
    return {
      maxWidth: 600,
      width: '100%',
      alignSelf: 'center',
    };
  }
  return {
    width: '100%',
  };
};

// Padding adaptatif pour les conteneurs
export const getContainerPadding = () => {
  return {
    paddingHorizontal: getHorizontalPadding(),
  };
};
