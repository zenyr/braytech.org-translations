import type { Command, GlossaryData } from "../types";
import { GLOSSARY_PATH } from "../types";

export class GlossaryCommand implements Command {
  name = "glossary";
  description = "용어집 관리 (list|search|add|remove)";

  async execute(): Promise<void> {
    const args = Bun.argv.slice(3);
    const subcommand = args[0] ?? "list";

    switch (subcommand) {
      case "list":
      case "ls":
        await this.list();
        break;
      case "search":
      case "s":
        await this.search(args[1]);
        break;
      case "add":
      case "set":
        await this.add(args[1], args[2], args[3]);
        break;
      case "remove":
      case "rm":
        await this.remove(args[1], args[2]);
        break;
      default:
        this.printHelp();
    }
  }

  private async load(): Promise<GlossaryData> {
    const file = Bun.file(GLOSSARY_PATH);
    if (!(await file.exists())) return {};
    return file.json();
  }

  private async save(data: GlossaryData): Promise<void> {
    const sorted = Object.keys(data)
      .sort()
      .reduce<GlossaryData>((acc, key) => {
        acc[key] = data[key];
        return acc;
      }, {});
    await Bun.write(GLOSSARY_PATH, JSON.stringify(sorted, null, 2) + "\n");
  }

  private async list(): Promise<void> {
    const data = await this.load();
    const terms = Object.keys(data);

    if (terms.length === 0) {
      console.log("용어집이 비어있습니다.");
      return;
    }

    console.log(`\n=== 용어집 (${terms.length}개) ===\n`);
    for (const term of terms.sort()) {
      const contexts = data[term];
      const entries = Object.entries(contexts);
      if (entries.length === 1 && entries[0][0] === "general") {
        console.log(`  ${term} → ${entries[0][1]}`);
      } else {
        console.log(`  ${term}`);
        for (const [ctx, trans] of entries) {
          console.log(`    [${ctx}] → ${trans}`);
        }
      }
    }
    console.log();
  }

  private async search(query?: string): Promise<void> {
    if (!query) {
      console.error("사용법: glossary search <검색어>");
      return;
    }

    const data = await this.load();
    const lowerQuery = query.toLowerCase();
    const matches: Array<{ term: string; context: string; translation: string }> = [];

    for (const [term, contexts] of Object.entries(data)) {
      for (const [ctx, trans] of Object.entries(contexts)) {
        if (
          term.toLowerCase().includes(lowerQuery) ||
          trans.toLowerCase().includes(lowerQuery)
        ) {
          matches.push({ term, context: ctx, translation: trans });
        }
      }
    }

    if (matches.length === 0) {
      console.log(`"${query}"에 대한 결과가 없습니다.`);
      return;
    }

    console.log(`\n=== "${query}" 검색 결과 (${matches.length}개) ===\n`);
    for (const { term, context, translation } of matches) {
      if (context === "general") {
        console.log(`  ${term} → ${translation}`);
      } else {
        console.log(`  ${term} [${context}] → ${translation}`);
      }
    }
    console.log();
  }

  private async add(term?: string, translation?: string, context?: string): Promise<void> {
    if (!term || !translation) {
      console.error("사용법: glossary add <용어> <번역> [컨텍스트]");
      return;
    }

    const ctx = context ?? "general";
    const data = await this.load();

    if (!data[term]) {
      data[term] = {};
    }

    const oldValue = data[term][ctx];

    if (oldValue === translation) {
      console.log(`동일: ${term} [${ctx}] = "${translation}"`);
      return;
    }

    data[term][ctx] = translation;
    await this.save(data);

    if (oldValue !== undefined) {
      console.log(`수정됨: ${term} [${ctx}] "${oldValue}" → "${translation}"`);
    } else {
      console.log(`추가됨: ${term} [${ctx}] → "${translation}"`);
    }
  }

  private async remove(term?: string, context?: string): Promise<void> {
    if (!term) {
      console.error("사용법: glossary remove <용어> [컨텍스트]");
      return;
    }

    const data = await this.load();

    if (!data[term]) {
      console.error(`"${term}" 용어가 없습니다.`);
      return;
    }

    if (context) {
      if (!data[term][context]) {
        console.error(`"${term}" [${context}] 컨텍스트가 없습니다.`);
        return;
      }
      delete data[term][context];
      if (Object.keys(data[term]).length === 0) {
        delete data[term];
      }
      console.log(`삭제됨: ${term} [${context}]`);
    } else {
      delete data[term];
      console.log(`삭제됨: ${term} (모든 컨텍스트)`);
    }

    await this.save(data);
  }

  private printHelp(): void {
    console.log(`
사용법: bun run manager glossary <명령> [옵션]

명령:
  list, ls                      전체 목록
  search, s <검색어>            용어/번역 검색
  add, set <용어> <번역> [컨텍스트]  추가/수정 (기본: general)
  remove, rm <용어> [컨텍스트]  삭제

예시:
  glossary list
  glossary search 수호자
  glossary add Guardian 수호자
  glossary add Strike 공격대 general
  glossary add Strike 타격 action
  glossary remove Strike action
`);
  }
}
