import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConstructionCrew,
  ConstructionLog,
  House,
  HouseStatus,
  MaterialProof,
  RectificationPlan,
  UserRole,
} from '../entities';

@Injectable()
export class ConstructionService {
  constructor(
    @InjectRepository(House) private readonly houses: Repository<House>,
    @InjectRepository(RectificationPlan)
    private readonly plans: Repository<RectificationPlan>,
    @InjectRepository(ConstructionLog)
    private readonly logs: Repository<ConstructionLog>,
    @InjectRepository(ConstructionCrew)
    private readonly crews: Repository<ConstructionCrew>,
  ) {}

  /** 乡镇在方案告知后启动整改（农户开始施工） */
  async startRectification(user: any, houseId: string) {
    const house = await this.houses.findOne({ where: { id: houseId } });
    if (!house) throw new NotFoundException('房屋档案不存在');
    if (house.status !== HouseStatus.PLANNED && house.status !== HouseStatus.ACCEPTANCE_FAIL) {
      throw new BadRequestException('仅已下达方案或验收返工的房屋可以启动/复工整改');
    }
    house.status = HouseStatus.RECTIFYING;
    await this.houses.save(house);
    return house;
  }

  /** 施工队上传材料/照片/阶段进度 */
  async addLog(user: any, houseId: string, body: any) {
    const house = await this.houses.findOne({ where: { id: houseId } });
    if (!house) throw new NotFoundException('房屋档案不存在');
    if (house.status !== HouseStatus.RECTIFYING) {
      throw new BadRequestException('房屋未处于整改施工阶段，不能上传施工记录');
    }
    const materials: MaterialProof[] = (body.materials || []).map((m: any) => ({
      name: m.name,
      brand: m.brand,
      spec: m.spec,
      batch: m.batch,
      qty: Number(m.qty) || 0,
      cert: m.cert || '',
      matchedSpec: m.matchedSpec !== false,
    }));
    const log = this.logs.create({
      houseId,
      stage: body.stage || '材料进场',
      description: body.description || '',
      materials,
      photos: body.photos || [],
      createdById: user.id,
      createdByName: user.name,
    });
    return this.logs.save(log);
  }

  /** 施工队/乡镇标记整改项施工完成（供验收逐条核对） */
  async markItemDone(user: any, houseId: string, body: { key: string; done: boolean }) {
    const plan = await this.plans.findOne({
      where: { houseId },
      order: { createdAt: 'DESC' },
    });
    if (!plan) throw new NotFoundException('整改方案不存在');
    const item = plan.items.find((i) => i.key === body.key);
    if (!item) throw new BadRequestException('整改项不存在');
    item.done = body.done !== false;
    await this.plans.save(plan);
    return plan;
  }

  listCrews() {
    return this.crews.find({ order: { blacklisted: 'ASC', name: 'ASC' } });
  }
}
