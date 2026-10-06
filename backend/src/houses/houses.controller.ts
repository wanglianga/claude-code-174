import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '../entities';
import { ROLES_KEY, RolesGuard } from '../auth/roles.guard';
import { HousesService } from './houses.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('houses')
export class HousesController {
  constructor(private readonly svc: HousesService) {}

  /** 网格员巡查登记：建档 + 风险判定一次完成 */
  @ROLES_KEY(UserRole.GRID)
  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.svc.createHouseAndInspect(req.user, body);
  }

  /** 农户自主登记房屋基础信息 */
  @ROLES_KEY(UserRole.FARMER)
  @Post('self-register')
  selfRegister(@Req() req: any, @Body() body: any) {
    return this.svc.registerOwner(req.user, body);
  }

  /** 复查/再巡查 */
  @ROLES_KEY(UserRole.GRID)
  @Post(':id/reinspect')
  reinspect(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.reinspect(req.user, id, body);
  }

  @Get()
  list(@Req() req: any, @Query() q: any) {
    return this.svc.list(req.user, q);
  }

  /** 一栋一档完整档案 */
  @Get(':id/archive')
  archive(@Req() req: any, @Param('id') id: string) {
    return this.svc.archive(req.user, id);
  }
}
