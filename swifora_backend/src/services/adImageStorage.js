const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const AD_UPLOAD_DIR = path.join(
  __dirname,
  '..',
  '..',
  'uploads',
  'ads',
);
const MAX_AD_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AD_IMAGES = 5;

const SAFE_IMAGE_TYPES = [
  {
    mimeType: 'image/jpeg',
    extension: '.jpg',
    matches: (buffer) =>
      buffer.length >= 3
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[2] === 0xff,
  },
  {
    mimeType: 'image/png',
    extension: '.png',
    matches: (buffer) =>
      buffer.length >= 8
      && buffer[0] === 0x89
      && buffer[1] === 0x50
      && buffer[2] === 0x4e
      && buffer[3] === 0x47
      && buffer[4] === 0x0d
      && buffer[5] === 0x0a
      && buffer[6] === 0x1a
      && buffer[7] === 0x0a,
  },
  {
    mimeType: 'image/gif',
    extension: '.gif',
    matches: (buffer) => {
      if (buffer.length < 6) return false;

      const signature = buffer
        .subarray(0, 6)
        .toString('ascii');

      return signature === 'GIF87a'
        || signature === 'GIF89a';
    },
  },
  {
    mimeType: 'image/webp',
    extension: '.webp',
    matches: (buffer) =>
      buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

const SAFE_UPLOAD_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
]);

class AdImageValidationError extends Error {
  constructor(message, code = 'INVALID_AD_IMAGE') {
    super(message);
    this.name = 'AdImageValidationError';
    this.code = code;
  }
}

function ensureAdUploadDirectory() {
  fs.mkdirSync(AD_UPLOAD_DIR, {
    recursive: true,
  });
}

ensureAdUploadDirectory();

function detectSafeImageType(buffer) {
  return SAFE_IMAGE_TYPES.find(
    (type) => type.matches(buffer),
  ) || null;
}

async function readFileHeader(filePath, length = 64) {
  const handle = await fs.promises.open(filePath, 'r');

  try {
    const buffer = Buffer.alloc(length);
    const result = await handle.read(
      buffer,
      0,
      length,
      0,
    );

    return buffer.subarray(0, result.bytesRead);
  } finally {
    await handle.close();
  }
}

// The banner fills the phone width at a fixed 160-180 point height, so an
// image must be landscape with a width:height ratio between 2:1 and 2.7:1
// (for example 1200 x 540 px). Other shapes would be cropped heavily.
const MIN_AD_IMAGE_RATIO = 2.0;
const MAX_AD_IMAGE_RATIO = 2.7;
const AD_IMAGE_SHAPE_MESSAGE =
  'صورة الإعلان يجب أن تكون أفقية بعرض شاشة الجوال كاملاً وارتفاع بين 160 و180 نقطة: '
  + 'عرضها بين ضعفي ارتفاعها و2.7 ضعفه، مثل عرض 1200 بكسل وارتفاع 540 بكسل.';

/** Pixel width/height of a PNG, GIF, JPEG or WebP image, or null. */
function imageDimensions(buffer) {
  if (buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 10 && buffer.subarray(0, 3).toString('ascii') === 'GIF') {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (buffer.length >= 30 && buffer.subarray(0, 4).toString('ascii') === 'RIFF') {
    const chunk = buffer.subarray(12, 16).toString('ascii');
    if (chunk === 'VP8X') {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      };
    }
    if (chunk === 'VP8 ') {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunk === 'VP8L') {
      const bits = buffer.readUInt32LE(21);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
    }
    return null;
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) return null;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      const isFrame = marker >= 0xc0 && marker <= 0xcf
        && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isFrame) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }
  return null;
}

function hasBannerShape(dimensions) {
  if (!dimensions || !dimensions.width || !dimensions.height) return false;
  const ratio = dimensions.width / dimensions.height;
  return ratio >= MIN_AD_IMAGE_RATIO && ratio <= MAX_AD_IMAGE_RATIO;
}

