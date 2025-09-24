import fs from 'fs';
import path from 'path';

import type { ClassementsSnapshot, EntreeClassement, TypeClassement } from '../score/classement-service';
import { journalPrincipal } from '../utils/journalisation';

const DATA_DIRECTORY = process.env.DATA_STORE_DIR ?? path.join(process.cwd(), 'data');
const CLASSEMENTS_PATH = process.env.CLASSEMENTS_STORE_PATH ?? path.join(DATA_DIRECTORY, 'classements.json');

const TYPES_CLASSEMENT: TypeClassement[] = ['quotidien', 'hebdomadaire', 'mensuel', 'global'];

const DEFAULT_STATE: ClassementsSnapshot = {
  quotidien: {},
  hebdomadaire: {},
  mensuel: {},
  global: {},
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
    quotidien: {},
    hebdomadaire: {},
    mensuel: {},
    global: {},
  };

  if (typeof value !== 'object' || value === null) {
    return resultat;
  }

  const brut = value as Record<string, unknown>;
  for (const type of TYPES_CLASSEMENT) {
    const source = brut[type];
    if (typeof source !== 'object' || source === null) {
      continue;
    }

    const parGuild = source as Record<string, unknown>;
    const normalises: Record<string, EntreeClassement[]> = {};

    for (const [guildId, entries] of Object.entries(parGuild)) {
      if (!Array.isArray(entries)) {
        continue;
      }

      const liste: EntreeClassement[] = [];
      for (const entree of entries) {
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

        liste.push({
          utilisateurId: brutEntree.utilisateurId,
          points: brutEntree.points,
          derniereMiseAJour: brutEntree.derniereMiseAJour,
        });
      }

      if (liste.length > 0) {
        normalises[guildId] = liste;
      }
    }

    resultat[type] = normalises;
  }

  return resultat;
}

function cloneState(state: ClassementsSnapshot): ClassementsSnapshot {
  const clone: ClassementsSnapshot = {
    quotidien: {},
    hebdomadaire: {},
    mensuel: {},
    global: {},
  };

  for (const type of TYPES_CLASSEMENT) {
    const parGuild = state[type];
    const copie: Record<string, EntreeClassement[]> = {};
    for (const [guildId, entries] of Object.entries(parGuild)) {
      copie[guildId] = entries.map((entree) => ({
        utilisateurId: entree.utilisateurId,
        points: entree.points,
        derniereMiseAJour: entree.derniereMiseAJour,
      }));
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
