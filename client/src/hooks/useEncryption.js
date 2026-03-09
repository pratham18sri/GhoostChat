/**
 * useEncryption — manages the AES-GCM key derived from the room code.
 * The key is derived once on room join and cached for the session.
 */

import { useState, useCallback, useRef } from 'react';
import {
  deriveKey,
  encryptMessage,
  decryptMessage,
  generateSalt,
  saltToB64,
  b64ToSalt,
  isEncryptionSupported,
} from '../utils/encryption';

export function useEncryption() {
  const [keyReady,   setKeyReady]   = useState(false);
  const [e2eEnabled, setE2eEnabled] = useState(false);
  const keyRef  = useRef(null);
  const saltB64 = useRef(null);

  // ── Initialise key from room code ─────────────────────────────────────────
  const initKey = useCallback(async (roomCode) => {
    if (!isEncryptionSupported()) {
      console.warn('[E2E] Web Crypto API not available — encryption disabled.');
      return false;
    }

    try {
      const salt      = generateSalt();
      saltB64.current = saltToB64(salt);
      keyRef.current  = await deriveKey(roomCode, salt);
      setKeyReady(true);
      setE2eEnabled(true);
      return true;
    } catch (err) {
      console.error('[E2E] Key derivation failed:', err);
      return false;
    }
  }, []);

  // ── Re-derive key using a remote sender's salt ────────────────────────────
  // (not used in shared-secret model, but useful for future PKI upgrade)
  const deriveSharedKey = useCallback(async (roomCode, incomingSaltB64) => {
    try {
      const salt = b64ToSalt(incomingSaltB64);
      return await deriveKey(roomCode, salt);
    } catch {
      return null;
    }
  }, []);

  // ── Encrypt a plaintext message ───────────────────────────────────────────
  const encrypt = useCallback(async (plaintext) => {
    if (!keyRef.current) return null;
    try {
      const { cipherB64, ivB64 } = await encryptMessage(plaintext, keyRef.current);
      return {
        content:   cipherB64,
        iv:        ivB64,
        salt:      saltB64.current,
        encrypted: true,
      };
    } catch (err) {
      console.error('[E2E] Encryption failed:', err);
      return null;
    }
  }, []);

  // ── Decrypt an incoming ciphertext ────────────────────────────────────────
  const decrypt = useCallback(async (cipherB64, ivB64, roomCode, incomingSaltB64) => {
    try {
      // Derive peer's key using the sender's salt
      const peerKey = await deriveSharedKey(roomCode, incomingSaltB64);
      if (!peerKey) return '[Unable to decrypt]';
      return await decryptMessage(cipherB64, ivB64, peerKey);
    } catch (err) {
      return '[Decryption failed]';
    }
  }, [deriveSharedKey]);

  const clearKey = useCallback(() => {
    keyRef.current  = null;
    saltB64.current = null;
    setKeyReady(false);
    setE2eEnabled(false);
  }, []);

  return {
    e2eEnabled,
    keyReady,
    initKey,
    encrypt,
    decrypt,
    clearKey,
    isSupported: isEncryptionSupported(),
  };
}
