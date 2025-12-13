import { $ } from "bun";
import type { GitService } from "../services";
import type { Command } from "../types";
import { PRIVATE_FILES } from "../types";

export class SyncCommand implements Command {
  name = "sync";
  description = "forked → master 동기화 (private files 제외)";

  constructor(
    private gitService: GitService,
    private root: string,
  ) {}

  async execute(): Promise<void> {
    console.log("\n=== forked → master 동기화 (manager/ 제외) ===\n");

    const currentBranch = await this.gitService.getCurrentBranch();
    if (currentBranch !== "forked") {
      console.error(`현재 브랜치: ${currentBranch}`);
      console.error(`forked 브랜치에서 실행해주세요.`);
      process.exit(1);
    }

    if (await this.gitService.hasUncommittedChanges()) {
      console.error("커밋되지 않은 변경사항이 있습니다. 먼저 커밋해주세요.");
      process.exit(1);
    }

    await this.gitService.checkout("master");
    console.log("master 브랜치로 이동");

    await this.gitService.mergeNoCommit("forked");
    console.log("forked 머지 (커밋 전)");

    await this.gitService.resetFiles(PRIVATE_FILES);
    await $`rm -rf ${this.root}manager/`.quiet();
    await $`rm -f ${this.root}package.json ${this.root}AGENTS.md`.quiet();
    console.log("private files 제외됨 (manager/, package.json, AGENTS.md)");

    const diff = await this.gitService.getCachedDiff();
    if (!diff.trim()) {
      console.log("\n동기화할 변경사항이 없습니다.");
      await this.gitService.abortMerge();
      await this.gitService.checkout("forked");
      return;
    }

    console.log("\n변경사항:");
    console.log(diff);
    console.log("\n커밋하려면: git commit -m 'sync from forked'");
    console.log("취소하려면: git merge --abort && git checkout forked");
  }
}
