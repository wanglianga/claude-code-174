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
import { UserRole } from '../entities';
import { ROLES_KEY, RolesGuard } from '../auth/roles.guard';
import { SubsidyService } from './subsidy.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class SubsidyController {
  constructor(private readonly svc: SubsidyService) {}

  /** 农户提交施工计划 + 补助申请（含四项校验） */
  @ROLES_KEY(UserRole.FARMER, UserRole.TOWNSHIP)
  @Post('houses/:id/subsidies')
  submit(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.submit(req.user, id, body);
  }

  @ROLES_KEY(UserRole.TOWNSHIP)
  @Post('subsidies/:appId/township-review')
  townshipReview(@Req() req: any, @Param('appId') appId: string, @Body() body: any) {
    return this.svc.townshipReview(req.user, appId, body);
  }

  @ROLES_KEY(UserRole.COUNTY)
  @Post('subsidies/:appId/county-review')
  countyReview(@Req() req: any, @Param('appId') appId: string, @Body() body: any) {
    return this.svc.countyReview(req.user, appId, body);
  }

  /** 县级发放补助 */
  @ROLES_KEY(UserRole.COUNTY)
  @Post('subsidies/:appId/disburse')
  disburse(@Req() req: any, @Param('appId') appId: string) {
    return this.svc.disburse(req.user, appId);
  }

  @Get('houses/:id/subsidies')
  listByHouse(@Param('id') id: string) {
    return this.svc.listByHouse(id);
  }

  @ROLES_KEY(UserRole.TOWNSHIP, UserRole.COUNTY)
  @Get('subsidy-applications')
  list(@Req() req: any, @Query('status') status: string) {
    return this.svc.listAll(req.user, status);
  }
}
