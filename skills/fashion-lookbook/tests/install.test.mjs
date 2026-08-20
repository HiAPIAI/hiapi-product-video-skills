import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hasLocalChanges, replaceInstall } from "../scripts/install.mjs";

test("installer restores failed swaps and preserves a concurrently changed copy", async () => {
  const root = await mkdtemp(join(tmpdir(), "fashion-lookbook-installer-"));
  const destination = join(root, "hiapi-fashion-lookbook-video");
  const staging = join(root, ".staging");
  const backup = join(root, ".backup");
  const oldMarker = join(destination, "old.txt");

  try {
    await mkdir(destination);
    await writeFile(oldMarker, "old", "utf8");

    assert.throws(() => replaceInstall(destination, staging, backup));
    assert.equal(await readFile(oldMarker, "utf8"), "old");
    await assert.rejects(access(backup));

    await mkdir(staging);
    await writeFile(join(staging, "new.txt"), "new", "utf8");
    replaceInstall(destination, staging, backup);
    assert.equal(await readFile(join(destination, "new.txt"), "utf8"), "new");
    await assert.rejects(access(oldMarker));
    await assert.rejects(access(backup));

    const nextStaging = join(root, ".next-staging");
    const protectedBackup = join(root, ".protected-backup");
    await mkdir(nextStaging);
    await writeFile(join(nextStaging, "next.txt"), "next", "utf8");
    assert.equal(replaceInstall(destination, nextStaging, protectedBackup, true), protectedBackup);
    assert.equal(await readFile(join(protectedBackup, "new.txt"), "utf8"), "new");
    assert.equal(await readFile(join(destination, "next.txt"), "utf8"), "next");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("installer protects ignored files, local branches, and stashes", async () => {
  const root = await mkdtemp(join(tmpdir(), "fashion-lookbook-installer-state-"));
  const repository = join(root, "install");
  const remote = join(root, "remote.git");

  try {
    await mkdir(repository);
    execFileSync("git", ["init", "--bare", remote], { stdio: "ignore" });
    execFileSync("git", ["-C", repository, "init", "-b", "main"], { stdio: "ignore" });
    execFileSync("git", ["-C", repository, "config", "user.name", "Installer Test"], { stdio: "ignore" });
    execFileSync("git", ["-C", repository, "config", "user.email", "installer@example.com"], { stdio: "ignore" });
    await writeFile(join(repository, ".gitignore"), ".env\noutputs/\n", "utf8");
    await writeFile(join(repository, "SKILL.md"), "clean\n", "utf8");
    execFileSync("git", ["-C", repository, "add", "."], { stdio: "ignore" });
    execFileSync("git", ["-C", repository, "commit", "-m", "initial"], { stdio: "ignore" });
    execFileSync("git", ["-C", repository, "remote", "add", "origin", remote], { stdio: "ignore" });
    execFileSync("git", ["-C", repository, "push", "-u", "origin", "main"], { stdio: "ignore" });

    assert.equal(hasLocalChanges(repository), false);

    await writeFile(join(repository, ".env"), "HIAPI_API_KEY=local\n", "utf8");
    assert.equal(hasLocalChanges(repository), true);
    await rm(join(repository, ".env"));

    await mkdir(join(repository, "outputs"));
    await writeFile(join(repository, "outputs", "result.mp4"), "local output", "utf8");
    assert.equal(hasLocalChanges(repository), true);
    await rm(join(repository, "outputs"), { recursive: true });

    execFileSync("git", ["-C", repository, "switch", "-c", "local-work"], { stdio: "ignore" });
    await writeFile(join(repository, "SKILL.md"), "local branch commit\n", "utf8");
    execFileSync("git", ["-C", repository, "add", "SKILL.md"], { stdio: "ignore" });
    execFileSync("git", ["-C", repository, "commit", "-m", "local"], { stdio: "ignore" });
    execFileSync("git", ["-C", repository, "switch", "main"], { stdio: "ignore" });
    assert.equal(hasLocalChanges(repository), true);

    execFileSync("git", ["-C", repository, "branch", "-D", "local-work"], { stdio: "ignore" });
    assert.equal(hasLocalChanges(repository), false);

    await writeFile(join(repository, "SKILL.md"), "stashed work\n", "utf8");
    execFileSync("git", ["-C", repository, "stash", "push", "-m", "local"], { stdio: "ignore" });
    assert.equal(hasLocalChanges(repository), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
