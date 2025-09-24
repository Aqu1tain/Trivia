import dayjs, { dayjsDansFuseau, type Dayjs } from '../utils/date';

export type TypeClassement = 'quotidien' | 'hebdomadaire' | 'mensuel' | 'global';

export interface EntreeClassement {
  utilisateurId: string;
  points: number;
  derniereMiseAJour: string;
}

export type ClassementsSnapshot = Record<TypeClassement, Record<string, EntreeClassement[]>>;

const TYPES_CLASSEMENT: TypeClassement[] = ['quotidien', 'hebdomadaire', 'mensuel', 'global'];

interface EntreeClassementInterne extends EntreeClassement {
  periodeCle: string;
}

type ClassementParGuildes = Map<string, Map<string, EntreeClassementInterne>>;

/**
 * Stockage temporaire en mémoire pour les classements. À remplacer par une base de données.
 */
export class ServiceClassements {
  private readonly classements: Map<TypeClassement, ClassementParGuildes>;

  constructor() {
    this.classements = new Map();
    for (const type of TYPES_CLASSEMENT) {
      this.classements.set(type, new Map());
    }
  }

  public ajouterScore(
    type: TypeClassement,
    guildId: string,
    utilisateurId: string,
    points: number,
    date: Date = new Date(),
    timezone: string = 'Europe/Paris',
  ): void {
    const classement = this.classements.get(type);
    if (!classement) {
      throw new Error(`Classement inconnu: ${type}`);
    }

    const reference = dayjsDansFuseau(date, timezone);
    const clePeriode = determinerClePeriode(type, reference);
    const classementGuilde = obtenirOuCreerClassementGuilde(classement, guildId);
    const entreeExistante = classementGuilde.get(utilisateurId);
    const nouveauTotal =
      entreeExistante && entreeExistante.periodeCle === clePeriode ? entreeExistante.points + points : points;

    classementGuilde.set(utilisateurId, {
      utilisateurId,
      points: nouveauTotal,
      derniereMiseAJour: reference.toISOString(),
      periodeCle: clePeriode,
    });
  }

  public obtenirTop(type: TypeClassement, guildId: string, limite: number = 10): EntreeClassement[] {
    const classement = this.classements.get(type);
    if (!classement) {
      return [];
    }

    const classementGuilde = classement.get(guildId);
    if (!classementGuilde) {
      return [];
    }

    if (type !== 'global') {
      const cleCourante = determinerClePeriode(type, dayjs());
      this.nettoyerAnciennesEntrees(type, classementGuilde, cleCourante);
    }

    return Array.from(classementGuilde.values())
      .sort((a, b) => b.points - a.points)
      .slice(0, limite)
      .map(({ periodeCle: _, ...publicEntree }) => publicEntree);
  }

  public obtenirScoreUtilisateur(type: TypeClassement, guildId: string, utilisateurId: string): EntreeClassement | null {
    const classement = this.classements.get(type);
    if (!classement) {
      return null;
    }

    const classementGuilde = classement.get(guildId);
    if (!classementGuilde) {
      return null;
    }

    const entree = classementGuilde.get(utilisateurId);
    if (!entree) {
      return null;
    }

    if (type !== 'global') {
      const cleCourante = determinerClePeriode(type, dayjs());
      if (entree.periodeCle !== cleCourante) {
        classementGuilde.delete(utilisateurId);
        return null;
      }
    }

    const { periodeCle: _, ...restant } = entree;
    return restant;
  }

  public toSnapshot(): ClassementsSnapshot {
    const snapshot: ClassementsSnapshot = {
      quotidien: {},
      hebdomadaire: {},
      mensuel: {},
      global: {},
    };

    for (const type of TYPES_CLASSEMENT) {
      const classement = this.classements.get(type);
      if (!classement) {
        continue;
      }

      const perGuild: Record<string, EntreeClassement[]> = {};
      for (const [guildId, classementGuilde] of classement.entries()) {
        const cleCourante = type === 'global' ? null : determinerClePeriode(type, dayjs());
        const liste: EntreeClassement[] = [];
        for (const entree of classementGuilde.values()) {
          if (cleCourante && entree.periodeCle !== cleCourante) {
            continue;
          }
          liste.push({
            utilisateurId: entree.utilisateurId,
            points: entree.points,
            derniereMiseAJour: entree.derniereMiseAJour,
          });
        }
        if (liste.length > 0) {
          perGuild[guildId] = liste;
        }
      }
      snapshot[type] = perGuild;
    }

    return snapshot;
  }

  private nettoyerAnciennesEntrees(
    type: TypeClassement,
    classementGuilde: Map<string, EntreeClassementInterne>,
    cleCourante: string,
  ): void {
    if (type === 'global') {
      return;
    }

    for (const [identifiant, entree] of classementGuilde.entries()) {
      if (entree.periodeCle !== cleCourante) {
        classementGuilde.delete(identifiant);
      }
    }
  }
}

function obtenirOuCreerClassementGuilde(
  classement: ClassementParGuildes,
  guildId: string,
): Map<string, EntreeClassementInterne> {
  const existant = classement.get(guildId);
  if (existant) {
    return existant;
  }
  const nouveau = new Map<string, EntreeClassementInterne>();
  classement.set(guildId, nouveau);
  return nouveau;
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
