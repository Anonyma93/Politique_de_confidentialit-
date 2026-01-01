# Dossier Data

Ce dossier est destiné à stocker vos fichiers de données JavaScript qui seront utilisés dans plusieurs pages de l'application.

## Comment utiliser :

1. **Déposez votre fichier JS ici** : `/Users/quentinmichaud/Desktop/Lini/data/`

2. **Structure du fichier** :
```javascript
// Exemple : data/myData.js
export const myData = [
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
  // ... vos données
];

// Vous pouvez aussi exporter plusieurs constantes
export const categories = [...];
export const users = [...];
```

3. **Importer dans vos pages** :
```javascript
// Dans n'importe quel screen
import { myData, categories } from '../data/myData';

// Utiliser les données
console.log(myData);
```

## Exemple :

Voir le fichier `example.js` pour un exemple complet.
