import dayjs from 'dayjs';

export type TypeClassement = 'quotidien' | 'hebdomadaire' | 'mensuel' | 'global';

export interface EntreeClassement {
  utilisateurId: string;
  points: number;
  derniereMiseAJour: string;
}

export type ClassementsSnapshot = Record<TypeClassement, EntreeClassement[]>;

const TYPES_CLASSEMENT: TypeClassement[] = ['quotidien', 'hebdomadaire', 'mensuel', 'global'];

/**
 * Stockage temporaire en mémoire pour les classements. À remplacer par une base de données.
 */
export class ServiceClassements {
  private readonly classements: Map<TypeClassement, Map<string, EntreeClassement>>;

  constructor() {
    this.classements = new Map<TypeClassement, Map<string, EntreeClassement>>();
    for (const type of TYPES_CLASSEMENT) {
      this.classements.set(type, new Map());
    }
  }

  public ajouterScore(type: TypeClassement, utilisateurId: string, points: number): void {
    const classement = this.classements.get(type);
    if (!classement) {
      throw new Error(`Classement inconnu: ${type}`);
    }

    const entreeExistante = classement.get(utilisateurId);
    const nouveauTotal = (entreeExistante?.points ?? 0) + points;
    classement.set(utilisateurId, {
      utilisateurId,
      points: nouveauTotal,
      derniereMiseAJour: dayjs().toISOString(),
    });
  }

  public obtenirTop(type: TypeClassement, limite: number = 10): EntreeClassement[] {
    const classement = this.classements.get(type);
    if (!classement) {
      return [];
    }

    return Array.from(classement.values())
      .sort((a, b) => b.points - a.points)
      .slice(0, limite);
  }

  public obtenirScoreUtilisateur(type: TypeClassement, utilisateurId: string): EntreeClassement | null {
    const classement = this.classements.get(type);
    if (!classement) {
      return null;
    }

    return classement.get(utilisateurId) ?? null;
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

      const liste: EntreeClassement[] = [];
      for (const entree of classement.values()) {
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
}
