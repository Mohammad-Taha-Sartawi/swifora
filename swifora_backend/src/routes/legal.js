// Privacy policy and terms of use, as written in the dashboard settings,
// for everyone: the apps (also before signing in) and the public web pages
// /privacy and /terms (the address app stores ask for). Read-only.
const { sendInternalServerError } = require('../security/errorResponse');
const express = require('express');
const LegalDocument = require('../models/LegalDocument');
const { DEFAULT_LEGAL_TEXT } = require('../services/legalDefaults');

const { LEGAL_DOCUMENT_KEYS } = LegalDocument;

const LEGAL_TITLES = Object.freeze({
  privacy: 'سياسة الخصوصية',
  terms: 'شروط الاستخدام',
});

// A public page: no scripts, its own stylesheet only.
const LEGAL_PAGE_CSP = [
  "default-src 'none'",
  "style-src 'self'",
  "img-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

async function loadLegalDocument(key) {
  const doc = await LegalDocument.findOne({ key }).select('content updatedAt').lean();
  // Nothing saved in the dashboard yet: the text that shipped with the app.
  return {
    key,
    title: LEGAL_TITLES[key],
    content: doc ? doc.content || '' : DEFAULT_LEGAL_TEXT[key],
    updatedAt: doc?.updatedAt || null,
    isDefault: !doc,
  };
}

const router = express.Router();

router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!LEGAL_DOCUMENT_KEYS.includes(key)) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.set('Cache-Control', 'no-cache');
    return res.json(await loadLegalDocument(key));
  } catch (err) {
    return sendInternalServerError(res);
  }
});

/** Handler for GET /privacy and GET /terms. */
function legalPage(key) {
  return async (req, res) => {
    try {
      const doc = await loadLegalDocument(key);
      const updated = doc.updatedAt ? new Date(doc.updatedAt) : null;
      const pad = (n) => String(n).padStart(2, '0');
      res.set('Content-Security-Policy', LEGAL_PAGE_CSP);
      res.set('Cache-Control', 'no-cache');
      return res.render('legal', {
        title: doc.title,
        // Paragraphs as written; EJS escapes the text.
        paragraphs: doc.content.split(/\n{2,}/).map((p) => p.split('\n')),
        updatedLabel: updated
          ? `${pad(updated.getUTCDate())}/${pad(updated.getUTCMonth() + 1)}/${updated.getUTCFullYear()}`
          : '',
      });
    } catch (err) {
      return res.status(500).type('text/plain; charset=utf-8').send('حدث خطأ. حاول لاحقاً.');
    }
  };
}

module.exports = router;
module.exports.legalPage = legalPage;
module.exports.LEGAL_PAGE_CSP = LEGAL_PAGE_CSP;
