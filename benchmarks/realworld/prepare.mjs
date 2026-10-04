/* global process, console */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (Number(process.versions.node.split(".")[0]) < 24)
  throw new Error("Use Node 24+");
const project = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const evidence = path.join(project, "docs/metrics/reference-run");
const base = process.env.BENCH_ROOT || "/tmp/realworld-reference-benchmarks";
const builds = JSON.parse(readFileSync(path.join(evidence, "builds.json")));
const repos = {
  vue: "realworld-apps/vue-realworld-example-app",
  react: "yurisldk/realworld-react-fsd",
  angular: "realworld-apps/angular-realworld-example-app",
  svelte: "sveltejs/realworld",
};
mkdirSync(base, { recursive: true });
function run(command, args, cwd, env = {}, log) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (log)
    writeFileSync(
      path.join(base, log),
      `${result.stdout || ""}${result.stderr || ""}`,
    );
  if (result.status !== 0)
    throw new Error(
      `${command} failed in ${cwd}: ${result.stderr || result.error}. See ${log || "output"}`,
    );
  return result.stdout;
}
for (const [name, repo] of Object.entries(repos)) {
  const root = path.join(base, name);
  console.log("Preparing", name);
  if (!existsSync(root))
    run(
      "git",
      ["clone", "--depth", "1", `https://github.com/${repo}.git`, root],
      base,
    );
  if (run("git", ["rev-parse", "HEAD"], root).trim() !== builds[name].commit) {
    if (run("git", ["status", "--porcelain"], root).trim())
      throw new Error(`Refusing to change dirty checkout ${root}`);
    run("git", ["fetch", "--depth", "1", "origin", builds[name].commit], root);
    run("git", ["checkout", "--detach", builds[name].commit], root);
  }
  if (existsSync(path.join(root, ".gitmodules")))
    run("git", ["submodule", "update", "--init", "--depth", "1"], root);
  const patch = path.join(evidence, `${name}-benchmark.patch`);
  if (run("git", ["diff"], root) !== readFileSync(patch, "utf8")) {
    run("git", ["apply", "--check", patch], root);
    run("git", ["apply", patch], root);
  }
  copyFileSync(
    path.join(evidence, `${name}-package-lock.json`),
    path.join(root, "package-lock.json"),
  );
  run(
    "npm",
    [
      "ci",
      "--ignore-scripts",
      "--legacy-peer-deps",
      "--no-audit",
      "--no-fund",
      "--cache",
      path.join(base, "npm-cache"),
    ],
    root,
    {},
    `${name}-install.log`,
  );
  if (name === "react") {
    run(
      "npm",
      [
        "install",
        "--ignore-scripts",
        "--legacy-peer-deps",
        "--no-save",
        "--no-audit",
        "--no-fund",
        "ajv@8.17.1",
        "--cache",
        path.join(base, "npm-cache"),
      ],
      root,
      {},
      "react-ajv-install.log",
    );
    run(
      path.join(root, "node_modules/.bin/orval"),
      [],
      root,
      {},
      "react-generate.log",
    );
    run(
      path.join(root, "node_modules/.bin/ts-node"),
      ["convert-zod-mini.ts"],
      root,
      {},
      "react-convert.log",
    );
  }
  run(
    "npm",
    ["run", name === "react" ? "build:prod" : "build"],
    root,
    {
      VITE_API_URL: "http://127.0.0.1:5280/api",
      API_URL: "http://127.0.0.1:5280/api",
      NG_CLI_ANALYTICS: "false",
    },
    `${name}-build.log`,
  );
}
console.log("Prepared references:", base);
