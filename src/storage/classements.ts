import fs from 'fs';
import path from 'path';

import type { ClassementsSnapshot, EntreeClassement, TypeClassement } from '../score/classement-service';
import { journalPrincipal } from '../utils/journalisation';

const DATA_DIRECTORY = process.env.DATA_STORE_DIR ?? path.join(process.cwd(), 'data');
const CLASSEMENTS_PATH = process.env.CLASSEMENTS_STORE_PATH ?? path.join(DATA_DIRECTORY, 'classements.json');

const TYPES_CLASSEMENT: TypeClassement[] = ['quotidien', 'hebdomadaire', 'mensuel', 'global'];

const DEFAULT_STATE: ClassementsSnapshot = {
  quotidien: [],
  hebdomadaire: [],
  mensuel: [],
  global: [],
};

let cache: ClassementsSnapshot | null = null;

function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function normaliserClassements(value: unknown): ClassementsSnapshot {
  const resultat: ClassementsSnapshot = {
    quotidien: [],
    hebdomadaire: [],
    mensuel: [],
    global: [],
  };

  if (typeof value !== 'object' || value === null) {
    return resultat;
  }

  const brut = value as Record<string, unknown>;
  for (const type of TYPES_CLASSEMENT) {
    const source = Array.isArray(brut[type]) ? (brut[type] as unknown[]) : [];
    const normalises: EntreeClassement[] = [];

    for (const entree of source) {
      if (typeof entree !== 'object' || entree === null) {
        continue;
      }

      const brutEntree = entree as Partial<EntreeClassement>;
      if (
        typeof brutEntree.utilisateurId !== 'string' ||
        typeof brutEntree.points !== 'number' ||
        Number.isNaN(brutEntree.points) ||
        typeof brutEntree.derniereMiseAJour !== 'string'
      ) {
        continue;
      }

      normalises.push({
        utilisateurId: brutEntree.utilisateurId,
        points: brutEntree.points,
        derniereMiseAJour: brutEntree.derniereMiseAJour,
      });
    }

    if (normalises.length === 0) {
      continue;
    }

    resultat[type] = normalises;
  }

  return resultat;
}

function cloneState(state: ClassementsSnapshot): ClassementsSnapshot {
  const clone: ClassementsSnapshot = {
    quotidien: [],
    hebdomadaire: [],
    mensuel: [],
    global: [],
  };

  for (const type of TYPES_CLASSEMENT) {
    const source = state[type];
    const copie: EntreeClassement[] = [];
    for (const entree of source) {
      copie.push({
        utilisateurId: entree.utilisateurId,
        points: entree.points,
        derniereMiseAJour: entree.derniereMiseAJour,
      });
    }
    clone[type] = copie;
  }

  return clone;
}

function loadState(): ClassementsSnapshot {
  if (cache) {
    return cache;
  }

  try {
    if (!fs.existsSync(CLASSEMENTS_PATH)) {
      cache = cloneState(DEFAULT_STATE);
      return cache;
    }

    const raw = fs.readFileSync(CLASSEMENTS_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    cache = normaliserClassements(parsed);
    return cache;
  } catch (erreur) {
    journalPrincipal.erreur('Impossible de charger les classements depuis le disque', erreur);
    cache = cloneState(DEFAULT_STATE);
    return cache;
  }
}

export function lireClassementsState(): ClassementsSnapshot {
  return cloneState(loadState());
}

export function sauvegarderClassementsState(state: ClassementsSnapshot): void {
  try {
    ensureDirectoryExists(CLASSEMENTS_PATH);
    fs.writeFileSync(CLASSEMENTS_PATH, JSON.stringify(state, null, 2), 'utf-8');
    cache = cloneState(state);
  } catch (erreur) {
    journalPrincipal.erreur('Impossible de sauvegarder les classements sur le disque', erreur);
  }
}

export function resetClassementsState(): void {
  sauvegarderClassementsState(cloneState(DEFAULT_STATE));
}
