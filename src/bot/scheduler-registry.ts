import type { PlanificateurAnnonceQuotidienne } from './scheduler';

let planificateur: PlanificateurAnnonceQuotidienne | null = null;

export function enregistrerPlanificateur(instance: PlanificateurAnnonceQuotidienne): void {
  planificateur = instance;
}

export function obtenirPlanificateur(): PlanificateurAnnonceQuotidienne | null {
  return planificateur;
}
