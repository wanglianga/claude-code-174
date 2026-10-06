import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities';

export interface JwtPayload {
  sub: string;
  username: string;
  name: string;
  role: UserRole;
  township: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.users.findOne({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      township: user.township,
    };
    return {
      token: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        township: user.township,
        village: user.village,
        phone: user.phone,
      },
    };
  }
}
