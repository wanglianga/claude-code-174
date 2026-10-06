import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ROLES_KEY, RolesGuard } from '../auth/roles.guard';
import { IssuesService } from './issues.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class IssuesController {
  constructor(private readonly svc: IssuesService) {}

  /** 上报异常/协商事项：拒绝整改、偷换材料、补助争议、雨季加重、租户不搬、验收不通过、反弹等 */
  @Post('houses/:id/issues')
  report(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.report(req.user, id, body);
  }

  /** 协商过程留痕（村干部、老人家庭成员、租户、经营者、施工队等参与方） */
  @Post('issues/:iid/consultations')
  consult(@Req() req: any, @Param('iid') iid: string, @Body() body: any) {
    return this.svc.addConsultation(req.user, iid, body);
  }

  /** 化解事项 */
  @Post('issues/:iid/resolve')
  resolve(@Req() req: any, @Param('iid') iid: string, @Body() body: any) {
    return this.svc.resolve(req.user, iid, body || {});
  }

  @Get('issues')
  list(@Req() req: any, @Query() q: any) {
    return this.svc.list(req.user, q);
  }
}
