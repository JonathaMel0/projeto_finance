/**
 * Controle de idempotência por `update_id`.
 *
 * Limitação conhecida: o registro vive na memória da instância serverless,
 * então protege contra reentregas imediatas do Telegram, mas não contra
 * reentregas atendidas por outra instância. Na Fase 5 a gravação do
 * lançamento ganhará uma chave idempotente persistida (aba `logs`).
 */
export class UpdateDeduplicator {
  private readonly seen = new Set<number>();

  constructor(private readonly maxSize = 1000) {}

  /** Retorna `true` se o update já foi visto; caso contrário o registra. */
  seenBefore(updateId: number): boolean {
    if (this.seen.has(updateId)) return true;
    this.seen.add(updateId);
    if (this.seen.size > this.maxSize) {
      const oldest = this.seen.values().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    return false;
  }
}
