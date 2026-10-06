import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BudgetItem,
  ConstructionCrew,
  DifficultyType,
  House,
  HouseStatus,
  NotifyRecord,
  RectificationPlan,
  SubsidyApplication,
  SubsidyCheck,
  SubsidyStatus,
  User,
  UserRole,
} from '../entities';
import { ITEM_CREW_LEVEL } from '../workflow/workflow.service';

export const DIFFICULTY_LABEL: Record<DifficultyType, string> = {
  [DifficultyType.NONE]: '无困难类型',
  [DifficultyType.DIBAO]: '低保户',
  [DifficultyType.TEKUN]: '特困供养户',
  [DifficultyType.TUOPIN]: '脱贫不稳定/边缘易致贫户',
  [DifficultyType.DISASTER_ILLNESS]: '因灾因病因学突发严重困难户',
};

/** 困难类型补助上限（元），无困难类型不予补助 */
const DIFFICULTY_CAP: Partial<Record<DifficultyType, number>> = {
  [DifficultyType.DIBAO]: 30000,
  [DifficultyType.TEKUN]: 40000,
  [DifficultyType.TUOPIN]: 25000,
  [DifficultyType.DISASTER_ILLNESS]: 20000,
};

const LEVEL_ORDER = ['丙级', '乙级', '甲级'];

@Injectable()
export class SubsidyService {
  constructor(
    @InjectRepository(SubsidyApplication)
    private readonly apps: Repository<SubsidyApplication>,
    @InjectRepository(House) private readonly houses: Repository<House>,
    @InjectRepository(ConstructionCrew)
    private readonly crews: Repository<ConstructionCrew>,
    @InjectRepository(RectificationPlan)
    private readonly plans: Repository<RectificationPlan>,
    @InjectRepository(NotifyRecord)
    private readonly notifies: Repository<NotifyRecord>,
  ) {}

  private async houseOrThrow(id: string) {
    const h = await this.houses.findOne({ where: { id } });
    if (!h) throw new NotFoundException('房屋档案不存在');
    return h;
  }

