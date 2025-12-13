import { $ } from "bun";

export class GitService {
  constructor(private root: string) {}

  async getCurrentBranch(): Promise<string> {
    return (await $`git -C ${this.root} branch --show-current`.text()).trim();
  }

  async hasUncommittedChanges(): Promise<boolean> {
    const status = await $`git -C ${this.root} status --porcelain`.text();
    return status.trim().length > 0;
  }

  async checkout(branch: string): Promise<void> {
    await $`git -C ${this.root} checkout ${branch}`.quiet();
  }

  async mergeNoCommit(source: string): Promise<void> {
    try {
      await $`git -C ${this.root} merge ${source} --no-commit --no-ff`.quiet();
    } catch {
      // merge conflict possible
    }
  }

  async resetFiles(files: string[]): Promise<void> {
    await $`git -C ${this.root} reset HEAD ${files.join(" ")}`.quiet();
  }

  async getCachedDiff(): Promise<string> {
    return await $`git -C ${this.root} diff --cached --stat`.text();
  }

  async abortMerge(): Promise<void> {
    await $`git -C ${this.root} merge --abort`.quiet().nothrow();
  }
}
