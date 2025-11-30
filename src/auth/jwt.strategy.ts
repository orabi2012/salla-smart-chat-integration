import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
        (request) => {
          let token = null;
          if (request && request.cookies) {
            token = request.cookies['access_token'];
          }
          return token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'defaultSecretKey',
    });
  }
  async validate(payload: any) {
    // If assignedStoreId is missing from token (old token), fetch from database
    if (payload.assignedStoreId === undefined) {
      console.log('JWT - assignedStoreId missing from token, fetching from database');
      const user = await this.usersService.findByUsername(payload.username);
      if (user) {
        return {
          userId: payload.sub,
          username: payload.username,
          isSuperadmin: payload.isSuperadmin,
          assignedStoreId: user.assignedStoreId,
        };
      }
    }

    return {
      userId: payload.sub,
      username: payload.username,
      isSuperadmin: payload.isSuperadmin,
      assignedStoreId: payload.assignedStoreId,
    };
  }
}
