import { ServiceClassements } from '../score/classement-service';
import type { ClassementsSnapshot, EntreeClassement, TypeClassement } from '../score/classement-service';
import { lireClassementsState, sauvegarderClassementsState } from '../storage/classements';

const TYPES_CLASSEMENT: TypeClassement[] = ['quotidien', 'hebdomadaire', 'mensuel', 'global'];

let instance: ServiceClassements | null = null;

export function obtenirServiceClassements(): ServiceClassements {
  if (!instance) {
    instance = new ServiceClassements();
    initialiserDepuisSnapshot(instance, lireClassementsState());
  }
  return instance;
}

export function sauvegarderClassementsActuels(): void {
  if (!instance) {
    return;
  }
  sauvegarderClassementsState(instance.toSnapshot());
}

function initialiserDepuisSnapshot(service: ServiceClassements, snapshot: ClassementsSnapshot): void {
  for (const type of TYPES_CLASSEMENT) {
    const parGuild = snapshot[type] ?? {};
    for (const [guildId, entrees] of Object.entries(parGuild)) {
      for (const entree of entrees) {
        if (!estEntreeClassement(entree) || entree.points <= 0) {
          continue;
        }
        service.ajouterScore(type, guildId, entree.utilisateurId, entree.points, new Date(entree.derniereMiseAJour));
      }
    }
  }
}

function estEntreeClassement(valeur: unknown): valeur is EntreeClassement {
  if (typeof valeur !== 'object' || valeur === null) {
    return false;
  }

  const entree = valeur as Partial<EntreeClassement>;
  return (
    typeof entree.utilisateurId === 'string' &&
    typeof entree.points === 'number' &&
    typeof entree.derniereMiseAJour === 'string'
  );
}
