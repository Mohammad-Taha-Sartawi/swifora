function boundedTrimmedString(value, maxLength) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();

  if (!trimmed || trimmed.length > maxLength) {
    return null;
  }

  return trimmed;
}

function optionalBoundedTrimmedString(value, maxLength) {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    return null;
  }

  return trimmed;
}

function boundedFiniteNumber(value, { min, max }) {
  const number =
    typeof value === 'number'
      ? value
      : (
        typeof value === 'string'
        && value.trim() !== ''
          ? Number(value)
          : NaN
      );

  if (
    !Number.isFinite(number)
    || number < min
    || number > max
  ) {
    return null;
  }

  return number;
}

const MAX_PERSON_NAME = 80;
const PERSON_NAME_MESSAGE = 'اكتب الاسم الكامل (من حرفين إلى 80 حرفاً).';

/**
 * A person's name as text: repeated spaces and line breaks collapse to one
 * space; 2–80 characters. Anything else (a number, an object, empty or a
 * very long text) gives null.
 */
function personName(value) {
  if (typeof value !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const name = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return name.length >= 2 && name.length <= MAX_PERSON_NAME ? name : null;
}

/**
 * The response for a request the client got wrong before any route ran
 * (body-parser: invalid JSON, a bare number or text, too large, bad
 * charset), or null when [err] is a real server error.
 */
function clientRequestError(err) {
  if (
    !err
    || err.expose !== true
    || !Number.isInteger(err.status)
    || err.status < 400
    || err.status >= 500
  ) {
    return null;
  }
  const tooLarge = err.type === 'entity.too.large';
  return {
    status: err.status,
    body: {
      error: tooLarge
        ? 'Request body is too large'
        : 'Request body must be a JSON object',
      code: tooLarge ? 'BODY_TOO_LARGE' : 'INVALID_REQUEST_BODY',
    },
  };
}

module.exports = {
  clientRequestError,
  MAX_PERSON_NAME,
  PERSON_NAME_MESSAGE,
  personName,
  boundedTrimmedString,
  optionalBoundedTrimmedString,
  boundedFiniteNumber,
};
