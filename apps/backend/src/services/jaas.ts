import { createSign } from 'crypto';
import { env } from '../config/env';

export function isJaasConfigured(): boolean {
  return Boolean(
    env.JAAS_APP_ID?.trim() &&
      env.JAAS_API_KEY_ID?.trim() &&
      env.JAAS_PRIVATE_KEY?.trim(),
  );
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Signs an RS256 JWT for 8x8 JaaS (Jitsi as a Service) with strict host-only moderation.
 */
export function signJaasJwt(params: {
  userId: string;
  displayName: string;
  email: string;
  roomName: string;
  isModerator: boolean;
}): { appId: string; roomPath: string; jwt: string } {
  const appId = env.JAAS_APP_ID!.trim();
  const kid = env.JAAS_API_KEY_ID!.trim();
  const privateKey = env.JAAS_PRIVATE_KEY!.replace(/\\n/g, '\n').trim();

  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    kid,
    typ: 'JWT',
  };

  const payload = {
    aud: 'jitsi',
    iss: 'chat',
    sub: appId,
    room: params.roomName,
    nbf: now - 10,
    exp: now + 2 * 60 * 60, // 2 hours
    context: {
      user: {
        id: params.userId,
        name: params.displayName,
        email: params.email,
        moderator: params.isModerator,
      },
      features: {
        livestreaming: false,
        recording: false,
        transcription: false,
        'outbound-call': false,
      },
    },
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey);

  return {
    appId,
    roomPath: `${appId}/${params.roomName}`,
    jwt: `${signingInput}.${base64UrlEncode(signature)}`,
  };
}
