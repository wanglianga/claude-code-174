import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  Acceptance,
  Closure,
  ConstructionLog,
  House,
  HouseStatus,
  Inspection,
  Issue,
  NotifyRecord,
  Resettlement,
  ReviewRecord,
  RectificationPlan,
  RiskLevel,
  Severity,
  SubsidyApplication,
  User,
  UserRole,
} from '../entities';
import { evaluateRisk, RiskInput } from '../risk/rules';

@Injectable()
export class HousesService {
  constructor(
    @InjectRepository(House) private readonly houses: Repository<House>,
    @InjectRepository(Inspection)
    private readonly inspections: Repository<Inspection>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ReviewRecord)
    private readonly reviews: Repository<ReviewRecord>,
    @InjectRepository(RectificationPlan)
    private readonly plans: Repository<RectificationPlan>,
    @InjectRepository(NotifyRecord)
    private readonly notifies: Repository<NotifyRecord>,
    @InjectRepository(Resettlement)
    private readonly resettlements: Repository<Resettlement>,
    @InjectRepository(SubsidyApplication)
    private readonly subsidies: Repository<SubsidyApplication>,
    @InjectRepository(ConstructionLog)
    private readonly logs: Repository<ConstructionLog>,
    @InjectRepository(Acceptance)
    private readonly acceptances: Repository<Acceptance>,
    @InjectRepository(Issue) private readonly issues: Repository<Issue>,
    @InjectRepository(Closure) private readonly closures: Repository<Closure>,
  ) {}

  private severity(v: any): Severity {
    return Object.values(Severity).includes(v) ? v : Severity.NONE;
  }

  async createHouseAndInspect(
    user: any,
    body: any,
  ): Promise<{ house: House; inspection: Inspection }> {
    const required = [
      'township',
      'village',
      'address',
      'ownerName',
      'buildYear',
      'floors',
      'residents',
    ];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null || body[k] === '') {
        throw new BadRequestException(`缺少必填字段：${k}`);
      }
    }

    const count = await this.houses.count();
    const code = `NF-2026-${String(count + 1).padStart(4, '0')}`;

    const snapshot: RiskInput = {
      buildYear: Number(body.buildYear),
      floors: Number(body.floors),
      usage: body.usage || '自住',
      isBusiness: !!body.isBusiness,
      isRented: !!body.isRented,
      isAddedFloor: !!body.isAddedFloor,
      wallCracks: this.severity(body.wallCracks),
      roofLeak: this.severity(body.roofLeak),
      foundationSettlement: this.severity(body.foundationSettlement),
      residents: Number(body.residents),
      structure: body.structure || '砖混',
    };

    const house = this.houses.create({
      code,
      township: body.township,
      village: body.village,
      address: body.address,
      lng: body.lng ? Number(body.lng) : 0,
      lat: body.lat ? Number(body.lat) : 0,
      ownerName: body.ownerName,
      ownerPhone: body.ownerPhone || '',
      ...snapshot,
      status: HouseStatus.INSPECTED,
    });
    const savedHouse = await this.houses.save(house);

    const { level, hits } = evaluateRisk(snapshot);
    savedHouse.riskLevel = level;
    await this.houses.save(savedHouse);

    const insp = await this.inspections.save(
      this.inspections.create({
        houseId: savedHouse.id,
        inspectorId: user.id,
        inspectorName: user.name,
        inspectedAt: body.inspectedAt ? new Date(body.inspectedAt) : new Date(),
        snapshot,
        riskLevel: level,
        ruleHits: hits,
        notes: body.notes || '',
      }),
    );
    savedHouse.latestInspectionId = insp.id;
    await this.houses.save(savedHouse);

    return { house: savedHouse, inspection: insp };
  }

  /** 再次巡查（复查 / 雨季加重 / 反弹复查） */
  async reinspect(user: any, houseId: string, body: any): Promise<Inspection> {
    const house = await this.getHouseOrThrow(houseId);
    const snapshot: RiskInput = {
      buildYear: body.buildYear != null ? Number(body.buildYear) : house.buildYear,
      floors: body.floors != null ? Number(body.floors) : house.floors,
      usage: body.usage ?? house.usage,
      isBusiness: body.isBusiness ?? house.isBusiness,
      isRented: body.isRented ?? house.isRented,
      isAddedFloor: body.isAddedFloor ?? house.isAddedFloor,
      wallCracks: body.wallCracks ? this.severity(body.wallCracks) : house.wallCracks,
      roofLeak: body.roofLeak ? this.severity(body.roofLeak) : house.roofLeak,
      foundationSettlement: body.foundationSettlement
        ? this.severity(body.foundationSettlement)
        : house.foundationSettlement,
      residents: body.residents != null ? Number(body.residents) : house.residents,
      structure: body.structure ?? house.structure,
    };
    const { level, hits } = evaluateRisk(snapshot);
    Object.assign(house, snapshot, { riskLevel: level });
    await this.houses.save(house);

    const insp = await this.inspections.save(
      this.inspections.create({
        houseId: house.id,
        inspectorId: user.id,
        inspectorName: user.name,
        inspectedAt: body.inspectedAt ? new Date(body.inspectedAt) : new Date(),
        snapshot,
        riskLevel: level,
        ruleHits: hits,
        notes: body.notes || '',
        isRecheck: !!body.isRecheck,
      }),
    );
    house.latestInspectionId = insp.id;
    await this.houses.save(house);
    return insp;
  }

  async list(user: any, q: any): Promise<{ items: House[]; total: number }> {
    const qb = this.houses.createQueryBuilder('h');
    if (q.township) qb.andWhere('h.township = :t', { t: q.township });
    if (q.village) qb.andWhere('h.village = :v', { v: q.village });
    if (q.riskLevel) qb.andWhere('h.riskLevel = :r', { r: q.riskLevel });
    if (q.status) qb.andWhere('h.status = :s', { s: q.status });
    if (q.keyword) {
      qb.andWhere(
        '(h.code ILIKE :kw OR h.address ILIKE :kw OR h.ownerName ILIKE :kw)',
        { kw: `%${q.keyword}%` },
      );
    }
    // 网格员只能看本乡镇
    if (user.role === UserRole.GRID && user.township) {
      qb.andWhere('h.township = :t', { t: user.township });
    }
    // 农户只能看自己名下房屋
    if (user.role === UserRole.FARMER) {
      const ownerUser = await this.users.findOne({ where: { id: user.id } });
      qb.andWhere('h.ownerUserId = :uid', { uid: user.id });
    }
    qb.orderBy('h.createdAt', 'DESC');
    const page = Math.max(1, Number(q.page || 1));
    const size = Math.min(100, Number(q.size || 20));
    qb.skip((page - 1) * size).take(size);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  private async getHouseOrThrow(id: string): Promise<House> {
    const house = await this.houses.findOne({ where: { id } });
    if (!house) throw new NotFoundException('房屋档案不存在');
    return house;
  }

  /** 一栋一档：返回同一栋房屋的巡查、复核、告知、整改、安置、补助、验收、销号全量材料 */
  async archive(user: any, id: string) {
    const house = await this.getHouseOrThrow(id);
    if (user.role === UserRole.FARMER && house.ownerUserId !== user.id) {
      throw new ForbiddenException('只能查看本人名下房屋档案');
    }
    if (user.role === UserRole.GRID && user.township && house.township !== user.township) {
      throw new ForbiddenException('只能查看本乡镇房屋');
    }
    const [
      inspections,
      reviews,
      plans,
      notifications,
      resettlements,
      subsidies,
      logs,
      acceptances,
      issues,
      closures,
    ] = await Promise.all([
      this.inspections.find({ where: { houseId: id }, order: { inspectedAt: 'DESC' } }),
      this.reviews.find({ where: { houseId: id }, order: { createdAt: 'DESC' } }),
      this.plans.find({ where: { houseId: id }, order: { createdAt: 'DESC' } }),
      this.notifies.find({ where: { houseId: id }, order: { createdAt: 'DESC' } }),
      this.resettlements.find({ where: { houseId: id }, order: { createdAt: 'DESC' } }),
      this.subsidies.find({ where: { houseId: id }, order: { createdAt: 'DESC' } }),
      this.logs.find({ where: { houseId: id }, order: { createdAt: 'DESC' } }),
      this.acceptances.find({ where: { houseId: id }, order: { round: 'DESC' } }),
      this.issues.find({ where: { houseId: id }, order: { createdAt: 'DESC' } }),
      this.closures.find({ where: { houseId: id }, order: { createdAt: 'DESC' } }),
    ]);
    return {
      house,
      inspections,
      reviews,
      plans,
      notifications,
      resettlements,
      subsidies,
      constructionLogs: logs,
      acceptances,
      issues,
      closures,
    };
  }

  /** 农户登记房屋基础信息（网格员后续补巡查），演示用 */
  async registerOwner(user: any, body: any): Promise<House> {
    const house = this.houses.create({
      code: `NF-2026-${String((await this.houses.count()) + 1).padStart(4, '0')}`,
      township: user.township || body.township,
      village: user.village || body.village,
      address: body.address,
      ownerName: user.name,
      ownerPhone: body.ownerPhone || '',
      ownerUserId: user.id,
      buildYear: body.buildYear ? Number(body.buildYear) : null,
      floors: body.floors ? Number(body.floors) : null,
      usage: body.usage || '自住',
      residents: Number(body.residents || 0),
      structure: body.structure || '砖混',
    });
    return this.houses.save(house);
  }
}
