import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../entities';

const ROLES_METADATA = 'roles';

/** 控制器方法角色装饰器：@ROLES_KEY(UserRole.GRID) */
export const ROLES_KEY = (...roles: UserRole[]) =>
  SetMetadata(ROLES_METADATA, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;
    const req = context.switchToHttp().getRequest();
    if (!req.user || !required.includes(req.user.role)) {
      throw new ForbiddenException('当前角色无权执行该操作');
    }
    return true;
  }
}
