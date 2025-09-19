import nock from 'nock';

import { QuizzApiClient } from '../../../src/services/quizzapi';

describe('QuizzApiClient', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("retourne les questions formatées depuis l’API", async () => {
    const baseUrl = 'https://exemple.test';
    const client = new QuizzApiClient(baseUrl);

    nock(baseUrl)
      .get('/quiz')
      .query(true)
      .reply(200, {
        count: 1,
        quizzes: [
          {
            id: 'cmck8wdus000bhzro248cuut4',
            question: 'Qui est le premier interprète du Doctor Who ?',
            answer: 'William Hartnell',
            category: 'tv_cinema',
            difficulty: 'difficile',
            badAnswers: ['Richard Hurndall', 'David Bradley', 'Matt Smith'],
          },
        ],
      });

    const questions = await client.recupererQuestions();

    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      id: 'cmck8wdus000bhzro248cuut4',
      question: 'Qui est le premier interprète du Doctor Who ?',
      reponse: 'William Hartnell',
      difficulte: 'difficile',
      categorie: 'tv_cinema',
    });
    expect(questions[0].propositions).toEqual([
      'William Hartnell',
      'Richard Hurndall',
      'David Bradley',
      'Matt Smith',
    ]);
  });

  it('propage les erreurs réseau', async () => {
    const baseUrl = 'https://exemple.test';
    const client = new QuizzApiClient(baseUrl);

    nock(baseUrl).get('/quiz').query(true).reply(500, { message: 'Erreur' });

    await expect(client.recupererQuestions()).rejects.toThrow();
  });
});
