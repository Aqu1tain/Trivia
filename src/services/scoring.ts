import { dayjs } from '../utils/date';

import type { NiveauQuestion } from './questions-du-jour';

const BASE_POINTS: Record<NiveauQuestion, number> = {
  facile: 50,
  moyen: 100,
  difficile: 150,
};

const FACTEUR_MINIMUM = 0.2;
const SECONDES_PAR_JOUR = 86_400;

export interface ResultatScore {
  points: number;
  facteurTemps: number;
  secondesDepuisAnnonce: number;
}

export function calculerPoints(
  niveau: NiveauQuestion,
  annonceIso: string,
  reponseDate: Date,
): ResultatScore {
  const base = BASE_POINTS[niveau];
  const annonce = dayjs(annonceIso);
  const reponse = dayjs(reponseDate);
  const diffSecondes = Math.max(reponse.diff(annonce, 'seconds'), 0);
  const facteurTemps = Math.max(FACTEUR_MINIMUM, 1 - diffSecondes / SECONDES_PAR_JOUR);
  const points = Math.round(base * facteurTemps);

  return {
    points,
    facteurTemps,
    secondesDepuisAnnonce: diffSecondes,
  };
}