async function finalizeAdImageFiles(files) {
  const entries = Array.isArray(files) ? files : [];

  try {
    for (const file of entries) {
      if (!file?.path || !file?.size) {
        throw new AdImageValidationError(
          'The uploaded image is empty.',
          'EMPTY_IMAGE',
        );
      }

      const header = await readFileHeader(file.path);
      const detected = detectSafeImageType(header);

      if (!detected) {
        throw new AdImageValidationError(
          'Only JPEG, PNG, GIF, or WebP images are allowed.',
          'UNSUPPORTED_IMAGE',
        );
      }

      const dimensions = imageDimensions(
        await readFileHeader(file.path, 256 * 1024),
      );
      if (!hasBannerShape(dimensions)) {
        throw new AdImageValidationError(
          AD_IMAGE_SHAPE_MESSAGE,
          'AD_IMAGE_SHAPE',
        );
      }

      const safeName =
        `${crypto.randomUUID()}${detected.extension}`;
      const safePath = path.join(
        AD_UPLOAD_DIR,
        safeName,
      );

      await fs.promises.rename(file.path, safePath);

      file.filename = safeName;
      file.path = safePath;
      file.destination = AD_UPLOAD_DIR;
      file.mimetype = detected.mimeType;
      file.publicUrl = `/uploads/ads/${safeName}`;
    }

    return entries;
  } catch (error) {
    await removeAdImageFiles(entries);
    throw error;
  }
}

async function removeAdImageFiles(files) {
  const entries = Array.isArray(files) ? files : [];

  await Promise.all(
    entries.map((file) =>
      deleteAdImageFile(file?.path),
    ),
  );
}

async function deleteAdImageFile(filePath) {
  if (!filePath) return;

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      // Cleanup failures must not hide the original request error.
    }
  }
}

async function deleteAdImageByUrl(imageUrl) {
  const value = String(imageUrl || '');

  if (!value.startsWith('/uploads/ads/')) {
    return;
  }

  const filename = path.basename(value);
  await deleteAdImageFile(
    path.join(AD_UPLOAD_DIR, filename),
  );
}

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    ensureAdUploadDirectory();
    callback(null, AD_UPLOAD_DIR);
  },
  filename: (req, file, callback) => {
    callback(null, `${crypto.randomUUID()}.upload`);
  },
});

const adImageUpload = multer({
  storage,
  limits: {
    fileSize: MAX_AD_IMAGE_BYTES,
    files: MAX_AD_IMAGES,
    fields: 20,
    fieldSize: 100 * 1024,
    parts: 30,
  },
  fileFilter: (req, file, callback) => {
    if (
      typeof file.mimetype === 'string'
      && file.mimetype.startsWith('image/')
    ) {
      callback(null, true);
      return;
    }

    callback(
      new AdImageValidationError(
        'Only image files are allowed.',
        'UNSUPPORTED_IMAGE',
      ),
    );
  },
}).array('images', MAX_AD_IMAGES);

function adImageUploadErrorMessage(error) {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return 'Each image must be 5MB or smaller.';
  }

  if (
    error?.code === 'LIMIT_FILE_COUNT'
    || error?.code === 'LIMIT_UNEXPECTED_FILE'
  ) {
    return `A maximum of ${MAX_AD_IMAGES} images is allowed.`;
  }

  if (error instanceof AdImageValidationError) {
    return error.message;
  }

  return 'Invalid image upload.';
}

function isSafeUploadExtension(filePath) {
  return SAFE_UPLOAD_EXTENSIONS.has(
    path.extname(String(filePath || '')).toLowerCase(),
  );
}

module.exports = {
  AD_UPLOAD_DIR,
  MAX_AD_IMAGE_BYTES,
  MAX_AD_IMAGES,
  SAFE_UPLOAD_EXTENSIONS,
  AdImageValidationError,
  adImageUpload,
  adImageUploadErrorMessage,
  finalizeAdImageFiles,
  removeAdImageFiles,
  deleteAdImageFile,
  deleteAdImageByUrl,
  detectSafeImageType,
  isSafeUploadExtension,
  imageDimensions,
  hasBannerShape,
  MIN_AD_IMAGE_RATIO,
  MAX_AD_IMAGE_RATIO,
};
