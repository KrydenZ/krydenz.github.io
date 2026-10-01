import { access, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { imageSize } from "image-size";
import { parse } from "parse5";

const DEFAULT_SITE_DIR = "_site";
const PRIVATE_DRAFT_DIRECTORY = "作業中";

const assertPrivateDraftsExcluded = async (siteDirectory) => {
  try {
    await access(path.join(siteDirectory, PRIVATE_DRAFT_DIRECTORY));
  } catch (error) {
    if (error.code === "ENOENT") {
      return;
    }
    throw error;
  }
  throw new Error(`${PRIVATE_DRAFT_DIRECTORY} must not be present in the generated site`);
};

const walkHtmlFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return walkHtmlFiles(entryPath);
      }
      return entry.isFile() && entry.name.endsWith(".html") ? [entryPath] : [];
    })
  );
  return files.flat();
};

const hasClass = (node, className) => {
  const classAttribute = node.attrs?.find((attribute) => attribute.name === "class");
  return classAttribute?.value.split(/\s+/).includes(className) ?? false;
};

const findPostContent = (node) => {
  if (node.tagName === "div" && hasClass(node, "post-content")) {
    return node;
  }
  for (const child of node.childNodes ?? []) {
    const match = findPostContent(child);
    if (match) {
      return match;
    }
  }
  return null;
};

const collectImages = (node, images = []) => {
  if (node.tagName === "img") {
    images.push(node);
  }
  for (const child of node.childNodes ?? []) {
    collectImages(child, images);
  }
  return images;
};

const getAttribute = (node, name) =>
  node.attrs?.find((attribute) => attribute.name === name)?.value;

const hasAttribute = (node, name) =>
  node.attrs?.some((attribute) => attribute.name === name) ?? false;

const parsePositiveInteger = (value) => {
  if (!/^\d+$/.test(value ?? "")) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return parsed > 0 ? parsed : null;
};

const resolveLocalImage = (siteDirectory, htmlFile, source) => {
  if (!source || source.startsWith("//")) {
    return null;
  }

  let url;
  try {
    const relativeHtmlFile = path.relative(siteDirectory, htmlFile).split(path.sep).join("/");
    url = new URL(source, new URL(relativeHtmlFile, "https://local.invalid/"));
  } catch {
    return null;
  }

  if (url.origin !== "https://local.invalid") {
    return null;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  const candidate = path.resolve(siteDirectory, `.${pathname}`);
  const relative = path.relative(siteDirectory, candidate);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Local image escapes the site directory: ${source}`);
  }
  return candidate;
};

const displayedDimensions = ({ width, height, orientation }) => {
  if (!width || !height) {
    throw new Error("Image does not expose usable dimensions");
  }
  return orientation >= 5 && orientation <= 8
    ? { width: height, height: width }
    : { width, height };
};

const missingDimensionAttributes = async (node, imagePath) => {
  const hasWidth = hasAttribute(node, "width");
  const hasHeight = hasAttribute(node, "height");
  if (hasWidth && hasHeight) {
    return [];
  }

  const intrinsic = displayedDimensions(imageSize(await readFile(imagePath)));
  const manualWidth = parsePositiveInteger(getAttribute(node, "width"));
  const manualHeight = parsePositiveInteger(getAttribute(node, "height"));

  if (hasWidth && manualWidth === null) {
    return [];
  }
  if (hasHeight && manualHeight === null) {
    return [];
  }

  if (!hasWidth && manualHeight !== null) {
    return [
      ["width", Math.max(1, Math.round((manualHeight * intrinsic.width) / intrinsic.height))],
    ];
  }
  if (!hasHeight && manualWidth !== null) {
    return [
      ["height", Math.max(1, Math.round((manualWidth * intrinsic.height) / intrinsic.width))],
    ];
  }

  return [
    ["width", intrinsic.width],
    ["height", intrinsic.height],
  ];
};

const insertionOffset = (html, node) => {
  const endOffset = node.sourceCodeLocation?.startTag?.endOffset;
  if (endOffset === undefined) {
    throw new Error("Image tag has no source location");
  }
  return html[endOffset - 2] === "/" ? endOffset - 2 : endOffset - 1;
};

export const processHtml = async (html, htmlFile, siteDirectory) => {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const postContent = findPostContent(document);
  if (!postContent) {
    return { html, images: 0, changed: false };
  }

  const images = collectImages(postContent);
  const patches = [];

  for (const [index, image] of images.entries()) {
    const attributes = [];
    const source = getAttribute(image, "src");
    const localImage = resolveLocalImage(siteDirectory, htmlFile, source);

    if (localImage) {
      try {
        attributes.push(...(await missingDimensionAttributes(image, localImage)));
      } catch (error) {
        throw new Error(`${path.relative(siteDirectory, htmlFile)}: ${source}: ${error.message}`);
      }
    }

    if (index > 0 && !hasAttribute(image, "loading")) {
      attributes.push(["loading", "lazy"]);
    }

    if (attributes.length > 0) {
      patches.push({
        offset: insertionOffset(html, image),
        text: attributes.map(([name, value]) => ` ${name}="${value}"`).join(""),
      });
    }
  }

  let output = html;
  for (const patch of patches.sort((left, right) => right.offset - left.offset)) {
    output = `${output.slice(0, patch.offset)}${patch.text}${output.slice(patch.offset)}`;
  }

  return { html: output, images: images.length, changed: patches.length > 0 };
};

export const processSite = async (siteDirectory = DEFAULT_SITE_DIR) => {
  const absoluteSiteDirectory = path.resolve(siteDirectory);
  await assertPrivateDraftsExcluded(absoluteSiteDirectory);
  const htmlFiles = await walkHtmlFiles(absoluteSiteDirectory);
  let processedPages = 0;
  let processedImages = 0;

  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, "utf8");
    const result = await processHtml(html, htmlFile, absoluteSiteDirectory);
    if (result.images > 0) {
      processedPages += 1;
      processedImages += result.images;
    }
    if (result.changed) {
      await writeFile(htmlFile, result.html, "utf8");
    }
  }

  return { processedPages, processedImages };
};

const isCommandLine = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCommandLine) {
  processSite(process.argv[2] ?? DEFAULT_SITE_DIR)
    .then(({ processedPages, processedImages }) => {
      console.log(`Enhanced ${processedImages} post images across ${processedPages} pages.`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
