# DailyTrivia

Bot Discord (Node/TypeScript) qui publie chaque jour les mêmes questions pour tous les membres d’un salon. Chaque cycle quotidien envoie automatiquement un message "Les questions du jour sont prêtes" accompagné de trois boutons `Facile`, `Moyen`, `Difficile`. Lorsqu’un membre clique sur un bouton, il dispose de 20 secondes pour répondre à la question affichée. Sans réponse dans le délai, l’essai est perdu. Tant que les questions du jour ne sont pas régénérées, aucune nouvelle tentative n’est possible pour ce niveau.

## Fonctionnalités cibles
- **Questions partagées** : trois questions (facile, moyen, difficile) identiques pour toutes et tous, récupérées via [quizzapi.jomoreschi.fr](https://quizzapi.jomoreschi.fr).
- **Message quotidien** : déclenché à heure fixe dans un salon configurable, création automatique d’un thread pour centraliser les résultats.
- **Interaction bouton + timer** : 20 secondes pour répondre. Réponse correcte → attribution de points pondérés par la rapidité ; réponse incorrecte ou absence de réponse → 0 point et message dédié dans le thread.
- **Classements** : tableaux quotidien, hebdomadaire, mensuel et global, mis à jour après chaque tentative.

## Roadmap immédiate
1. **Planification** : persister les questions du jour, éviter les doublons et orchestrer l’envoi automatique du message avec boutons + thread.
2. **Gameplay** : implémenter le compte à rebours côté interaction, calculer le score (base sur difficulté + bonus de rapidité), verrouiller les tentatives multiples.
3. **Feedback** : poster dans le thread "Untel a (bien|mal) répondu à la question {niveau}" ; stocker l’historique pour référence.
4. **Leaderboards** : exposer des commandes pour consulter les différents classements et préparer la persistance long terme.

## Stack & scripts
- **Stack** : Node.js ≥ 20, TypeScript, discord.js v14, Axios, Jest.
- **Scripts** : `npm run dev` (bot en mode surveillé), `npm run build`, `npm test`, `npm run deploy` (publie les commandes slash), `npm run lint`.

## Configuration
1. Copier `.env.example` vers `.env` et renseigner `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `DISCORD_CHANNEL_ID`, `QUIZZ_API_URL`.
2. `npm install` puis `npm run deploy` pour enregistrer les commandes.
3. Lancer `npm run dev` pour démarrer le bot en local.

Toute contribution suit les consignes de `AGENTS.md`.
