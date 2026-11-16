// Static files of the dashboard (CSS, JS, icons, manifest).
//
// The pages link CSS/JS as `/css/style.css?v=<assetVersion>`, where the
// version is a hash of the files' contents. A versioned request can be
// cached by the browser for a year (a new deploy changes the version, so the
// new file is fetched); an unversioned one must be revalidated each time.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VERSIONED_FILES = ['css/style.css', 'js/main.js'];
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
const ONE_DAY_SECONDS = 24 * 60 * 60;

function computeAssetVersion(publicRoot) {
  const hash = crypto.createHash('sha256');
  for (const file of VERSIONED_FILES) {
    try {
      hash.update(fs.readFileSync(path.join(publicRoot, file)));
    } catch (_) {
      hash.update(file);
    }
  }
  return hash.digest('hex').slice(0, 12);
}

/** `setHeaders` for express.static. */
function staticCacheHeaders(res, filePath) {
  const versioned = Boolean(res.req?.query?.v);
  const ext = path.extname(filePath).toLowerCase();
  if (versioned) {
    res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR_SECONDS}, immutable`);
  } else if (['.png', '.svg', '.ico', '.webmanifest'].includes(ext)) {
    res.setHeader('Cache-Control', `public, max-age=${ONE_DAY_SECONDS}`);
  } else {
    // Unversioned CSS/JS/data: always check for a newer copy (cheap with ETag).
    res.setHeader('Cache-Control', 'no-cache');
  }
  if (ext === '.webmanifest') {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  }
}

module.exports = {
  computeAssetVersion,
  staticCacheHeaders,
};
