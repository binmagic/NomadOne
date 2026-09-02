/**
 * [INPUT]: 依赖 node:crypto 的 scrypt / timingSafeEqual
 * [OUTPUT]: 对外提供 hashPassword / verifyPassword
 * [POS]: lib/auth 的口令哈希，仅 Node 运行；禁止走 AES encryptSecret
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { randomBytes, scrypt, timingSafeEqual } from "crypto";

const KEYLEN = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

function deriveKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEYLEN, SCRYPT_OPTIONS, (error, derived) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derived as Buffer);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await deriveKey(password, salt);
  return {
    salt: salt.toString("hex"),
    hash: hash.toString("hex"),
  };
}

export async function verifyPassword(password: string, saltHex: string, hashHex: string) {
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = await deriveKey(password, salt);
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}
