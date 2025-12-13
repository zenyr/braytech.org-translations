import type { TranslationService } from "../services";
import type { Command } from "../types";
import { UNTRANSLATED_MARKER } from "../types";

export class FindUntranslatedCommand implements Command {
  name = "find-untranslated";
  description = "미번역 항목 찾기 (🦘 마커)";

  constructor(private translationService: TranslationService) {}

  async execute(): Promise<void> {
    const data = await this.translationService.load();
    const results: { section: string; key: string; value: string }[] = [];

    for (const [section, entries] of Object.entries(data)) {
      for (const [key, value] of Object.entries(entries)) {
        if (typeof value === "string" && value.includes(UNTRANSLATED_MARKER)) {
          results.push({ section, key, value });
        }
      }
    }

    console.log(`\n미번역 항목: ${results.length}개\n`);
    for (const { section, key, value } of results.slice(0, 20)) {
      console.log(`  ${section}.${key}: ${value}`);
    }
    if (results.length > 20) {
      console.log(`  ... 외 ${results.length - 20}개`);
    }
  }
}
