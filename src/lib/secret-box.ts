import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Cifra segredos que precisam voltar em texto claro no servidor — hoje, o token
 * da UAZAPI de cada gestor.
 *
 * Não é hash: o token tem que ser usado para chamar a API, então precisa ser
 * reversível. O que isto compra é que um dump do banco não entrega os tokens.
 *
 * A chave sai do SESSION_SECRET por scrypt, com um "info" próprio para não ser
 * literalmente a mesma chave da sessão. Assim nada precisa ser configurado na
 * Vercel para a feature funcionar — uma variável nova esquecida viraria erro em
 * produção justo na hora de disparar. TOKEN_ENCRYPTION_KEY existe para quem
 * quiser separar as duas chaves de verdade.
 */

const SCRYPT_INFO = "f3f-uazapi-token-v1";

function encryptionKey(): Buffer {
  const material = (process.env.TOKEN_ENCRYPTION_KEY || process.env.SESSION_SECRET || "").trim();
  if (material.length < 32) {
    throw new Error("SESSION_SECRET (ou TOKEN_ENCRYPTION_KEY) precisa ter ao menos 32 caracteres.");
  }
  return scryptSync(material, SCRYPT_INFO, 32);
}

export function sealSecret(plain: string): string {
  const value = plain.trim();
  if (!value) throw new Error("Segredo vazio.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

/**
 * Devolve null em vez de lançar: um token corrompido ou cifrado com outra chave
 * não pode derrubar a tela inteira de equipe. Quem chama trata como "sem token".
 */
export function openSecret(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const payload = Buffer.from(parts[3], "base64url");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Comparação em tempo constante, para conferências que envolvam segredo. */
export function secretsMatch(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
