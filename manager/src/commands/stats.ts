import type { TranslationService } from "../services";
import type { Command } from "../types";
import { UNTRANSLATED_MARKER } from "../types";

export class StatsCommand implements Command {
  name = "stats";
  description = "ko/ 번역 통계";

  constructor(private translationService: TranslationService) {}

  async execute(): Promise<void> {
    const data = await this.translationService.load();
    let total = 0;
    let untranslated = 0;

    for (const entries of Object.values(data)) {
      for (const value of Object.values(entries)) {
        if (typeof value === "string") {
          total++;
          if (value.includes(UNTRANSLATED_MARKER)) {
            untranslated++;
          }
        }
      }
    }

    const translated = total - untranslated;
    const percentage = ((translated / total) * 100).toFixed(1);

    console.log(`\n=== ko/translation.json 통계 ===`);
    console.log(`전체: ${total}`);
    console.log(`번역됨: ${translated} (${percentage}%)`);
    console.log(`미번역: ${untranslated}`);
  }
}
