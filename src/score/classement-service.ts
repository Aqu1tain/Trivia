import dayjs, { type Dayjs } from '../utils/date';

export type TypeClassement = 'quotidien' | 'hebdomadaire' | 'mensuel' | 'global';

export interface EntreeClassement {
  utilisateurId: string;
  points: number;
  derniereMiseAJour: string;
}

export type ClassementsSnapshot = Record<TypeClassement, EntreeClassement[]>;

const TYPES_CLASSEMENT: TypeClassement[] = ['quotidien', 'hebdomadaire', 'mensuel', 'global'];

interface EntreeClassementInterne extends EntreeClassement {
  periodeCle: string;
}

/**
 * Stockage temporaire en mémoire pour les classements. À remplacer par une base de données.
 */
export class ServiceClassements {
  private readonly classements: Map<TypeClassement, Map<string, EntreeClassementInterne>>;

  constructor() {
    this.classements = new Map<TypeClassement, Map<string, EntreeClassementInterne>>();
    for (const type of TYPES_CLASSEMENT) {
      this.classements.set(type, new Map());
    }
  }

  public ajouterScore(type: TypeClassement, utilisateurId: string, points: number, date: Date = new Date()): void {
    const classement = this.classements.get(type);
    if (!classement) {
      throw new Error(`Classement inconnu: ${type}`);
    }

    const reference = dayjs(date);
    const clePeriode = determinerClePeriode(type, reference);
    const entreeExistante = classement.get(utilisateurId);
    const nouveauTotal =
      entreeExistante && entreeExistante.periodeCle === clePeriode ? entreeExistante.points + points : points;

    classement.set(utilisateurId, {
      utilisateurId,
      points: nouveauTotal,
      derniereMiseAJour: reference.toISOString(),
      periodeCle: clePeriode,
    });
  }

  public obtenirTop(type: TypeClassement, limite: number = 10): EntreeClassement[] {
    const classement = this.classements.get(type);
    if (!classement) {
      return [];
    }

    const cleCourante = determinerClePeriode(type, dayjs());
    this.nettoyerAnciennesEntrees(type, cleCourante);

    const entreesActives = Array.from(classement.values())
      .filter((entree) => entree.periodeCle === cleCourante || type === 'global')
      .sort((a, b) => b.points - a.points)
      .slice(0, limite)
      .map(({ periodeCle: _, ...publicEntree }) => publicEntree);

    return entreesActives;
  }

  public obtenirScoreUtilisateur(type: TypeClassement, utilisateurId: string): EntreeClassement | null {
    const classement = this.classements.get(type);
    if (!classement) {
      return null;
    }

    const cleCourante = determinerClePeriode(type, dayjs());
    const entree = classement.get(utilisateurId);
    if (!entree) {
      return null;
    }

    if (type !== 'global' && entree.periodeCle !== cleCourante) {
      classement.delete(utilisateurId);
      return null;
    }

    const { periodeCle: _, ...restant } = entree;
    return restant;
  }

  public toSnapshot(): ClassementsSnapshot {
    const snapshot: ClassementsSnapshot = {
      quotidien: [],
      hebdomadaire: [],
      mensuel: [],
      global: [],
    };

    for (const type of TYPES_CLASSEMENT) {
      const classement = this.classements.get(type);
      if (!classement) {
        continue;
      }

      const cleCourante = determinerClePeriode(type, dayjs());
      const liste: EntreeClassement[] = [];
      for (const entree of classement.values()) {
        if (type !== 'global' && entree.periodeCle !== cleCourante) {
          continue;
        }
        liste.push({
          utilisateurId: entree.utilisateurId,
          points: entree.points,
          derniereMiseAJour: entree.derniereMiseAJour,
        });
      }
      snapshot[type] = liste;
    }

    return snapshot;
  }

  private nettoyerAnciennesEntrees(type: TypeClassement, cleCourante: string): void {
    if (type === 'global') {
      return;
    }

    const classement = this.classements.get(type);
    if (!classement) {
      return;
    }

    for (const [identifiant, entree] of classement.entries()) {
      if (entree.periodeCle !== cleCourante) {
        classement.delete(identifiant);
      }
    }
  }
}

function determinerClePeriode(type: TypeClassement, reference: Dayjs): string {
  switch (type) {
    case 'quotidien':
      return reference.format('YYYY-MM-DD');
    case 'hebdomadaire':
      return `${reference.isoWeekYear()}-W${reference.isoWeek().toString().padStart(2, '0')}`;
    case 'mensuel':
      return reference.format('YYYY-MM');
    case 'global':
    default:
      return 'global';
  }
}
