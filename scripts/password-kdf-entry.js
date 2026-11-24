// Build-time only. The generated GAS file has no imports or network dependencies.
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
export function derive(passwordHex, saltHex) {
  return bytesToHex(pbkdf2(sha256, hexToBytes(passwordHex), hexToBytes(saltHex), { c: 600000, dkLen: 32 }));
}
