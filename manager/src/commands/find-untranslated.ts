import type { TranslationService } from "../services";
import type { Command } from "../types";
import { UNTRANSLATED_MARKER, puaToMarkers } from "../types";

export class FindUntranslatedCommand implements Command {
  name = "find-untranslated";
  description = "미번역 항목 찾기 (🦘 마커)";

  constructor(private translationService: TranslationService) {}

  async execute(): Promise<void> {
    const data = await this.translationService.load();
    const results: { path: string; value: string }[] = [];

    this.findUntranslatedRecursive(data, "", results);

    console.log(`\n미번역 항목: ${results.length}개\n`);
    for (const { path, value } of results.slice(0, 20)) {
      console.log(`  ${path}: ${puaToMarkers(value)}`);
    }
    if (results.length > 20) {
      console.log(`  ... 외 ${results.length - 20}개`);
    }
  }

  private findUntranslatedRecursive(
    obj: any,
    currentPath: string,
    results: { path: string; value: string }[]
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const path = currentPath ? `${currentPath}.${key}` : key;

      if (typeof value === "string") {
        if (value.includes(UNTRANSLATED_MARKER)) {
          results.push({ path, value });
        }
      } else if (typeof value === "object" && value !== null) {
        this.findUntranslatedRecursive(value, path, results);
      }
    }
  }
}
