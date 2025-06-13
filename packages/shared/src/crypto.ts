import { createCipherGCM, createDecipherGCM, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // For GCM, this is recommended to be 12 bytes, but 16 is also acceptable
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Derives a key from the encryption key using PBKDF2
 */
function deriveKey(encryptionKey: string, salt: Buffer): Buffer {
  const crypto = require("crypto");
  return crypto.pbkdf2Sync(encryptionKey, salt, 100000, KEY_LENGTH, "sha512");
}

/**
 * Encrypts a GitHub token using AES-256-GCM
 * @param token - The GitHub token to encrypt
 * @param encryptionKey - The encryption key (should be from environment variable)
 * @returns Base64 encoded encrypted data containing salt, IV, tag, and encrypted token
 */
export function encryptGitHubToken(token: string, encryptionKey: string): string {
  if (!token) {
    throw new Error("Token cannot be empty");
  }
  if (!encryptionKey) {
    throw new Error("Encryption key cannot be empty");
  }

  // Generate random salt and IV
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  
  // Derive key from encryption key and salt
  const key = deriveKey(encryptionKey, salt);
  
  // Create cipher
  const cipher = createCipherGCM(ALGORITHM, key, iv);
  
  // Encrypt the token
  let encrypted = cipher.update(token, "utf8");
  cipher.final();
  
  // Get the authentication tag
  const tag = cipher.getAuthTag();
  
  // Combine salt, IV, tag, and encrypted data
  const combined = Buffer.concat([salt, iv, tag, encrypted]);
  
  return combined.toString("base64");
}

/**
 * Decrypts a GitHub token using AES-256-GCM
 * @param encryptedToken - Base64 encoded encrypted token
 * @param encryptionKey - The encryption key (should be from environment variable)
 * @returns The decrypted GitHub token
 */
export function decryptGitHubToken(encryptedToken: string, encryptionKey: string): string {
  if (!encryptedToken) {
    throw new Error("Encrypted token cannot be empty");
  }
  if (!encryptionKey) {
    throw new Error("Encryption key cannot be empty");
  }

  try {
    // Decode from base64
    const combined = Buffer.from(encryptedToken, "base64");
    
    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    
    // Derive key from encryption key and salt
    const key = deriveKey(encryptionKey, salt);
    
    // Create decipher
    const decipher = createDecipherGCM(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    // Decrypt the token
    let decrypted = decipher.update(encrypted, undefined, "utf8");
    decipher.final();
    
    return decrypted;
  } catch (error) {
    throw new Error(`Failed to decrypt GitHub token: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Checks if a token appears to be encrypted (base64 encoded with expected length)
 * @param token - The token to check
 * @returns True if the token appears to be encrypted
 */
export function isTokenEncrypted(token: string): boolean {
  if (!token) {
    return false;
  }
  
  try {
    // Check if it's valid base64
    const decoded = Buffer.from(token, "base64");
    
    // Check if it has the minimum expected length (salt + iv + tag + some encrypted data)
    const minLength = SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1;
    return decoded.length >= minLength && token.length > 40; // GitHub tokens are typically 40+ chars, encrypted will be much longer
  } catch {
    return false;
  }
}

