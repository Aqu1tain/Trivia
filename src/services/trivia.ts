export type NiveauDifficulte = 'facile' | 'moyen' | 'difficile';

export interface QuestionTrivia {
  id: string;
  question: string;
  propositions: string[];
  reponse: string;
  categorie: string;
  difficulte: NiveauDifficulte;
}

export interface ParametresRecherche {
  difficulte?: NiveauDifficulte;
  categorie?: string;
  limite?: number;
}

/**
 * Interface minimale pour un fournisseur de questions de culture générale.
 */
export interface ClientTrivia {
  recupererQuestions(parametres?: ParametresRecherche): Promise<QuestionTrivia[]>;
}
