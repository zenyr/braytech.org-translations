import type { TranslationData } from "../types";

export class TranslationService {
  constructor(private path: string) {}

  async load(): Promise<TranslationData> {
    const file = Bun.file(this.path);
    return await file.json();
  }
}
