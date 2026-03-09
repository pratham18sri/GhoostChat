/**
 * End-to-end encryption for GHOSTCHAT.
 *
 * Algorithm: AES-GCM 256-bit
 * Key derivation: PBKDF2-SHA256 from the room code.
 *
 * The server never sees plaintext — it relays ciphertext only.
 * All crypto operations happen in the browser via Web Crypto API.
 */

const PBKDF2_ITERATIONS = 200_000;
const KEY_USAGE         = ['encrypt', 'decrypt'];

// ─── Key derivation ───────────────────────────────────────────────────────────

/**
 * Derive an AES-GCM 256-bit key from the room code + a random salt.
 * The salt is generated once per session join and exchanged in the metadata.
 *
 * @param {string} roomCode
 * @param {Uint8Array} salt  - 16-byte random salt
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(roomCode, salt) {
  const enc      = new TextEncoder();
  const keyMat   = await crypto.subtle.importKey(
    'raw',
    enc.encode(roomCode.toUpperCase()),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name:       'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash:       'SHA-256',
    },
    keyMat,
    { name: 'AES-GCM', length: 256 },
    false,
    KEY_USAGE,
  );
}

// ─── Encryption ───────────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext message.
 *
 * @param {string}     plaintext
 * @param {CryptoKey}  key
 * @returns {Promise<{ cipherB64: string, ivB64: string }>}
 */
export async function encryptMessage(plaintext, key) {
  const iv      = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const enc     = new TextEncoder();
  const encoded = enc.encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );

  return {
    cipherB64: bufToB64(cipherBuffer),
    ivB64:     bufToB64(iv),
  };
}

// ─── Decryption ───────────────────────────────────────────────────────────────

/**
 * Decrypt a ciphertext received from the server.
 *
 * @param {string}    cipherB64
 * @param {string}    ivB64
 * @param {CryptoKey} key
 * @returns {Promise<string>}
 */
export async function decryptMessage(cipherB64, ivB64, key) {
  const cipherBuf  = b64ToBuf(cipherB64);
  const iv         = b64ToBuf(ivB64);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherBuf,
  );

  return new TextDecoder().decode(plainBuffer);
}

// ─── Salt helpers ─────────────────────────────────────────────────────────────

export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

export function saltToB64(salt) {
  return bufToB64(salt);
}

export function b64ToSalt(b64) {
  return b64ToBuf(b64);
}

// ─── Base64 codec ─────────────────────────────────────────────────────────────

function bufToB64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return btoa(String.fromCharCode(...bytes));
}

function b64ToBuf(b64) {
  const binaryStr = atob(b64);
  const bytes     = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

// ─── Feature detection ────────────────────────────────────────────────────────

export function isEncryptionSupported() {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.getRandomValues !== 'undefined'
  );
}
