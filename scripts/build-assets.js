const fs = require('fs/promises');
const path = require('path');
const less = require('less');
const { transform } = require('lightningcss');
const terser = require('terser');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const assetName = 'hux-blog';

const files = {
    less: path.join(root, 'less', `${assetName}.less`),
    css: path.join(root, 'css', `${assetName}.css`),
    cssMin: path.join(root, 'css', `${assetName}.min.css`),
    js: path.join(root, 'js', `${assetName}.js`),
    jsMin: path.join(root, 'js', `${assetName}.min.js`),
};

const banner = [
    '/*!',
    ` * ${pkg.title} v${pkg.version} (${pkg.homepage})`,
    ` * Copyright ${new Date().getFullYear()} ${pkg.author}`,
    ' */',
    '',
].join('\n');

const lightningTargets = {
    chrome: 49 << 16,
    edge: 12 << 16,
    firefox: 45 << 16,
    safari: 9 << 16,
};

const writeText = async (file, content) => {
    await fs.writeFile(file, content.replace(/\r\n/g, '\n'), 'utf8');
};

const buildCss = async () => {
    const source = await fs.readFile(files.less, 'utf8');
    const rendered = await less.render(source, {
        filename: files.less,
        paths: [path.join(root, 'css')],
    });

    const css = `${banner}${rendered.css}`;
    await writeText(files.css, css);

    const minified = transform({
        filename: files.css,
        code: Buffer.from(rendered.css),
        minify: true,
        targets: lightningTargets,
    }).code.toString();
    await writeText(files.cssMin, `${banner}${minified}\n`);
};

const buildJs = async () => {
    const source = await fs.readFile(files.js, 'utf8');
    const minified = await terser.minify(source, {
        compress: true,
        mangle: true,
        format: {
            comments: false,
        },
    });

    if (minified.error) {
        throw minified.error;
    }

    await writeText(files.jsMin, `${banner}${minified.code}\n`);
};

Promise.all([buildCss(), buildJs()]).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
