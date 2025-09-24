# DailyTrivia

Bot Discord (Node/TypeScript) qui publie chaque jour les mêmes questions pour tous les membres des serveurs où il est configuré. Chaque cycle quotidien envoie automatiquement un message "Les questions du jour sont prêtes" accompagné de trois boutons `Facile`, `Moyen`, `Difficile`. Lorsqu’un membre clique sur un bouton, il dispose de 20 secondes pour répondre à la question affichée. Sans réponse dans le délai, l’essai est perdu. Tant que les questions du jour ne sont pas régénérées, aucune nouvelle tentative n’est possible pour ce niveau.

## Fonctionnalités principales
- **Questions partagées** : trois questions (facile, moyen, difficile) identiques pour toutes et tous, récupérées via [quizzapi.jomoreschi.fr](https://quizzapi.jomoreschi.fr).
- **Message quotidien** : déclenché à heure fixe dans un salon configurable par serveur, création automatique d’un thread pour centraliser les résultats.
- **Interaction bouton + timer** : 20 secondes pour répondre. Réponse correcte → attribution de points pondérés par la rapidité ; réponse incorrecte ou absence de réponse → 0 point et message dédié dans le thread.
- **Classements** : tableaux quotidien, hebdomadaire, mensuel et global, maintenus et consultables par serveur via `/classement`, `/mes-points` ou `/statistiques`.
- **Administration simple** : commandes `/config` pour définir salon + horaire, `/regenerer-questions` pour relancer une journée, `/show-running-config` pour visualiser la configuration active.

## Stack & scripts
- **Stack** : Node.js ≥ 20, TypeScript, discord.js v14, Axios, Jest, Dayjs.
- **Scripts** :
  - `npm run dev` – démarre le bot avec surveillance.
  - `npm run build` – compile vers `dist/`.
  - `npm test` – exécute la suite Jest.
  - `npm run lint` – ESLint + Prettier.
  - `npm run deploy` – publie les commandes slash globales.
  - `npm run clear:guild-commands` – (optionnel) purge les anciennes commandes spécifiques à un serveur si besoin (utilise `DISCORD_GUILD_ID` / `EXTRA_GUILD_IDS`).

## Installation & configuration
1. `cp .env.example .env` puis renseigner :
   - `DISCORD_TOKEN` – token du bot.
   - `DISCORD_CLIENT_ID` – identifiant de l’application Discord.
   - (optionnel) `QUIZZ_API_URL` si vous utilisez un endpoint différent.
2. `npm install` pour récupérer les dépendances.
3. `npm run deploy` pour enregistrer les commandes globales auprès de Discord.
4. `npm run dev` pour lancer le bot.
5. Dans chaque serveur où il est ajouté, un admin exécute `/config` pour définir le salon de publication et l’heure française souhaitée.

## Développement
- Les données persistées (questions, classements, configurations de guildes) sont stockées dans `data/` par défaut.
- Les tests unitaires se trouvent dans `tests/` et reflètent l’arborescence de `src/`.
- Voir `AGENTS.md` pour les conventions de contribution.

## Roadmap courte
- Ajustements UX côté embeds et feedbacks joueurs.
- Ajout d’un module de persistance externe (base de données) lorsque les volumes l’exigeront.
- Intégration d’exports/archives des classements.
