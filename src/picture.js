// -----------------------------------------------------------------------------
// The image Gladys attaches to a message (a camera snapshot), as the data URL
// Pushsafer expects in its `p` field ("data:image/jpeg;base64,…").
//
// Gladys writes "image/jpg;base64,…" for its camera images, other senders a
// full data URL or raw base64: the type is checked against the first bytes.
// Pushsafer accepts 8 MB for the whole request; an image above MAX_BYTES is
// dropped and the text goes alone.
// -----------------------------------------------------------------------------

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * @description The type of an image from its first bytes.
 * @param {Buffer} bytes - The image.
 * @returns {string|null} 'image/png', 'image/jpeg', 'image/gif' or null.
 */
function sniff(bytes) {
  if (bytes.length >= 8 && bytes.readUInt32BE(0) === 0x89504e47) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 6 && bytes.toString('ascii', 0, 4) === 'GIF8') {
    return 'image/gif';
  }
  return null;
}

/**
 * @description The data URL of an attached image.
 * @param {any} file - `message.file` as Gladys hands it.
 * @returns {{ dataUrl: string|null, reason: string|null }} The data URL, or why there is none
 *   (`null` reason: no file at all; 'not_an_image', 'too_large').
 * @example
 * pictureOf('image/jpg;base64,/9j/4AAQ').dataUrl; // -> 'data:image/jpeg;base64,/9j/4AAQ'
 */
function pictureOf(file) {
  if (typeof file !== 'string' || file.trim() === '') {
    return { dataUrl: null, reason: null };
  }
  const match = /^(?:data:)?[\w.+-]+\/[\w.+-]+;base64,/.exec(file.trim());
  const payload = (match ? file.trim().slice(match[0].length) : file.trim()).replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) {
    return { dataUrl: null, reason: 'not_an_image' };
  }
  const bytes = Buffer.from(payload, 'base64');
  if (bytes.length > MAX_BYTES) {
    return { dataUrl: null, reason: 'too_large' };
  }
  const type = sniff(bytes);
  if (!type) {
    return { dataUrl: null, reason: 'not_an_image' };
  }
  return { dataUrl: `data:${type};base64,${bytes.toString('base64')}`, reason: null };
}

export { pictureOf, MAX_BYTES };
