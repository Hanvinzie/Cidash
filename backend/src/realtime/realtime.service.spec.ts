import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RealtimeService, REALTIME_TOKEN_TTL_SECONDS } from './realtime.service';

describe('RealtimeService', () => {
  const prisma = { squadMember: { findMany: jest.fn() } };
  const make = (secret?: string) =>
    new RealtimeService(
      prisma as never,
      new JwtService({}),
      { get: () => secret } as unknown as ConfigService,
    );

  it('returns no token when SUPABASE_JWT_SECRET is not configured', async () => {
    await expect(make(undefined).issueToken('u1')).resolves.toEqual({ token: null, expiresAt: null });
    await expect(make('   ').issueToken('u1')).resolves.toEqual({ token: null, expiresAt: null });
    expect(prisma.squadMember.findMany).not.toHaveBeenCalled();
  });

  it('issues a short-lived HS256 token scoped to the user and their circles', async () => {
    prisma.squadMember.findMany.mockResolvedValue([{ squadId: 'c1' }, { squadId: 'c2' }]);
    const secret = 'a-test-secret-with-enough-length-for-hs256';
    const res = await make(secret).issueToken('u1');
    expect(res.token).toEqual(expect.any(String));

    const verifier = new JwtService({});
    const payload = verifier.verify(res.token!, { secret, algorithms: ['HS256'] });
    expect(payload).toMatchObject({ sub: 'u1', role: 'authenticated', aud: 'authenticated', circles: ['c1', 'c2'] });
    expect(payload.exp - payload.iat).toBe(REALTIME_TOKEN_TTL_SECONDS);
    expect(() => verifier.verify(res.token!, { secret: 'wrong-secret' })).toThrow();
  });
});
