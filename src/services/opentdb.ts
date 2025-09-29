import axios, { AxiosInstance } from 'axios';
import * as deepl from 'deepl-node';
import { createHash } from 'node:crypto';

import { dayjs } from '../utils/date';
import { journalPrincipal } from '../utils/journalisation';

import type { ClientTrivia, NiveauDifficulte, ParametresRecherche, QuestionTrivia } from './trivia';

interface OpenTdbResponse {
  response_code: number;
  results: OpenTdbQuestionDto[];
}

interface OpenTdbQuestionDto {
  category: string;
  type: 'multiple' | 'boolean';
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

export interface TraducteurTrivia {
  traduireTextes(textes: string[]): Promise<string[]>;
}

interface OpenTdbCacheEntry {
  jour: string;
  questions: QuestionTrivia[];
}

interface OpenTdbClientOptions {
  temporisateur?: (dureeMs: number) => Promise<void>;
  delaiMinimalMs?: number;
}

/**
 * Traducteur DeepL minimal dédié aux questions OpenTDB.
 */
export class DeepLTraducteur implements TraducteurTrivia {
  private readonly client: deepl.DeepLClient;

  constructor(authKey: string) {
    this.client = new deepl.DeepLClient(authKey);
  }

  public async traduireTextes(textes: string[]): Promise<string[]> {
    if (textes.length === 0) {
      return [];
    }

    const resultat = await this.client.translateText(textes, null, 'fr');
    if (Array.isArray(resultat)) {
      return resultat.map((item) => item.text);
    }

    const unique = resultat as deepl.TextResult;
    return [unique.text];
  }
}

/**
 * Client OpenTDB encapsulant la traduction automatique des questions en français.
 */
export class OpenTdbClient implements ClientTrivia {
  private readonly http: AxiosInstance;
  private readonly cache = new Map<string, OpenTdbCacheEntry>();
  private compteurQuotidien = { jour: '', appels: 0 };
  private derniereRequete = 0;
  private readonly temporisateur: (dureeMs: number) => Promise<void>;
  private readonly delaiMinimalMs: number;
  private filePromise: Promise<void> = Promise.resolve();

  constructor(
    baseUrl: string,
    private readonly traducteur: TraducteurTrivia,
    options: OpenTdbClientOptions = {},
  ) {
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 5000,
    });
    this.temporisateur = options.temporisateur ?? creerTemporisateurParDefaut();
    const delai = options.delaiMinimalMs ?? 5500;
    this.delaiMinimalMs = delai > 0 ? delai : 0;
  }

  public async recupererQuestions(parametres: ParametresRecherche = {}): Promise<QuestionTrivia[]> {
    return this.executerEnSerie(async () => {
      const jourCourant = dayjs().format('YYYY-MM-DD');
      this.reinitialiserQuotaSiNecessaire(jourCourant);

      const cleCache = construireCleCache(jourCourant, parametres);
      const enCache = this.cache.get(cleCache);
      if (enCache) {
        return clonerQuestions(enCache.questions);
      }

      if (this.compteurQuotidien.appels >= 3) {
        throw new Error('Limite quotidienne de 3 appels OpenTDB atteinte, réessayez demain.');
      }

      try {
        await this.attendreFenetreRateLimit();

        const { data } = await this.http.get<OpenTdbResponse>('/api.php', {
        params: {
          amount: parametres.limite ?? 1,
          difficulty: mapperDifficultePourApi(parametres.difficulte),
          category: mapperCategoriePourApi(parametres.categorie),
          type: 'multiple',
          encode: 'base64',
        },
      });

      if (data.response_code !== 0) {
        throw new Error(decrireCodeErreur(data.response_code));
      }

      const questions = await Promise.all(
        data.results.map(async (entree, index) => this.formaterQuestion(entree, index)),
      );

        this.compteurQuotidien.appels += 1;
        this.cache.set(cleCache, { jour: jourCourant, questions });
        return clonerQuestions(questions);
      } catch (erreur: unknown) {
        const normalisee = normaliserErreurOpenTdb(erreur);
        journalPrincipal.erreur('Impossible de récupérer les questions auprès de OpenTDB', normalisee);
        throw normalisee;
      } finally {
        this.derniereRequete = Date.now();
      }
    });
  }

  private reinitialiserQuotaSiNecessaire(jourCourant: string): void {
    if (this.compteurQuotidien.jour !== jourCourant) {
      this.compteurQuotidien = { jour: jourCourant, appels: 0 };
      this.purgerCacheAncien(jourCourant);
    }
  }

  private async attendreFenetreRateLimit(): Promise<void> {
    if (this.delaiMinimalMs === 0) {
      return;
    }

    if (this.derniereRequete === 0) {
      return;
    }

    const ecoule = Date.now() - this.derniereRequete;
    const attenteRestante = this.delaiMinimalMs - ecoule;
    if (attenteRestante > 0) {
      await this.temporisateur(attenteRestante);
    }
  }

  private purgerCacheAncien(jourCourant: string): void {
    for (const [cle, valeur] of this.cache.entries()) {
      if (valeur.jour !== jourCourant) {
        this.cache.delete(cle);
      }
    }
  }

  private executerEnSerie<T>(operation: () => Promise<T>): Promise<T> {
    const resultat = this.filePromise.then(operation, operation);
    this.filePromise = resultat.then(
      () => undefined,
      () => undefined,
    );
    return resultat;
  }

  private async formaterQuestion(entree: OpenTdbQuestionDto, index: number): Promise<QuestionTrivia> {
    const questionOriginale = decoderBase64(entree.question);
    const reponseOriginale = decoderBase64(entree.correct_answer);
    const mauvaisesReponsesOriginales = entree.incorrect_answers.map((reponse) => decoderBase64(reponse));
    const categorieOriginale = decoderBase64(entree.category);

    const textesATraduire = [
      questionOriginale,
      reponseOriginale,
      ...mauvaisesReponsesOriginales,
      categorieOriginale,
    ];
    let traductions: string[] = [];
    try {
      traductions = await this.traducteur.traduireTextes(textesATraduire);
    } catch (erreur) {
      journalPrincipal.erreur('Impossible de traduire la question OpenTDB via DeepL', erreur);
    }
    const questionTraduite = traductions[0] ?? questionOriginale;
    const reponseTraduite = traductions[1] ?? reponseOriginale;
    const mauvaisesTraductions = mauvaisesReponsesOriginales.map(
      (texte, position) => traductions[2 + position] ?? texte,
    );
    const categorieTraduite = traductions[2 + mauvaisesReponsesOriginales.length] ?? categorieOriginale;

    const propositions = genererPropositions(reponseTraduite, mauvaisesTraductions);

    return {
      id: genererIdentifiant(entree, index),
      question: questionTraduite,
      propositions,
      reponse: reponseTraduite,
      categorie: categorieTraduite,
      difficulte: normaliserDifficulte(entree.difficulty),
    };
  }
}

