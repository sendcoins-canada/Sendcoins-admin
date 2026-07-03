import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  purpose?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload) {
    // Purpose-scoped tokens (mfa_verification temp tokens, action tokens)
    // must never work as general access tokens. The only purpose token
    // allowed through is 'mfa_setup', and the guard restricts it to
    // MFA-setup routes.
    if (payload.purpose && payload.purpose !== 'mfa_setup') {
      throw new UnauthorizedException('Invalid token purpose');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      mfaSetup: payload.purpose === 'mfa_setup',
    };
  }
}
