// SHA-256 fallback keeps photo capture usable on local HTTP development origins.
const constants = [
  0x428a2f98,
  0x71374491,
  0xb5c0fbcf,
  0xe9b5dba5,
  0x3956c25b,
  0x59f111f1,
  0x923f82a4,
  0xab1c5ed5,
  0xd807aa98,
  0x12835b01,
  0x243185be,
  0x550c7dc3,
  0x72be5d74,
  0x80deb1fe,
  0x9bdc06a7,
  0xc19bf174,
  0xe49b69c1,
  0xefbe4786,
  0x0fc19dc6,
  0x240ca1cc,
  0x2de92c6f,
  0x4a7484aa,
  0x5cb0a9dc,
  0x76f988da,
  0x983e5152,
  0xa831c66d,
  0xb00327c8,
  0xbf597fc7,
  0xc6e00bf3,
  0xd5a79147,
  0x06ca6351,
  0x14292967,
  0x27b70a85,
  0x2e1b2138,
  0x4d2c6dfc,
  0x53380d13,
  0x650a7354,
  0x766a0abb,
  0x81c2c92e,
  0x92722c85,
  0xa2bfe8a1,
  0xa81a664b,
  0xc24b8b70,
  0xc76c51a3,
  0xd192e819,
  0xd6990624,
  0xf40e3585,
  0x106aa070,
  0x19a4c116,
  0x1e376c08,
  0x2748774c,
  0x34b0bcb5,
  0x391c0cb3,
  0x4ed8aa4a,
  0x5b9cca4f,
  0x682e6ff3,
  0x748f82ee,
  0x78a5636f,
  0x84c87814,
  0x8cc70208,
  0x90befffa,
  0xa4506ceb,
  0xbef9a3f7,
  0xc67178f2,
];

function rotate(value: number, count: number) {
  return (value >>> count) | (value << (32 - count));
}

function fallback(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  const view = new DataView(padded.buffer);
  const state = new Uint32Array([
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19,
  ]);
  const words = new Uint32Array(64);

  padded.set(bytes);
  padded[bytes.length] = 0x80;
  view.setUint32(padded.length - 8, Math.floor(bytes.length / 0x20000000));
  view.setUint32(padded.length - 4, bytes.length * 8);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 64; index += 1) {
      if (index < 16) {
        words[index] = view.getUint32(offset + (index * 4));
      } else {
        const first = words[index - 15];
        const second = words[index - 2];
        const sigma0 = rotate(first, 7) ^ rotate(first, 18) ^ (first >>> 3);
        const sigma1 = rotate(second, 17) ^ rotate(second, 19) ^ (second >>> 10);

        words[index] = words[index - 16] + sigma0 + words[index - 7] + sigma1;
      }
    }
    const working = Array.from(state);

    for (let index = 0; index < 64; index += 1) {
      const [
        a, b, c, d, e, f, g, h,
      ] = working;
      const sum1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choice + constants[index] + words[index]) >>> 0;
      const sum0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;

      working[0] = (temp1 + temp2) >>> 0;
      working[1] = a;
      working[2] = b;
      working[3] = c;
      working[4] = (d + temp1) >>> 0;
      working[5] = e;
      working[6] = f;
      working[7] = g;
    }
    for (let index = 0; index < 8; index += 1) {
      state[index] += working[index];
    }
  }

  return Array.from(state, (value) => value.toString(16).padStart(8, "0")).join("");
}

function nativeSubtle(provider: {
  subtle?: SubtleCrypto;
}) {
  return provider.subtle ?? null;
}

export async function hashPhoto(buffer: ArrayBuffer, subtle: SubtleCrypto | null = nativeSubtle(crypto)) {
  if (subtle === null) {
    return fallback(buffer);
  }
  const hash = await subtle.digest("SHA-256", buffer);

  return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, "0")).join("");
}
