import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  // La doc oficial dice: "stricter (alphanumeric SIWE nonce)"
  const nonce = crypto.randomUUID().replace(/-/g, '');

  cookies().set('siwe', nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10,
  });

  return NextResponse.json({ nonce });
}
