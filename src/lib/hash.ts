export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPhoneDigits(lastNine: string): Promise<string> {
  return sha256Hex(`v1:phone:${lastNine}`);
}

export async function hashEmail(email: string): Promise<string> {
  return sha256Hex(`v1:email:${email.trim().toLowerCase()}`);
}
