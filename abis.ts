import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySiweMessage } from '@worldcoin/minikit-js';

export async function POST(req: NextRequest) {
  try {
    const { payload, nonce } = await req.json();
    const cookieNonce = cookies().get('siwe')?.value;

    if (nonce !== cookieNonce) {
      return NextResponse.json({
        status: 'error',
        isValid: false,
        message: 'Invalid nonce',
      });
    }

    const validMessage = await verifySiweMessage(payload, cookieNonce);

    return NextResponse.json({
      status: 'success',
      isValid: validMessage.isValid,
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      isValid: false,
      message: error?.message || 'Error',
    });
  }
}
