const mongoose = require('mongoose');

// Texts the admin writes in the dashboard settings: the privacy policy and
// the terms of use. One document per kind; editing replaces the content.
const LEGAL_DOCUMENT_KEYS = Object.freeze(['privacy', 'terms']);
const LEGAL_DOCUMENT_MAX_LENGTH = 50000;

const legalDocumentSchema = new mongoose.Schema({
  key: {
    type: String,
    enum: LEGAL_DOCUMENT_KEYS,
    required: true,
    unique: true,
  },
  content: {
    type: String,
    default: '',
    maxlength: LEGAL_DOCUMENT_MAX_LENGTH,
  },
  updatedAt: {
    type: Date,
    default: null,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
});

const LegalDocument = mongoose.model('LegalDocument', legalDocumentSchema);

module.exports = LegalDocument;
module.exports.LEGAL_DOCUMENT_KEYS = LEGAL_DOCUMENT_KEYS;
module.exports.LEGAL_DOCUMENT_MAX_LENGTH = LEGAL_DOCUMENT_MAX_LENGTH;
