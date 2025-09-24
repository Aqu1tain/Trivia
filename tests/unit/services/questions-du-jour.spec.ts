import { GestionnaireQuestionsDuJour } from '../../../src/services/questions-du-jour';
import type { QuestionTrivia, QuizzApiClient } from '../../../src/services/quizzapi';

describe('GestionnaireQuestionsDuJour', () => {
  const questionFactory = (id: string): QuestionTrivia => ({
    id,
    question: `Question ${id}`,
    reponse: 'Réponse',
    propositions: ['Réponse', 'A', 'B'],
    categorie: 'tv_cinema',
    difficulte: id.includes('facile') ? 'facile' : id.includes('diff') ? 'difficile' : 'moyen',
  });

  it('génère et met en cache les questions par date', async () => {
    const client: Pick<QuizzApiClient, 'recupererQuestions'> = {
      recupererQuestions: jest
        .fn()
        .mockResolvedValueOnce([questionFactory('facile-1')])
        .mockResolvedValueOnce([questionFactory('moyen-1')])
        .mockResolvedValueOnce([questionFactory('difficile-1')]),
    };

    const gestionnaire = new GestionnaireQuestionsDuJour(client);

    const jour1 = await gestionnaire.obtenirJeuPour(new Date('2024-01-01'));
    const jour1Bis = await gestionnaire.obtenirJeuPour(new Date('2024-01-01T15:00:00Z'));

    expect(jour1).toBe(jour1Bis);
    expect(client.recupererQuestions).toHaveBeenCalledTimes(3);
    expect(jour1.niveau.facile.question.id).toBe('facile-1');
  });

  it('enregistre la participation d’un utilisateur', async () => {
    const client: Pick<QuizzApiClient, 'recupererQuestions'> = {
      recupererQuestions: jest
        .fn()
        .mockResolvedValueOnce([questionFactory('facile-1')])
        .mockResolvedValueOnce([questionFactory('moyen-1')])
        .mockResolvedValueOnce([questionFactory('difficile-1')]),
    };

    const gestionnaire = new GestionnaireQuestionsDuJour(client);
    const date = new Date('2024-02-10');

    await gestionnaire.obtenirJeuPour(date);

    expect(gestionnaire.aDejaRepondu(date, 'facile', 'user1', 'guild')).toBe(false);
    gestionnaire.enregistrerParticipation(date, 'facile', 'user1', 'guild', {
      reponse: 'Réponse',
      statut: 'correct',
      reponduLe: new Date().toISOString(),
    });
    expect(gestionnaire.aDejaRepondu(date, 'facile', 'user1', 'guild')).toBe(true);
  });

  it('lève une erreur si aucune question n’est renvoyée', async () => {
    const client: Pick<QuizzApiClient, 'recupererQuestions'> = {
      recupererQuestions: jest.fn().mockResolvedValue([]),
    };

    const gestionnaire = new GestionnaireQuestionsDuJour(client);

    await expect(gestionnaire.obtenirJeuPour(new Date('2024-03-01'))).rejects.toThrow(
      /Aucune question disponible/
    );
  });
});