  /** 补助资格与材料校验：困难类型 / 房屋权属 / 预算明细 / 施工队资质 */
  async validateApplication(
    house: House,
    body: {
      difficultyType: DifficultyType;
      difficultyProof: boolean;
      ownershipProof: boolean;
      budgetItems: BudgetItem[];
      crewId: string;
    },
  ): Promise<{ checks: SubsidyCheck[]; totalAmount: number; crew: ConstructionCrew | null }> {
    const checks: SubsidyCheck[] = [];

    /* 1. 困难类型 */
    const difficultyType = body.difficultyType || house.difficultyType || DifficultyType.NONE;
    const hasDifficulty = difficultyType && difficultyType !== DifficultyType.NONE;
    checks.push({
      code: 'DIFFICULTY_TYPE',
      label: '家庭困难类型认定',
      passed: hasDifficulty,
      detail: hasDifficulty
        ? `申报类型：${DIFFICULTY_LABEL[difficultyType]}`
        : '未认定困难类型，不符合补助条件',
    });
    checks.push({
      code: 'DIFFICULTY_PROOF',
      label: '困难证明材料',
      passed: hasDifficulty && !!body.difficultyProof,
      detail: !hasDifficulty
        ? '无需（非困难家庭）'
        : body.difficultyProof
          ? '已上传民政部门证明'
          : '缺少困难证明材料',
    });

    /* 2. 房屋权属 */
    checks.push({
      code: 'OWNERSHIP',
      label: '房屋权属清晰（宅基地/不动产权属证明）',
      passed: !!body.ownershipProof && house.ownershipVerified,
      detail: !body.ownershipProof
        ? '缺少权属证明材料'
        : house.ownershipVerified
          ? '乡镇已核验权属'
          : '权属材料已提交但乡镇尚未核验',
    });

    /* 3. 预算明细 */
    const items: BudgetItem[] = (body.budgetItems || []).map((b) => ({
      name: b.name,
      qty: Number(b.qty) || 0,
      unit: b.unit || '项',
      unitPrice: Number(b.unitPrice) || 0,
      amount: Number((b.amount ?? (Number(b.qty) || 0) * (Number(b.unitPrice) || 0)).toFixed(2)),
    }));
    const totalAmount = Math.round(items.reduce((s, b) => s + b.amount, 0) * 100) / 100;
    const budgetOk =
      items.length > 0 &&
      items.every((b) => b.name && b.qty > 0 && b.unitPrice > 0) &&
      totalAmount > 0;
    checks.push({
      code: 'BUDGET',
      label: '预算明细完整合理',
      passed: budgetOk,
      detail: budgetOk
        ? `共 ${items.length} 项，预算合计 ${totalAmount} 元`
        : '预算明细缺失或存在数量/单价为 0 的项目',
    });

    /* 补助上限 */
    const cap = DIFFICULTY_CAP[difficultyType] ?? 0;
    checks.push({
      code: 'BUDGET_CAP',
      label: '申请金额不超过困难类型补助上限',
      passed: hasDifficulty && totalAmount <= cap,
      detail: hasDifficulty
        ? `上限 ${cap} 元，本次预算 ${totalAmount} 元`
        : '非困难家庭不享受补助',
    });

    /* 4. 施工队资质：与整改方案要求匹配、证照有效、未列入黑名单 */
    let crew: ConstructionCrew | null = null;
    if (body.crewId) {
      crew = await this.crews.findOne({ where: { id: body.crewId } });
    }
    const plan = await this.plans.findOne({
      where: { houseId: house.id },
      order: { createdAt: 'DESC' },
    });
    const requiredLevels = plan
      ? Array.from(
          new Set(
            plan.items
              .map((i) => i.requiredCrewLevel)
              .filter(Boolean) as string[],
          ),
        )
      : [];
    const covers = (crewLevel: string, need: string) =>
      LEVEL_ORDER.indexOf(crewLevel) >= LEVEL_ORDER.indexOf(need);

    checks.push({
      code: 'CREW_EXISTS',
      label: '施工队已登记',
      passed: !!crew,
      detail: crew ? crew.name : '未选择已登记施工队',
    });
    checks.push({
      code: 'CREW_BLACKLIST',
      label: '施工队未列入黑名单',
      passed: !!crew && !crew.blacklisted,
      detail: !crew ? '无施工队' : crew.blacklisted ? `${crew.name} 已列入黑名单，不得承接补助工程` : '信用正常',
    });
    checks.push({
      code: 'CREW_CERT',
      label: '施工队资质证照在有效期内',
      passed:
        !!crew &&
        !crew.blacklisted &&
        new Date(crew.validUntil).getTime() >= new Date('2026-10-06').getTime(),
      detail: crew ? `资质 ${crew.qualificationLevel}，有效期至 ${crew.validUntil}` : '无施工队',
    });
    checks.push({
      code: 'CREW_LEVEL',
      label: '施工队资质等级满足整改项要求',
      passed:
        !!crew &&
        !crew.blacklisted &&
        requiredLevels.every((lvl) => covers(crew.qualificationLevel, lvl)),
      detail: !crew
        ? '无施工队'
        : requiredLevels.length === 0
          ? '方案无资质硬性要求'
          : `要求：${requiredLevels.join('/')}；施工队：${crew.qualificationLevel}`,
    });

    return { checks, totalAmount, crew };
  }

  /** 农户提交施工计划 + 补助申请 */
  async submit(user: any, houseId: string, body: any) {
    const house = await this.houseOrThrow(houseId);
    if (user.role === UserRole.FARMER && house.ownerUserId !== user.id) {
      throw new ForbiddenException('只能为本人名下房屋申请补助');
    }
    const existing = await this.apps.findOne({
      where: { houseId, status: SubsidyStatus.TOWNSHIP_REVIEW },
    });
    if (existing) {
      throw new BadRequestException('该房屋已有在审补助申请，请勿重复提交');
    }
    const { checks, totalAmount, crew } = await this.validateApplication(house, body);
    const app = this.apps.create({
      houseId,
      applicantName: body.applicantName || house.ownerName,
      difficultyType: body.difficultyType || house.difficultyType || DifficultyType.NONE,
      difficultyProof: !!body.difficultyProof,
      ownershipProof: !!body.ownershipProof,
      budgetItems: body.budgetItems || [],
      totalAmount,
      crewId: crew?.id || null,
      checks,
      status: SubsidyStatus.TOWNSHIP_REVIEW,
    });
    return this.apps.save(app);
  }

