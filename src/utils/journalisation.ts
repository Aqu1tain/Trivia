/**
 * Fournit une API de journalisation cohérente pour le bot.
 */
export class Journal {
  private readonly contexte: string;

  constructor(contexte: string) {
    this.contexte = contexte;
  }

  public info(message: string, ...details: unknown[]): void {
    console.info(`[${this.contexte}]`, message, ...details);
  }

  public erreur(message: string, ...details: unknown[]): void {
    console.error(`[${this.contexte}]`, message, ...details);
  }
}

export const journalPrincipal = new Journal('DailyTrivia');
