/* global process, console, setTimeout, clearTimeout, URL, requestAnimationFrame, window, document, performance, MutationObserver */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import os from "node:os";

const out = process.env.BENCH_OUT || "docs/metrics/reference-run";
await mkdir(out, { recursive: true });
const apps = {
  vue: 5281,
  react: 5282,
  angular: 5283,
  svelte: 5284,
  marionette: 5285,
};
const selected = (process.env.BENCH_APPS || "vue,react,angular,svelte").split(
  ",",
);
if (selected.some((name) => !apps[name]))
  throw new Error("Unknown BENCH_APPS entry");
const browser = await chromium.launch();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const metric = (result, name) =>
  result.metrics.find((m) => m.name === name)?.value;
const summary = (values) => {
  const a = [...values].sort((x, y) => x - y);
  return {
    median:
      (a[Math.floor((a.length - 1) / 2)] + a[Math.ceil((a.length - 1) / 2)]) /
      2,
    min: a[0],
    max: a.at(-1),
    samples: a.length,
  };
};
const feed =
  "document.querySelectorAll('.article-preview .preview-link').length === 20 && document.querySelector('.sidebar .tag-list')?.textContent.includes('testing')";
const detail =
  "document.querySelector('.article-page .article-content')?.textContent.includes('predictable application ownership') && [...document.querySelectorAll('.card-text')].some(e => e.textContent.includes('Benchmark comment 10'))";

async function ready(page, expression) {
  await page.waitForFunction(expression, { polling: "raf", timeout: 20000 });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}
