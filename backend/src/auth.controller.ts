import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { User } from './entities';
import { AuthGuard, Public } from './auth.guard';

export function hashPassword(p: string) {
  return createHash('sha256').update(`rhs-salt:${p}`).digest('hex');
}

@Controller('api/auth')
export class AuthController {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    private jwt: JwtService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    const user = await this.users.findOne({ where: { username: body.username } });
    if (!user || user.passwordHash !== hashPassword(body.password || '')) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const payload = {
      sub: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      township: user.township,
      teamId: user.teamId,
    };
    const token = await this.jwt.signAsync(payload);
    return { token, user: payload };
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@Req() req: any) {
    return req.user;
  }
}
