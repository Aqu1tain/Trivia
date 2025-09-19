import { ServiceClassements } from '../../../src/score/classement-service';

describe('ServiceClassements', () => {
  it('agrège les points par utilisateur', () => {
    const service = new ServiceClassements();
    service.ajouterScore('quotidien', 'utilisateurA', 10);
    service.ajouterScore('quotidien', 'utilisateurA', 5);

    const [entree] = service.obtenirTop('quotidien');

    expect(entree.utilisateurId).toBe('utilisateurA');
    expect(entree.points).toBe(15);
  });

  it('renvoie les  limites demandées', () => {
    const service = new ServiceClassements();
    service.ajouterScore('global', 'utilisateurA', 10);
    service.ajouterScore('global', 'utilisateurB', 12);

    const top = service.obtenirTop('global', 1);

    expect(top).toHaveLength(1);
    expect(top[0].utilisateurId).toBe('utilisateurB');
  });
});
