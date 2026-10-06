import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '../entities';
import { ROLES_KEY, RolesGuard } from '../auth/roles.guard';
import { ConstructionService } from './construction.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class ConstructionController {
  constructor(private readonly svc: ConstructionService) {}

  @ROLES_KEY(UserRole.TOWNSHIP)
  @Post('houses/:id/start-rectification')
  start(@Req() req: any, @Param('id') id: string) {
    return this.svc.startRectification(req.user, id);
  }

  /** 施工队上传材料、照片、阶段进度 */
  @ROLES_KEY(UserRole.CREW, UserRole.TOWNSHIP, UserRole.GRID)
  @Post('houses/:id/construction-logs')
  log(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.addLog(req.user, id, body);
  }

  /** 标记整改项完成 */
  @ROLES_KEY(UserRole.CREW, UserRole.TOWNSHIP)
  @Post('houses/:id/plan-item-done')
  done(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.markItemDone(req.user, id, body);
  }

  @Get('construction-crews')
  crews() {
    return this.svc.listCrews();
  }
}
