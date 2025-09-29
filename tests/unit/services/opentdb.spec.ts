import nock from 'nock';

import { OpenTdbClient, type TraducteurTrivia } from '../../../src/services/opentdb';

class TraducteurStub implements TraducteurTrivia {
  public appels: string[][] = [];

  public async traduireTextes(textes: string[]): Promise<string[]> {
    this.appels.push(textes);
    return textes.map((texte) => `${texte} (FR)`);
  }
}

describe('OpenTdbClient', () => {
  const baseUrl = 'https://opentdb.com';
  let traducteur: TraducteurStub;
  let client: OpenTdbClient;
  let temporisateur: jest.Mock<Promise<void>, [number]>;

  beforeEach(() => {
    traducteur = new TraducteurStub();
    temporisateur = jest.fn().mockResolvedValue(undefined);
    client = new OpenTdbClient(baseUrl, traducteur, {
      temporisateur,
      delaiMinimalMs: 1,
    });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('récupère et traduit les questions retournées par OpenTDB', async () => {
    const encode = (valeur: string): string => Buffer.from(valeur, 'utf8').toString('base64');

    nock(baseUrl)
      .get('/api.php')
      .query((params) => params.type === 'multiple' && params.encode === 'base64' && params.amount === '1')
      .reply(200, {
        response_code: 0,
        results: [
          {
            category: encode('General Knowledge'),
            type: 'multiple',
            difficulty: 'easy',
            question: encode('What is the capital of France?'),
            correct_answer: encode('Paris'),
            incorrect_answers: [encode('Berlin'), encode('Madrid'), encode('Rome')],
          },
        ],
      });

    const questions = await client.recupererQuestions({ limite: 1, difficulte: 'facile' });

    expect(questions).toHaveLength(1);
    const [question] = questions;

    expect(question.question).toBe('What is the capital of France? (FR)');
    expect(question.reponse).toBe('Paris (FR)');
    expect(question.categorie).toBe('General Knowledge (FR)');
    expect(question.difficulte).toBe('facile');
    expect(new Set(question.propositions)).toEqual(
      new Set(['Paris (FR)', 'Berlin (FR)', 'Madrid (FR)', 'Rome (FR)']),
    );

    expect(traducteur.appels).toHaveLength(1);
    expect(traducteur.appels[0]).toEqual([
      'What is the capital of France?',
      'Paris',
      'Berlin',
      'Madrid',
      'Rome',
      'General Knowledge',
    ]);
  });

  it('respecte un délai minimal avant une nouvelle requête', async () => {
    const encode = (valeur: string): string => Buffer.from(valeur, 'utf8').toString('base64');
    const temporisateurLocal = jest.fn().mockResolvedValue(undefined);
    const clientAvecDelai = new OpenTdbClient(baseUrl, traducteur, {
      temporisateur: temporisateurLocal,
      delaiMinimalMs: 1000,
    });

    nock(baseUrl)
      .get('/api.php')
      .query((params) => params.difficulty === 'easy')
      .reply(200, {
        response_code: 0,
        results: [
          {
            category: encode('General Knowledge'),
            type: 'multiple',
            difficulty: 'easy',
            question: encode('First question?'),
            correct_answer: encode('Answer 1'),
            incorrect_answers: [encode('A'), encode('B'), encode('C')],
          },
        ],
      });

    nock(baseUrl)
      .get('/api.php')
      .query((params) => params.difficulty === 'medium')
      .reply(200, {
        response_code: 0,
        results: [
          {
            category: encode('Science'),
            type: 'multiple',
            difficulty: 'medium',
            question: encode('Second question?'),
            correct_answer: encode('Answer 2'),
            incorrect_answers: [encode('X'), encode('Y'), encode('Z')],
          },
        ],
      });

    await clientAvecDelai.recupererQuestions({ limite: 1, difficulte: 'facile' });
    await clientAvecDelai.recupererQuestions({ limite: 1, difficulte: 'moyen' });

    expect(temporisateurLocal).toHaveBeenCalledTimes(1);
    const [delai] = temporisateurLocal.mock.calls[0];
    expect(delai).toBeGreaterThan(0);
    expect(delai).toBeLessThanOrEqual(1000);
  });

  it('signale une erreur lorsque OpenTDB renvoie un code inattendu', async () => {
    nock(baseUrl)
      .get('/api.php')
      .query(true)
      .reply(200, {
        response_code: 1,
        results: [],
      });

    await expect(client.recupererQuestions()).rejects.toThrow(/OpenTDB/);
  });

  it('propage les erreurs réseau', async () => {
    nock(baseUrl).get('/api.php').query(true).replyWithError('timeout');

    await expect(client.recupererQuestions()).rejects.toThrow();
  });

  it('réutilise la question traduite pour éviter des appels supplémentaires le même jour', async () => {
    const encode = (valeur: string): string => Buffer.from(valeur, 'utf8').toString('base64');

    nock(baseUrl)
      .get('/api.php')
      .query((params) => params.difficulty === 'medium')
      .reply(200, {
        response_code: 0,
        results: [
          {
            category: encode('Science'),
            type: 'multiple',
            difficulty: 'medium',
            question: encode('Quelle est la formule du sel ?'),
            correct_answer: encode('NaCl'),
            incorrect_answers: [encode('H2O'), encode('CO2'), encode('O2')],
          },
        ],
      });

    const premiere = await client.recupererQuestions({ limite: 1, difficulte: 'moyen' });
    expect(traducteur.appels).toHaveLength(1);
    expect(premiere[0].reponse).toBe('NaCl (FR)');

    const seconde = await client.recupererQuestions({ limite: 1, difficulte: 'moyen' });
    expect(traducteur.appels).toHaveLength(1);
    expect(seconde[0]).not.toBe(premiere[0]);
    expect(seconde[0].reponse).toBe('NaCl (FR)');
  });

  it('bloque les appels supplémentaires après trois requêtes quotidiennes', async () => {
    const encode = (valeur: string): string => Buffer.from(valeur, 'utf8').toString('base64');

    const preparerNock = (difficulty: string, question: string) =>
      nock(baseUrl)
        .get('/api.php')
        .query((params) => params.difficulty === difficulty)
        .reply(200, {
          response_code: 0,
          results: [
            {
              category: encode('Culture'),
              type: 'multiple',
              difficulty,
              question: encode(question),
              correct_answer: encode('Réponse'),
              incorrect_answers: [encode('A'), encode('B'), encode('C')],
            },
          ],
        });

    preparerNock('easy', 'Q1');
    await client.recupererQuestions({ limite: 1, difficulte: 'facile' });

    preparerNock('medium', 'Q2');
    await client.recupererQuestions({ limite: 1, difficulte: 'moyen' });

    preparerNock('hard', 'Q3');
    await client.recupererQuestions({ limite: 1, difficulte: 'difficile' });

    await expect(
      client.recupererQuestions({ limite: 1, difficulte: 'facile', categorie: '18' }),
    ).rejects.toThrow(/Limite quotidienne/);
  });
});