async function setup(name, profile) {
  const context = await browser.newContext({
    viewport:
      profile === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1440, height: 900 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const errors = [];
  const blocked = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") {
      blocked.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  if (profile === "mobile") {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 80,
      downloadThroughput: 200000,
      uploadThroughput: 93750,
    });
  }
  return {
    context,
    page,
    cdp,
    errors,
    blocked,
    url: `http://127.0.0.1:${apps[name]}`,
  };
}
async function clickReady(page, selector, expression) {
  await page.evaluate(
    ({ expression }) => {
      window.__benchTiming = new Promise((resolve) =>
        document.addEventListener(
          "click",
          () => {
            const start = performance.now();
            const check = () => {
              if (Function(`return (${expression})`)()) {
                observer.disconnect();
                requestAnimationFrame(() =>
                  requestAnimationFrame(() =>
                    resolve(performance.now() - start),
                  ),
                );
              }
            };
            const observer = new MutationObserver(check);
            observer.observe(document.body, {
              subtree: true,
              childList: true,
              characterData: true,
            });
            check();
          },
          { once: true, capture: true },
        ),
      );
    },
    { expression },
  );
  // dispatchEvent avoids hover-triggered prefetch and Playwright actionability overhead.
  await page
    .locator(selector)
    .first()
    .dispatchEvent("click", { button: 0, bubbles: true });
  let timer;
  try {
    return await Promise.race([
      page.evaluate(() => window.__benchTiming),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Click readiness timed out")),
          20000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function sample(name, profile) {
  const { context, page, cdp, errors, blocked, url } = await setup(
    name,
    profile,
  );
  const resources = [];
  const pending = [];
  page.on("response", (response) => {
    if (response.request().resourceType() === "script")
      pending.push(
        response
          .body()
          .then((bytes) =>
            resources.push({
              url: response.url(),
              raw: bytes.length,
              gzip: gzipSync(bytes, { level: 9 }).length,
            }),
          )
          .catch(() => {}),
      );
  });
  try {
    const before = await cdp.send("Performance.getMetrics");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await ready(page, feed);
    const initial = await page.evaluate(() => ({
      readyMs: performance.now(),
      navigation: performance.getEntriesByType("navigation")[0].toJSON(),
      paints: performance.getEntriesByType("paint").map((p) => p.toJSON()),
      domNodes: document.querySelectorAll("*").length,
    }));
    // SSR can expose content before hydration. Settle initial modules before clicks/counts.
    await page.waitForLoadState("networkidle");
    await Promise.all(pending);
    const initialScripts = [...resources];
    const after = await cdp.send("Performance.getMetrics");
    const articleMs = await clickReady(page, ".preview-link", detail);
    const homeMs = await clickReady(page, ".navbar-brand", feed);
    await Promise.all(pending);
    return {
      ...initial,
      scriptCpuMs:
        1000 *
        (metric(after, "ScriptDuration") - metric(before, "ScriptDuration")),
      taskCpuMs:
        1000 * (metric(after, "TaskDuration") - metric(before, "TaskDuration")),
      articleMs,
      homeMs,
      initialScripts,
      journeyScripts: resources,
      errors,
      blocked: [...new Set(blocked)],
    };
  } finally {
    await context.close();
  }
}
async function memory(name) {
  const { context, page, cdp, errors, url } = await setup(name, "desktop");
  async function gcSample(cycles) {
    await cdp.send("HeapProfiler.collectGarbage");
    await sleep(50);
    await cdp.send("HeapProfiler.collectGarbage");
    const heap = await cdp.send("Runtime.getHeapUsage");
    const dom = await cdp.send("Memory.getDOMCounters");
    return {
      cycles,
      ...heap,
      ...dom,
      liveElements: await page.locator("*").count(),
    };
  }
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await ready(page, feed);
    for (let i = 0; i < 10; i++) {
      await clickReady(page, ".preview-link", detail);
      await clickReady(page, ".navbar-brand", feed);
    }
    const samples = [await gcSample(0)];
    for (let i = 1; i <= 100; i++) {
      await clickReady(page, ".preview-link", detail);
      await clickReady(page, ".navbar-brand", feed);
      if (i % 25 === 0) samples.push(await gcSample(i));
    }
    return {
      samples,
      heapGrowthBytes: samples.at(-1).usedSize - samples[0].usedSize,
      nodeGrowth: samples.at(-1).nodes - samples[0].nodes,
      listenerGrowth:
        samples.at(-1).jsEventListeners - samples[0].jsEventListeners,
      errors,
    };
  } finally {
    await context.close();
  }
}
const result = {
  date: new Date().toISOString(),
  browser: browser.version(),
  node: process.version,
  machine: {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus()[0].model,
    memoryBytes: os.totalmem(),
  },
  apps: {},
};
try {
  for (const name of selected) {
    const entry = (result.apps[name] = {});
    for (const profile of ["desktop", "mobile"]) {
      console.log(`${name}: ${profile}`);
      const warmups = [];
      const samples = [];
      try {
        for (let i = 0; i < 12; i++) {
          const value = await sample(name, profile);
          (i < 2 ? warmups : samples).push(value);
        }
        entry[profile] = {
          warmups,
          samples,
          summary: Object.fromEntries(
            ["readyMs", "scriptCpuMs", "taskCpuMs", "articleMs", "homeMs"].map(
              (key) => [key, summary(samples.map((s) => s[key]))],
            ),
          ),
          initialJsGzipBytes: summary(
            samples.map((s) =>
              s.initialScripts.reduce((n, r) => n + r.gzip, 0),
            ),
          ),
          initialJsRawBytes: summary(
            samples.map((s) => s.initialScripts.reduce((n, r) => n + r.raw, 0)),
          ),
        };
      } catch (error) {
        entry[profile] = { error: String(error), warmups, samples };
        console.error(name, profile, error);
      }
      await writeFile(`${out}/results.json`, JSON.stringify(result, null, 2));
    }
    console.log(`${name}: memory`);
    entry.memory = [];
    for (let i = 0; i < 3; i++) {
      try {
        entry.memory.push(await memory(name));
      } catch (error) {
        entry.memory.push({ error: String(error) });
      }
    }
    await writeFile(`${out}/results.json`, JSON.stringify(result, null, 2));
  }
} finally {
  await browser.close();
}
console.log("Results:", `${out}/results.json`);
