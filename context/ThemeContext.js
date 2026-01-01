import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

// Fonction pour créer un thème personnalisé avec une couleur primary
const createCustomTheme = (primaryColor = '#C9F2DF') => ({
  name: 'custom',
  label: 'Personnalisé',
  colors: {
    primary: primaryColor,
    background: '#F2F2F7',
    text: '#000000',
    textSecondary: '#666666',
    navbar: '#FFFFFF',
    post: 'white',
    border: '#E0E0E0',
    iconActive: '#000000',
    iconInactive: '#40010D',
    cardBackgroundColor: '#252525ff'
  },
});

export const themes = {
  custom: createCustomTheme('#C9F2DF'), // Couleur par défaut
  normal: {
    name: 'normal',
    label: 'Normal',
    colors: {
      primary: '#C9F2DF',
      background: '#F2F2F7',
      text: '#000000',
      textSecondary: '#666666',
      navbar: '#FFFFFF',
      post: 'white',
      border: '#E0E0E0',
      iconActive: '#000000',
      iconInactive: '#40010D',
      cardBackgroundColor : '#252525ff'
    },
  },
  dark: {
    name: 'dark',
    label: 'Sombre',
    colors: {
      primary: '#2C2C2E',
      background: '#1C1C1E',
      text: '#FFFFFF',
      textSecondary: '#AAAAAA',
      navbar: '#2C2C2E',
      border: '#3A3A3C',
      iconActive: '#FFFFFF',
      iconInactive: '#8E8E93',
      cardBackgroundColor: '#2C2C2E',
    },
  },
};

export const fontSizes = {
  small: {
    name: 'small',
    label: 'Petit',
    sizes: {
      title: 26,
      subtitle: 18,
      body: 14,
      small: 12,
      header: 18,
    },
  },
  normal: {
    name: 'normal',
    label: 'Normal',
    sizes: {
      title: 32,
      subtitle: 20,
      body: 16,
      small: 14,
      header: 20,
    },
  },
  large: {
    name: 'large',
    label: 'Grand',
    sizes: {
      title: 38,
      subtitle: 24,
      body: 18,
      small: 16,
      header: 22,
    },
  },
};

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState(themes.normal);
  const [currentFontSize, setCurrentFontSize] = useState(fontSizes.normal);
  const [customColor, setCustomColorState] = useState('#C9F2DF');
  const [isLoading, setIsLoading] = useState(true);

  // Charger le thème et la taille de police sauvegardés au démarrage
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [savedTheme, savedFontSize, savedCustomColor] = await Promise.all([
        AsyncStorage.getItem('appTheme'),
        AsyncStorage.getItem('appFontSize'),
        AsyncStorage.getItem('customPrimaryColor'),
      ]);

      // Charger la couleur personnalisée
      const colorToUse = savedCustomColor || '#C9F2DF';
      setCustomColorState(colorToUse);

      // Charger le thème avec la couleur personnalisée si c'est le thème custom
      if (savedTheme === 'custom') {
        setCurrentTheme(createCustomTheme(colorToUse));
      } else if (savedTheme && themes[savedTheme]) {
        setCurrentTheme(themes[savedTheme]);
      }

      if (savedFontSize && fontSizes[savedFontSize]) {
        setCurrentFontSize(fontSizes[savedFontSize]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const changeTheme = async (themeName) => {
    try {
      if (themeName === 'custom') {
        setCurrentTheme(createCustomTheme(customColor));
        await AsyncStorage.setItem('appTheme', themeName);
      } else if (themes[themeName]) {
        setCurrentTheme(themes[themeName]);
        await AsyncStorage.setItem('appTheme', themeName);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du thème:', error);
    }
  };

  const setCustomColor = async (color) => {
    try {
      setCustomColorState(color);
      await AsyncStorage.setItem('customPrimaryColor', color);
      // Si le thème custom est actif, le mettre à jour immédiatement
      if (currentTheme.name === 'custom') {
        setCurrentTheme(createCustomTheme(color));
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la couleur personnalisée:', error);
    }
  };

  const changeFontSize = async (fontSizeName) => {
    try {
      if (fontSizes[fontSizeName]) {
        setCurrentFontSize(fontSizes[fontSizeName]);
        await AsyncStorage.setItem('appFontSize', fontSizeName);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la taille de police:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{
      theme: currentTheme,
      changeTheme,
      fontSize: currentFontSize,
      changeFontSize,
      customColor,
      setCustomColor,
      isLoading
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme doit être utilisé dans un ThemeProvider');
  }
  return context;
};