  /** 乡镇初审：核验困难类型与权属，可调整核定金额后上报县级 */
  async townshipReview(user: any, appId: string, body: any) {
    const app = await this.apps.findOne({ where: { id: appId } });
    if (!app) throw new NotFoundException('补助申请不存在');
    if (app.status !== SubsidyStatus.TOWNSHIP_REVIEW) {
      throw new BadRequestException('该申请不处于乡镇初审环节');
    }
    const house = await this.houseOrThrow(app.houseId);
    if (user.township && house.township !== user.township) {
      throw new ForbiddenException('只能初审本乡镇申请');
    }

    if (body.action === 'reject') {
      app.status = SubsidyStatus.REJECTED;
      app.townshipOpinion = body.opinion || '初审驳回（资格/材料不符）';
      app.townshipReviewerId = user.id;
      await this.apps.save(app);
      await this.notify(
        house,
        user,
        '补助核定决定',
        `补助申请经乡镇初审驳回：${app.townshipOpinion}。如有异议可提交补充材料申诉。`,
      );
      return app;
    }

    // 乡镇现场核验权属与困难情况
    if (body.ownershipVerified) house.ownershipVerified = true;
    if (body.difficultyType) house.difficultyType = body.difficultyType;
    app.difficultyType = body.difficultyType || app.difficultyType;
    await this.houses.save(house);

    // 重新校验，核验后权属项应通过
    const { checks } = await this.validateApplication(house, {
      difficultyType: app.difficultyType,
      difficultyProof: app.difficultyProof,
      ownershipProof: app.ownershipProof,
      budgetItems: app.budgetItems,
      crewId: app.crewId || '',
    });
    const blocking = checks.filter((c) => !c.passed);
    if (blocking.length > 0 && body.force !== true) {
      throw new BadRequestException({
        message: '资格/材料校验未通过，不能上报县级（可在事件中登记补助资格争议）',
        failedChecks: blocking,
      });
    }
    app.checks = checks;
    const cap = DIFFICULTY_CAP[app.difficultyType] ?? 0;
    const requested = Number(app.totalAmount);
    app.approvedAmount =
      body.approvedAmount != null
        ? Math.min(Number(body.approvedAmount), cap, requested)
        : Math.min(requested, cap);
    app.townshipOpinion = body.opinion || '初审同意，已核验权属与困难情况';
    app.townshipReviewerId = user.id;
    app.status = SubsidyStatus.COUNTY_REVIEW;
    return this.apps.save(app);
  }

  /** 县级核定 */
  async countyReview(user: any, appId: string, body: any) {
    const app = await this.apps.findOne({ where: { id: appId } });
    if (!app) throw new NotFoundException('补助申请不存在');
    if (app.status !== SubsidyStatus.COUNTY_REVIEW) {
      throw new BadRequestException('该申请不处于县级核定环节');
    }
    const house = await this.houseOrThrow(app.houseId);
    app.countyReviewerId = user.id;
    if (body.action === 'reject') {
      app.status = SubsidyStatus.REJECTED;
      app.countyOpinion = body.opinion || '县级核定驳回';
      await this.apps.save(app);
      await this.notify(house, user, '补助核定决定', `补助申请经县级核定不予通过：${app.countyOpinion}`);
      return app;
    }
    if (body.approvedAmount != null) {
      const cap = DIFFICULTY_CAP[app.difficultyType] ?? 0;
      app.approvedAmount = Math.min(Number(body.approvedAmount), cap);
    }
    app.status = SubsidyStatus.APPROVED;
    app.countyOpinion = body.opinion || '核定通过';
    await this.apps.save(app);
    await this.notify(
      house,
      user,
      '补助核定决定',
      `补助申请经县级核定通过，核定补助 ${app.approvedAmount} 元，将按施工进度拨付。`,
    );
    return app;
  }

  /** 发放：须在整改方案下达后、且核定通过；验收前可预拨部分？
   *  规则：核定通过即发放（演示平台简化为一次性发放），未核定不得发放 */
  async disburse(user: any, appId: string) {
    const app = await this.apps.findOne({ where: { id: appId } });
    if (!app) throw new NotFoundException('补助申请不存在');
    if (app.status !== SubsidyStatus.APPROVED) {
      throw new BadRequestException('仅核定通过的申请可以发放');
    }
    if (app.disbursed) throw new BadRequestException('该补助已发放，不得重复发放');
    app.disbursed = true;
    app.disbursedAt = new Date();
    await this.apps.save(app);
    const house = await this.houseOrThrow(app.houseId);
    await this.notify(house, user, '补助发放记录', `已向 ${app.applicantName} 发放补助 ${app.approvedAmount} 元。`);
    return app;
  }

  async listByHouse(houseId: string) {
    return this.apps.find({ where: { houseId }, order: { createdAt: 'DESC' } });
  }

  async listAll(user: any, status?: string) {
    const qb = this.apps.createQueryBuilder('s').orderBy('s.createdAt', 'DESC');
    if (status) qb.andWhere('s.status = :st', { st: status });
    if (user.role === UserRole.TOWNSHIP) {
      qb.innerJoin('houses', 'h', 'h.id = s."houseId"').andWhere(
        'h.township = :t',
        { t: user.township },
      );
    }
    return qb.limit(200).getMany();
  }

  private async notify(house: House, user: any, type: string, content: string) {
    await this.notifies.save(
      this.notifies.create({
        houseId: house.id,
        type,
        content,
        createdById: user.id,
        createdByName: user.name,
        method: '系统送达',
        signStatus: '待签收',
      }),
    );
  }
}
