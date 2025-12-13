import type { TranslationService } from "../services";
import type { Command } from "../types";
import { UNTRANSLATED_MARKER, puaToMarkers } from "../types";

export class FindUntranslatedCommand implements Command {
  name = "find-untranslated";
  description = "미번역 항목 찾기 (🦘 마커)";

  constructor(private translationService: TranslationService) {}

  async execute(): Promise<void> {
    const args = Bun.argv.slice(3);
    const filterPath = args[0];

    const data = await this.translationService.load();
    const results: { path: string; value: string }[] = [];

    // If a filter path is specified, start from that point
    const startData = filterPath ? this.getByPath(data, filterPath) : data;

    if (startData === undefined) {
      console.error(`경로를 찾을 수 없습니다: ${filterPath}`);
      return;
    }

    if (typeof startData === "string") {
      console.error(`"${filterPath}"는 객체가 아닙니다.`);
      return;
    }

    this.findUntranslatedRecursive(startData, filterPath ?? "", results);

    console.log(`\n미번역 항목: ${results.length}개\n`);
    for (const { path, value } of results) {
      console.log(`  ${path}: ${puaToMarkers(value)}`);
    }
  }

  private getByPath(data: any, path: string): unknown {
    const keys = path.split(".");
    let current: unknown = data;

    for (const key of keys) {
      if (current === null || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  private findUntranslatedRecursive(
    obj: any,
    currentPath: string,
    results: { path: string; value: string }[],
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
