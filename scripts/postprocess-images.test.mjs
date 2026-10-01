import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { processSite } from "./postprocess-images.mjs";

const twoByOnePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

const withFixture = async (callback) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "post-images-"));
  try {
    await mkdir(path.join(directory, "posts", "sample"), { recursive: true });
    await mkdir(path.join(directory, "img"), { recursive: true });
    await writeFile(path.join(directory, "img", "local.png"), twoByOnePng);
    await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

test("enhances only post content and preserves manual loading", async () => {
  await withFixture(async (directory) => {
    const htmlFile = path.join(directory, "posts", "sample", "index.html");
    await writeFile(
      htmlFile,
      [
        '<header><img src="/img/local.png"></header>',
        '<div class="post-content">',
        '  <img src="/img/local.png" alt="first">',
        '  <img src="/img/local.png" width="10" loading="eager" alt="second">',
        '  <img src="https://example.com/external.jpg" alt="third">',
        '</div>',
        '<aside><img src="/img/local.png"></aside>',
      ].join("\n"),
      "utf8"
    );

    const result = await processSite(directory);
    const output = await readFile(htmlFile, "utf8");

    assert.deepEqual(result, { processedPages: 1, processedImages: 3 });
    assert.match(output, /alt="first" width="2" height="1">/);
    assert.match(output, /width="10" loading="eager" alt="second" height="5">/);
    assert.match(output, /external\.jpg" alt="third" loading="lazy">/);
    assert.equal(output.match(/<header><img src="\/img\/local\.png"><\/header>/)?.length, 1);
    assert.equal(output.match(/<aside><img src="\/img\/local\.png"><\/aside>/)?.length, 1);
  });
});

test("counts an external first image without guessing its dimensions", async () => {
  await withFixture(async (directory) => {
    const htmlFile = path.join(directory, "index.html");
    await writeFile(
      htmlFile,
      '<div class="post-content"><img src="//cdn.example/a.jpg"><img src="/img/local.png"></div>',
      "utf8"
    );

    await processSite(directory);
    const output = await readFile(htmlFile, "utf8");

    assert.equal(output, '<div class="post-content"><img src="//cdn.example/a.jpg"><img src="/img/local.png" width="2" height="1" loading="lazy"></div>');
  });
});

test("resolves local images relative to the generated page", async () => {
  await withFixture(async (directory) => {
    const htmlFile = path.join(directory, "posts", "sample", "index.html");
    await writeFile(
      htmlFile,
      '<div class="post-content"><img src="../../img/local.png?version=1#preview"></div>',
      "utf8"
    );

    await processSite(directory);
    const output = await readFile(htmlFile, "utf8");

    assert.equal(output, '<div class="post-content"><img src="../../img/local.png?version=1#preview" width="2" height="1"></div>');
  });
});

test("preserves a manual loading value on the first image", async () => {
  await withFixture(async (directory) => {
    const htmlFile = path.join(directory, "index.html");
    await writeFile(
      htmlFile,
      '<div class="post-content"><img src="/img/local.png" loading="lazy"></div>',
      "utf8"
    );

    await processSite(directory);
    const output = await readFile(htmlFile, "utf8");

    assert.equal(output, '<div class="post-content"><img src="/img/local.png" loading="lazy" width="2" height="1"></div>');
  });
});

test("fails when a local image cannot be read", async () => {
  await withFixture(async (directory) => {
    const htmlFile = path.join(directory, "index.html");
    await writeFile(
      htmlFile,
      '<div class="post-content"><img src="/img/missing.png"></div>',
      "utf8"
    );

    await assert.rejects(
      processSite(directory),
      /index\.html: \/img\/missing\.png:/
    );
  });
});

test("is idempotent", async () => {
  await withFixture(async (directory) => {
    const htmlFile = path.join(directory, "index.html");
    await writeFile(
      htmlFile,
      '<div class="post-content"><img src="/img/local.png"><img src="/img/local.png"></div>',
      "utf8"
    );

    await processSite(directory);
    const first = await readFile(htmlFile, "utf8");
    await processSite(directory);
    const second = await readFile(htmlFile, "utf8");

    assert.equal(second, first);
  });
});

test("fails when private drafts appear in the generated site", async () => {
  await withFixture(async (directory) => {
    await mkdir(path.join(directory, "作業中"));
    await assert.rejects(
      processSite(directory),
      /作業中 must not be present in the generated site/
    );
  });
});
