// --- Encryption & Utility Functions ---

// Convert string to Uint8Array
export function strToUint8(str) {
    return new TextEncoder().encode(str);
  }
  
  // Convert Uint8Array to string
  export function uint8ToStr(buf) {
    return new TextDecoder().decode(buf);
  }
  
  // Encode ArrayBuffer to base64
  export function bufToBase64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }
  
  // Decode base64 to ArrayBuffer
  export function base64ToBuf(str) {
    const binary = atob(str);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buf[i] = binary.charCodeAt(i);
    }
    return buf.buffer;
  }
  
  // Holds the derived crypto key
  let cryptoKey = null;
  
  // Initialize persistent AES-GCM crypto key
  export async function initCryptoKey() {
    if (cryptoKey) return cryptoKey;
  
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['cryptoSalt'], async (result) => {
        let salt;
  
        // Use stored salt if available, otherwise generate new
        if (result.cryptoSalt) {
          salt = base64ToBuf(result.cryptoSalt);
        } else {
          salt = crypto.getRandomValues(new Uint8Array(16));
          chrome.storage.local.set({ cryptoSalt: bufToBase64(salt) });
        }
  
        // Derive key from static passphrase and salt
        const baseKey = await crypto.subtle.importKey(
          'raw',
          strToUint8('web-ai-secret'),
          'PBKDF2',
          false,
          ['deriveKey']
        );
  
        cryptoKey = await crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt,
            iterations: 100000,
            hash: 'SHA-256'
          },
          baseKey,
          {
            name: 'AES-GCM',
            length: 256
          },
          false,
          ['encrypt', 'decrypt']
        );
  
        resolve(cryptoKey);
      });
    });
  }
  
  // Encrypt text with AES-GCM and return iv + cipher
  export async function encryptText(text) {
    const key = await initCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      strToUint8(text)
    );
    return {
      iv: bufToBase64(iv),
      cipher: bufToBase64(encrypted),
    };
  }
  
  // Decrypt AES-GCM ciphertext using iv
  export async function decryptText(cipher, iv) {
    const key = await initCryptoKey();
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBuf(iv) },
      key,
      base64ToBuf(cipher)
    );
    return uint8ToStr(plain);
  }
  