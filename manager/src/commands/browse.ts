import type { TranslationService } from "../services";
import { fuzzySearch } from "../services";
import type { Command, TranslationData } from "../types";
import { UNTRANSLATED_MARKER, puaToMarkers } from "../types";

export class BrowseCommand implements Command {
  name = "browse";
  description = "ko/ 번역 파일 탐색 (ls|get|search)";

  constructor(private translationService: TranslationService) {}

  async execute(): Promise<void> {
    const args = Bun.argv.slice(3);
    const subcommand = args[0] ?? "ls";

    switch (subcommand) {
      case "ls":
        await this.list(args[1]);
        break;
      case "get":
        await this.get(args[1]);
        break;
      case "search":
      case "s":
        await this.search(args[1]);
        break;
      default:
        // default: treat as path for ls
        if (subcommand.startsWith("-")) {
          this.printHelp();
        } else {
          await this.list(subcommand);
        }
    }
  }

  private async list(path?: string): Promise<void> {
    const data = await this.translationService.load();
    const target = path ? this.getByPath(data, path) : data;

    if (target === undefined) {
      console.error(`경로를 찾을 수 없습니다: ${path}`);
      return;
    }

    if (typeof target === "string") {
      console.log(`\n"${path}" = "${puaToMarkers(target)}"\n`);
      return;
    }

    const keys = Object.keys(target);
    const title = path ?? "root";

    console.log(`\n=== ${title} (${keys.length}개) ===\n`);

    for (const key of keys.sort()) {
      const value = target[key];
      const fullPath = path ? `${path}.${key}` : key;

      if (typeof value === "string") {
        const display = this.truncate(puaToMarkers(value), 40);
        const marker = value.includes(UNTRANSLATED_MARKER) ? " 🦘" : "";
        console.log(`  ${key} = "${display}"${marker}`);
      } else {
        const count = this.countLeaves(value);
        console.log(`  ${key}/ (${count})`);
      }
    }
    console.log();
  }

  private async get(path?: string): Promise<void> {
    if (!path) {
      console.error("사용법: browse get <경로>");
      return;
    }

    const data = await this.translationService.load();
    const value = this.getByPath(data, path);

    if (value === undefined) {
      console.error(`경로를 찾을 수 없습니다: ${path}`);
      return;
    }

    if (typeof value === "string") {
      console.log(puaToMarkers(value));
    } else {
      console.log(JSON.stringify(value, null, 2));
    }
  }

  private async search(query?: string): Promise<void> {
    if (!query) {
      console.error("사용법: browse search <검색어>");
      return;
    }

    const data = await this.translationService.load();
    const flattened = this.flatten(data);
    const limit = 20;

    const items = Object.entries(flattened).map(([path, value]) => ({
      path,
      value,
    }));

    const results = fuzzySearch(
      items,
      query,
      (item) => [
        { name: "path", value: item.path },
        { name: "value", value: item.value },
      ],
      { limit }
    );

    if (results.length === 0) {
      console.log(`"${query}"에 대한 결과가 없습니다.`);
      return;
    }

    console.log(`\n=== "${query}" 검색 결과 (${results.length}개) ===\n`);

    for (const { item, score } of results) {
      const display = this.truncate(puaToMarkers(item.value), 50);
      const marker = item.value.includes(UNTRANSLATED_MARKER) ? " 🦘" : "";
      const scoreDisplay = score === 1.0 ? "" : ` [${score.toFixed(2)}]`;
      console.log(`  ${item.path}${scoreDisplay}`);
      console.log(`    → "${display}"${marker}`);
    }
    console.log();
  }

  private getByPath(data: TranslationData, path: string): unknown {
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

  private flatten(data: TranslationData, prefix = ""): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(data)) {
      const path = prefix ? `${prefix}.${key}` : key;

      if (typeof value === "string") {
        result[path] = value;
      } else if (typeof value === "object" && value !== null) {
        Object.assign(result, this.flatten(value as TranslationData, path));
      }
    }

    return result;
  }

  private countLeaves(obj: unknown): number {
    if (typeof obj === "string") return 1;
    if (typeof obj !== "object" || obj === null) return 0;

    let count = 0;
    for (const value of Object.values(obj)) {
      count += this.countLeaves(value);
    }
    return count;
  }

  private truncate(str: string, max: number): string {
    const oneLine = str.replace(/\n/g, "\\n");
    if (oneLine.length <= max) return oneLine;
    return oneLine.slice(0, max - 3) + "...";
  }

  private printHelp(): void {
    console.log(`
사용법: bun run manager browse <명령> [옵션]

명령:
  ls [경로]              경로 탐색 (기본: root)
  get <경로>             값 조회
  search, s <검색어>     키/값 검색

예시:
  browse                 root 키 목록
  browse Settings        Settings 하위 키
  browse ls Settings.Subscriptions
  browse get Action.Accept
  browse search 북마크
`);
  }
}
