const CHUNK_SIZE = 100;
interface Scheduler {
  yield?: () => Promise<void>;
}

export function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as typeof globalThis & { scheduler?: Scheduler }).scheduler;
  return typeof scheduler?.yield === 'function'
    ? scheduler.yield()
    : new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
}

/** A newer draw invalidates every pending continuation, even when it has no rows. */
export class ChunkRenderer {
  private generation = 0;
  private readonly yieldTask: () => Promise<void>;

  constructor(yieldTask = yieldToMain) {
    this.yieldTask = yieldTask;
  }

  draw<T>(rows: T[], append: (rows: T[], first: boolean) => void): Promise<void> {
    const generation = ++this.generation;
    append(rows.slice(0, CHUNK_SIZE), true);
    return this.remaining(rows.slice(CHUNK_SIZE), generation, (part) => {
      append(part, false);
    });
  }

  private async remaining<T>(rows: T[], generation: number, append: (rows: T[]) => void) {
    for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
      await this.yieldTask();
      if (generation !== this.generation) return;
      append(rows.slice(offset, offset + CHUNK_SIZE));
    }
  }
}
