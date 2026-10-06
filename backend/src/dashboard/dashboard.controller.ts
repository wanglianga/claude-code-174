import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '../entities';
import { ROLES_KEY, RolesGuard } from '../auth/roles.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  /** 治理总览：县级可按乡镇筛选；乡镇/网格员限本乡镇；农户限名下房屋；施工队不开放 */
  @ROLES_KEY(UserRole.COUNTY, UserRole.TOWNSHIP, UserRole.GRID, UserRole.FARMER)
  @Get('overview')
  overview(@Req() req: any, @Query('township') township?: string) {
    const scope: { township?: string; ownerUserId?: string } = {};
    if (req.user.role === UserRole.TOWNSHIP || req.user.role === UserRole.GRID) {
      scope.township = req.user.township;
    } else if (req.user.role === UserRole.COUNTY && township) {
      scope.township = township;
    } else if (req.user.role === UserRole.FARMER) {
      scope.ownerUserId = req.user.id;
    }
    return this.svc.overview(scope);
  }

  /** 按乡镇、风险类型查看治理进度（县级看全县；乡镇仅本乡镇） */
  @ROLES_KEY(UserRole.COUNTY, UserRole.TOWNSHIP)
  @Get('by-township')
  byTownship(@Req() req: any) {
    return this.svc.byTownship(req.user.role === UserRole.TOWNSHIP ? req.user.township : undefined);
  }
}
