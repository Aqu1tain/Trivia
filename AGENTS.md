# Repository Guidelines

## Structure du Projet
Le code source vit dans `src/`. Organisez les modules par responsabilité: `src/bot/` pour la configuration Discord.js, `src/commands/` pour les slash commands, `src/services/` pour l’accès à l’API quizzapi.jomoreschi.fr, `src/score/` pour les classements. Les tests unitaires et d’intégration habitent `tests/` (miroir de l’arborescence `src`). Mettez les assets statiques (icônes, extraits de questions de test) dans `assets/`. Les scripts de maintenance CLI vont dans `scripts/`.

## Commandes de Build, Test et Développement
`npm install` installe les dépendances (Node 20+ recommandé). `npm run dev` lance le bot en mode surveillé via ts-node-dev. `npm run lint` exécute ESLint + Prettier. `npm run test` lance Jest en mode rapide; ajoutez `--coverage` pour générer `coverage/`. `npm run build` compile TypeScript vers `dist/` prêt pour la production.

## Style de Code et Conventions
Écrivez en TypeScript avec indentation de deux espaces. Utilisez des noms `camelCase` pour variables et fonctions, `PascalCase` pour classes et types, et des fichiers en `kebab-case`. Documentez les méthodes exportées avec des commentaires JSDoc en français. ESLint applique les règles `@typescript-eslint/recommended` et Prettier formate automatiquement; validez avec `npm run lint`. Les chaînes utilisateur doivent être en français; vérifiez la cohérence des pluralisations.

## Directives de Tests
Jest est la référence. Chaque module critique nécessite des tests unitaires (`*.spec.ts`) dans le même sous-dossier que le code visé. Les tests d’intégration pour les interactions API Discord ou QuizzAPI se placent dans `tests/integration/`. Maintenez une couverture minimale de 85 % sur `src/`. Mockez l’API externe avec `nock` et stockez les fixtures dans `tests/fixtures/`. Utilisez `npm run test -- --watch` pendant le développement.

## Commits et Pull Requests
Formatez les messages de commit comme `type(scope): résumé en français` (ex. `feat(classement): calcul hebdomadaire`). Chaque PR doit lier l’issue, décrire le comportement attendu, récapituler les tests réalisés et, pour les commandes bot, fournir des captures ou sorties de console. Demandez une revue pour les changements touchant les classements ou la planification quotidienne.

