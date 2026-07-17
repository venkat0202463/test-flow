import CryptoJS from 'crypto-js';

const rawKeyString = import.meta.env.VITE_ENCRYPTION_KEY;
if (!rawKeyString) {
  throw new Error("VITE_ENCRYPTION_KEY environment variable is not defined.");
}

// We use SHA-256 to derive a 256-bit key from the string
const secretKey = CryptoJS.SHA256(rawKeyString);

export const encryptPayload = async (data: any): Promise<string> => {
  if (!data) return '';
  try {
    const jsonString = JSON.stringify(data);
    
    // AES-CBC requires a 16-byte IV
    const iv = CryptoJS.lib.WordArray.random(16);
    
    const encrypted = CryptoJS.AES.encrypt(jsonString, secretKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    const ivHex = iv.toString(CryptoJS.enc.Hex);
    // encrypted.toString() natively returns the ciphertext in Base64
    const cipherText = encrypted.toString();
    
    return ivHex + ':' + cipherText;
  } catch (err) {
    console.error('Encryption failed:', err);
    return '';
  }
};

export const decryptPayload = async (encryptedString: string): Promise<any> => {
  if (!encryptedString || typeof encryptedString !== 'string') return null;
  try {
    const parts = encryptedString.split(':');
    if (parts.length !== 2) return null;
    
    const iv = CryptoJS.enc.Hex.parse(parts[0]);
    // The ciphertext is Base64
    const cipherText = parts[1];
    
    // We pass the Base64 ciphertext directly, CryptoJS knows it's Base64 because we use the cipher params
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Base64.parse(cipherText)
    });

    const decrypted = CryptoJS.AES.decrypt(cipherParams, secretKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
    if (!jsonString) return null;
    
    return JSON.parse(jsonString);
  } catch (err) {
    console.error('Decryption failed:', err);
    return null;
  }
};