function normaliserErreurOpenTdb(erreur: unknown): Error {
  if (axios.isAxiosError(erreur) && erreur.response?.status === 429) {
    return new Error('Limite de débit OpenTDB atteinte, réessayez dans quelques secondes.');
  }
  return erreur instanceof Error ? erreur : new Error('Erreur inconnue');
}

function genererPropositions(reponse: string, mauvaisesReponses: string[]): string[] {
  const propositions = new Set<string>([reponse, ...mauvaisesReponses]);
  return Array.from(propositions);
}

function genererIdentifiant(entree: OpenTdbQuestionDto, index: number): string {
  return createHash('sha1')
    .update(entree.question)
    .update(entree.correct_answer)
    .update(String(index))
    .digest('hex')
    .slice(0, 16);
}

function decoderBase64(valeur: string): string {
  return Buffer.from(valeur, 'base64').toString('utf8');
}

function normaliserDifficulte(entree: OpenTdbQuestionDto['difficulty']): NiveauDifficulte {
  switch (entree) {
    case 'easy':
      return 'facile';
    case 'hard':
      return 'difficile';
    default:
      return 'moyen';
  }
}

function mapperDifficultePourApi(difficulte?: NiveauDifficulte): string | undefined {
  if (!difficulte) {
    return undefined;
  }

  switch (difficulte) {
    case 'facile':
      return 'easy';
    case 'difficile':
      return 'hard';
    default:
      return 'medium';
  }
}

function mapperCategoriePourApi(categorie?: string): number | undefined {
  if (!categorie) {
    return undefined;
  }

  const categorieNumerique = Number.parseInt(categorie, 10);
  if (Number.isNaN(categorieNumerique)) {
    return undefined;
  }

  return categorieNumerique;
}

function decrireCodeErreur(code: number): string {
  switch (code) {
    case 1:
      return "Aucun résultat disponible pour la requête OpenTDB.";
    case 2:
      return 'Paramètres invalides pour la requête OpenTDB.';
    case 3:
      return 'Jeton de session OpenTDB introuvable.';
    case 4:
      return 'Jeton de session OpenTDB épuisé, réinitialisation nécessaire.';
    case 5:
      return 'Limite de débit OpenTDB atteinte, réessayez plus tard.';
    default:
      return `Réponse inattendue d’OpenTDB (code ${code}).`;
  }
}

function construireCleCache(jour: string, parametres: ParametresRecherche): string {
  return JSON.stringify({
    jour,
    difficulte: parametres.difficulte ?? 'toutes',
    categorie: parametres.categorie ?? 'toutes',
    limite: parametres.limite ?? 1,
  });
}

function clonerQuestions(questions: QuestionTrivia[]): QuestionTrivia[] {
  return questions.map((question) => ({
    ...question,
    propositions: [...question.propositions],
  }));
}

function creerTemporisateurParDefaut(): (dureeMs: number) => Promise<void> {
  return (dureeMs: number) =>
    new Promise((resolve) => {
      if (dureeMs <= 0) {
        resolve();
        return;
      }
      setTimeout(resolve, dureeMs);
    });
}
