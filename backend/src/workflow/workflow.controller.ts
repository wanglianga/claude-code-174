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
import { ITEM_CREW_LEVEL, ITEM_TITLES, WorkflowService } from './workflow.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class WorkflowController {
  constructor(private readonly svc: WorkflowService) {}

  /** 乡镇住建复核 */
  @ROLES_KEY(UserRole.TOWNSHIP)
  @Post('houses/:id/review')
  review(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.review(req.user, id, body);
  }

  /** 制定整改方案 */
  @ROLES_KEY(UserRole.TOWNSHIP)
  @Post('houses/:id/plans')
  plan(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.createPlan(req.user, id, body);
  }

  /** 告知书签收 / 拒签（留置送达） */
  @ROLES_KEY(UserRole.FARMER, UserRole.TOWNSHIP, UserRole.GRID)
  @Post('notifications/:nid/sign')
  sign(@Req() req: any, @Param('nid') nid: string, @Body() body: any) {
    return this.svc.signNotify(req.user, nid, body);
  }

  /** 高风险房屋现场封停确认 */
  @ROLES_KEY(UserRole.TOWNSHIP, UserRole.GRID)
  @Post('houses/:id/stop-use')
  stopUse(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.confirmStopUse(req.user, id, body);
  }

  /** 建立临时安置安排 */
  @ROLES_KEY(UserRole.TOWNSHIP, UserRole.GRID)
  @Post('houses/:id/resettlements')
  resettle(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.createResettlement(req.user, id, body);
  }

  /** 确认人员实际转移 */
  @ROLES_KEY(UserRole.TOWNSHIP, UserRole.GRID)
  @Post('resettlements/:rid/transfer')
  transfer(@Req() req: any, @Param('rid') rid: string, @Body() body: any) {
    return this.svc.transferDone(req.user, rid, body);
  }

  /** 验收合格后人员返回 */
  @ROLES_KEY(UserRole.TOWNSHIP, UserRole.GRID)
  @Post('resettlements/:rid/return')
  returnHome(@Req() req: any, @Param('rid') rid: string, @Body() body: any) {
    return this.svc.returnHome(req.user, rid, body);
  }

  /** 按整改项逐条验收 */
  @ROLES_KEY(UserRole.TOWNSHIP)
  @Post('houses/:id/acceptance')
  accept(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.accept(req.user, id, body);
  }

  /** 销号前置核查（9 项制约清单） */
  @ROLES_KEY(UserRole.COUNTY, UserRole.TOWNSHIP)
  @Get('houses/:id/closure-prechecks')
  prechecks(@Param('id') id: string) {
    return this.svc.closurePrechecks(id);
  }

  /** 县级销号 */
  @ROLES_KEY(UserRole.COUNTY)
  @Post('houses/:id/close')
  close(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.close(req.user, id, body || {});
  }

  /** 整改项目录（前端方案编辑器用） */
  @Get('meta/plan-items')
  planItems() {
    return Object.entries(ITEM_TITLES).map(([key, title]) => ({
      key,
      title,
      requiredCrewLevel: ITEM_CREW_LEVEL[key] || null,
    }));
  }
}
