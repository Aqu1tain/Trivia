import { ServiceClassements } from '../../../src/score/classement-service';
import dayjs from '../../../src/utils/date';

describe('ServiceClassements', () => {
  it('agrège les points par utilisateur', () => {
    const service = new ServiceClassements();
    service.ajouterScore('quotidien', 'utilisateurA', 10);
    service.ajouterScore('quotidien', 'utilisateurA', 5);

    const [entree] = service.obtenirTop('quotidien');

    expect(entree.utilisateurId).toBe('utilisateurA');
    expect(entree.points).toBe(15);
  });

  it('réinitialise le classement quotidien lorsque la date change', () => {
    const service = new ServiceClassements();
    const hier = dayjs().subtract(1, 'day').toDate();
    const maintenant = new Date();

    service.ajouterScore('quotidien', 'utilisateurA', 10, hier);
    service.ajouterScore('quotidien', 'utilisateurA', 5, maintenant);

    const top = service.obtenirTop('quotidien');

    expect(top).toHaveLength(1);
    expect(top[0].points).toBe(5);
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
