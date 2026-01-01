import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const themes = {
  light: {
    name: 'light',
    label: 'Clair',
    colors: {
      primary: '#E0E0E0',
      background: '#FFFFFF',
      text: '#000000',
      textSecondary: '#666666',
      navbar: '#FFFFFF',
      border: '#E0E0E0',
      iconActive: '#000000',
      iconInactive: '#999999',
      cardBackgroundColor: '#F5F5F5',
    },
  },
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
  const [isLoading, setIsLoading] = useState(true);

  // Charger le thème et la taille de police sauvegardés au démarrage
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [savedTheme, savedFontSize] = await Promise.all([
        AsyncStorage.getItem('appTheme'),
        AsyncStorage.getItem('appFontSize'),
      ]);

      if (savedTheme && themes[savedTheme]) {
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
      if (themes[themeName]) {
        setCurrentTheme(themes[themeName]);
        await AsyncStorage.setItem('appTheme', themeName);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du thème:', error);
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
