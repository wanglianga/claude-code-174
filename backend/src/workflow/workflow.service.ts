import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Acceptance,
  Closure,
  House,
  HouseStatus,
  Issue,
  IssueStatus,
  IssueType,
  NotifyRecord,
  PlanItem,
  RectificationPlan,
  Resettlement,
  ReviewRecord,
  RiskLevel,
  SubsidyApplication,
  UserRole,
} from '../entities';

/** 整改项所需施工队最低资质 */
export const ITEM_CREW_LEVEL: Record<string, string> = {
  remove_added_floor: '乙级',
  reinforce_wall: '乙级',
  repair_roof: '丙级',
  evict_business: '',
  set_warning: '',
  resettlement: '',
};

export const ITEM_TITLES: Record<string, string> = {
  remove_added_floor: '拆除违建加层',
  reinforce_wall: '加固承重墙',
  repair_roof: '修复屋面',
  evict_business: '清退经营租户',
  set_warning: '设置警示标志',
  resettlement: '安排临时安置',
};

@Injectable()
export class WorkflowService {
  constructor(
    @InjectRepository(House) private readonly houses: Repository<House>,
    @InjectRepository(ReviewRecord)
    private readonly reviews: Repository<ReviewRecord>,
    @InjectRepository(RectificationPlan)
    private readonly plans: Repository<RectificationPlan>,
    @InjectRepository(NotifyRecord)
    private readonly notifies: Repository<NotifyRecord>,
    @InjectRepository(Resettlement)
    private readonly resettlements: Repository<Resettlement>,
    @InjectRepository(Acceptance)
    private readonly acceptances: Repository<Acceptance>,
    @InjectRepository(Closure) private readonly closures: Repository<Closure>,
    @InjectRepository(Issue) private readonly issues: Repository<Issue>,
    @InjectRepository(SubsidyApplication)
    private readonly subsidies: Repository<SubsidyApplication>,
  ) {}

  private async houseOrThrow(id: string) {
    const h = await this.houses.findOne({ where: { id } });
    if (!h) throw new NotFoundException('房屋档案不存在');
    return h;
  }

  private async planOf(houseId: string) {
    return this.plans.findOne({
      where: { houseId },
      order: { createdAt: 'DESC' },
    });
  }

  private async openIssues(houseId: string): Promise<Issue[]> {
    return this.issues.find({
      where: { houseId, status: IssueStatus.OPEN },
    });
  }

  private async addNotify(
    house: House,
    user: any,
    type: string,
    content: string,
  ): Promise<NotifyRecord> {
    return this.notifies.save(
      this.notifies.create({
        houseId: house.id,
        type,
        content,
        createdById: user.id,
        createdByName: user.name,
        method: '当面送达',
      }),
    );
  }

  /* ================= 复核 ================= */

  async review(user: any, houseId: string, body: any) {
    const house = await this.houseOrThrow(houseId);
    if (![HouseStatus.INSPECTED, HouseStatus.REBOUND, HouseStatus.RECTIFYING].includes(house.status)) {
      throw new BadRequestException(`当前状态（${house.status}）不允许复核`);
    }
    if (
      body.confirmedLevel &&
      !Object.values(RiskLevel).includes(body.confirmedLevel)
    ) {
      throw new BadRequestException('风险等级不合法');
    }
    const level: RiskLevel = body.confirmedLevel || house.riskLevel;
    const record = await this.reviews.save(
      this.reviews.create({
        houseId,
        inspectionId: house.latestInspectionId || '',
        reviewerId: user.id,
        reviewerName: user.name,
        action: body.action || '确认',
        confirmedLevel: level,
        opinion: body.opinion || '',
      }),
    );
    house.riskLevel = level;
    house.status = HouseStatus.REVIEWED;
    await this.houses.save(house);

    if (level !== RiskLevel.WATCH) {
      await this.addNotify(
        house,
        user,
        '风险告知书',
        `经乡镇复核，该房屋风险等级为${levelLabel(level)}。${body.opinion || ''}`,
      );
    }
    return record;
  }

  /* ================= 整改方案 ================= */

  async createPlan(user: any, houseId: string, body: any) {
    const house = await this.houseOrThrow(houseId);
    if (house.status !== HouseStatus.REVIEWED) {
      throw new BadRequestException('须先完成复核才能制定整改方案');
    }
    const itemKeys: string[] = body.itemKeys || [];
    if (itemKeys.length === 0) {
      throw new BadRequestException('整改方案至少包含一个整改项');
    }
    const review = await this.reviews.findOne({
      where: { houseId },
      order: { createdAt: 'DESC' },
    });
    const items: PlanItem[] = itemKeys.map((key) => ({
      key,
      title: ITEM_TITLES[key] || key,
      requiredCrewLevel: ITEM_CREW_LEVEL[key] || undefined,
      done: false,
    }));
    const stopUseRequired =
      body.stopUseRequired ??
      [RiskLevel.STOP, RiskLevel.EVACUATE].includes(house.riskLevel);
    const resettlementRequired =
      body.resettlementRequired ?? house.riskLevel === RiskLevel.EVACUATE;

    const plan = await this.plans.save(
      this.plans.create({
        houseId,
        reviewId: review?.id || '',
        items,
        deadline: body.deadline,
        stopUseRequired,
        resettlementRequired,
        createdById: user.id,
        createdByName: user.name,
        remark: body.remark || '',
      }),
    );
    house.status = HouseStatus.PLANNED;
    await this.houses.save(house);

    await this.addNotify(
      house,
      user,
      '限期整改通知书',
      `整改项：${items.map((i) => i.title).join('、')}；整改期限：${body.deadline}。逾期未整改将依法采取措施。`,
    );
    if (stopUseRequired) {
      await this.addNotify(
        house,
        user,
        '暂停使用通知',
        '该房屋存在重大安全隐患，自通知之日起暂停使用，严禁人员居住或经营，危险解除并经验收合格后方可恢复使用。',
      );
    }
    if (resettlementRequired) {
      await this.addNotify(
        house,
        user,
        '紧急转移通知',
        '该房屋风险等级为紧急转移，全体居住人员（含租户、经营人员）须立即转移至临时安置点或投亲靠友。',
      );
    }
    return plan;
  }

  /* ================= 告知签收/拒签留痕 ================= */

  async signNotify(user: any, notifyId: string, body: any) {
    const n = await this.notifies.findOne({ where: { id: notifyId } });
    if (!n) throw new NotFoundException('告知记录不存在');
    if (user.role === UserRole.FARMER) {
      const house = await this.houses.findOne({ where: { id: n.houseId } });
      if (!house || house.ownerUserId !== user.id) {
        throw new ForbiddenException('只能签收本人房屋的告知文书');
      }
    }
    n.signStatus = body.signStatus === '拒绝签收' ? '拒绝签收' : '已签收';
    n.signer = body.signer || user.name;
    n.method =
      n.signStatus === '拒绝签收'
        ? body.method || '留置送达'
        : body.method || '当面签收';
    return this.notifies.save(n);
  }

  /* ================= 停用确认（高风险是否真正停用） ================= */

  async confirmStopUse(user: any, houseId: string, body: any) {
    const house = await this.houseOrThrow(houseId);
    if (![RiskLevel.STOP, RiskLevel.EVACUATE].includes(house.riskLevel)) {
      throw new BadRequestException('仅暂停使用/紧急转移等级房屋需要封停确认');
    }
    house.stopUseConfirmed = true;
    await this.houses.save(house);
    return this.addNotify(
      house,
      user,
      '封停确认记录',
      body.note || '已现场张贴封条、设置警示，确认房屋已实际停用，无人员居住/经营。',
    );
  }

  /* ================= 临时安置 ================= */

  async createResettlement(user: any, houseId: string, body: any) {
    const house = await this.houseOrThrow(houseId);
    if (!body.persons || Number(body.persons) <= 0) {
      throw new BadRequestException('安置人数必须大于 0');
    }
    return this.resettlements.save(
      this.resettlements.create({
        houseId,
        persons: Number(body.persons),
        arrangement: body.arrangement,
        membersDetail: body.membersDetail || '',
        note: body.note || '',
      }),
    );
  }

  async transferDone(user: any, resettlementId: string, body: any) {
    const r = await this.resettlements.findOne({ where: { id: resettlementId } });
    if (!r) throw new NotFoundException('安置记录不存在');
    // 协商制约：存在“拒绝整改/租户不搬”未解决事件时，不能标记转移完成
    const blocking = await this.issues.find({
      where: { houseId: r.houseId, status: IssueStatus.OPEN },
    });
    const hard = blocking.filter((i) =>
      [IssueType.REFUSE_FIX, IssueType.TENANT_REFUSE].includes(i.type),
    );
    if (hard.length > 0) {
      throw new BadRequestException(
        `仍有 ${hard.length} 起未化解的协商事项（${hard
          .map((i) => issueLabel(i.type))
          .join('、')}），须先在事件中记录协商过程并化解，才能确认人员转移完成`,
      );
    }
    r.status = '已转移';
    r.transferredAt = new Date();
    r.note = body.note || r.note;
    return this.resettlements.save(r);
  }

  async returnHome(user: any, resettlementId: string, body: any) {
    const r = await this.resettlements.findOne({ where: { id: resettlementId } });
    if (!r) throw new NotFoundException('安置记录不存在');
    const house = await this.houseOrThrow(r.houseId);
    // 验收合格、解除停用后方可返回
    if (![HouseStatus.PENDING_CLOSURE, HouseStatus.CLOSED].includes(house.status)) {
      throw new BadRequestException('房屋尚未验收合格，安置人员不得返回居住');
    }
    r.status = '已返回';
    r.returnedAt = new Date();
    r.note = body.note || r.note;
    return this.resettlements.save(r);
  }

  /* ================= 验收（按整改项逐条） ================= */

  async accept(user: any, houseId: string, body: any) {
    const house = await this.houseOrThrow(houseId);
    if (![HouseStatus.RECTIFYING, HouseStatus.ACCEPTANCE_FAIL].includes(house.status)) {
      throw new BadRequestException('当前状态不允许提交验收（须为整改中/验收不通过）');
    }
    const plan = await this.planOf(houseId);
    if (!plan) throw new BadRequestException('尚未制定整改方案');

    const itemResults: { key: string; title: string; passed: boolean; note: string }[] =
      body.items || [];
    if (itemResults.length !== plan.items.length) {
      throw new BadRequestException(
        `须按方案逐条确认全部 ${plan.items.length} 个整改项，本次提交 ${itemResults.length} 条`,
      );
    }
    for (const pi of plan.items) {
      const matched = itemResults.find((i) => i.key === pi.key);
      if (!matched) throw new BadRequestException(`缺少整改项确认：${pi.title}`);
      if (!pi.done) {
        throw new BadRequestException(`施工方尚未标记完成：${pi.title}，不能验收`);
      }
    }
    if (!body.photos || body.photos.length === 0) {
      throw new BadRequestException('验收须上传现场照片');
    }

    const passed = itemResults.every((i) => i.passed === true);

    // 高风险制约：停用确认 + 人员真实转移（以方案硬性要求为准，即使复查后风险已降级仍须核查）
    if (passed) {
      if (plan.stopUseRequired && !house.stopUseConfirmed) {
        throw new BadRequestException('方案要求暂停使用，但房屋未完成现场封停确认，不能通过验收');
      }
      if (plan.resettlementRequired) {
        const rs = await this.resettlements.findOne({ where: { houseId } });
        if (!rs || (rs.status !== '已转移' && rs.status !== '已返回')) {
          throw new BadRequestException('方案要求临时安置，须确认全体人员已实际转移，才能通过验收');
        }
      }
      const fraud = await this.issues.findOne({
        where: { houseId, type: IssueType.MATERIAL_FRAUD, status: IssueStatus.OPEN },
      });
      if (fraud) {
        throw new BadRequestException('存在未查实处理的“偷换材料”事件，不能通过验收');
      }
    }

    const round =
      (await this.acceptances.count({ where: { houseId } })) + 1;
    const acc = await this.acceptances.save(
      this.acceptances.create({
        houseId,
        round,
        result: passed ? '通过' : '不通过',
        items: itemResults,
        photos: body.photos || [],
        inspectorId: user.id,
        inspectorName: user.name,
        opinion: body.opinion || '',
      }),
    );

    if (passed) {
      house.status = HouseStatus.PENDING_CLOSURE;
      await this.houses.save(house);
      await this.addNotify(
        house,
        user,
        '验收结果告知',
        `第 ${round} 次验收通过：${itemResults.map((i) => i.title).join('、')} 均合格。`,
      );
    } else {
      house.status = HouseStatus.ACCEPTANCE_FAIL;
      await this.houses.save(house);
      await this.addNotify(
        house,
        user,
        '验收结果告知',
        `第 ${round} 次验收不通过：${itemResults
          .filter((i) => !i.passed)
          .map((i) => `${i.title}（${i.note || '不合格'}）`)
          .join('、')}，须返工后重新申请验收。`,
      );
    }
    return acc;
  }

  /* ================= 销号前置核查 ================= */

  async closurePrechecks(houseId: string) {
    const house = await this.houseOrThrow(houseId);
    const plan = await this.planOf(houseId);
    const latestAcceptance = await this.acceptances.findOne({
      where: { houseId },
      order: { round: 'DESC' },
    });
    const openIssueList = await this.openIssues(houseId);
    const subsidies = await this.subsidies.find({ where: { houseId } });
    const resettlement = await this.resettlements.findOne({ where: { houseId } });
    const notifications = await this.notifies.find({ where: { houseId } });
    const recheckList = (
      await this.houses.manager.query(
        `SELECT * FROM inspections WHERE "houseId" = $1 AND "isRecheck" = true ORDER BY "inspectedAt" DESC`,
        [houseId],
      )
    ).filter((x: any) =>
      [RiskLevel.WATCH, RiskLevel.FIX].includes(x.riskLevel),
    );

    const pendingSubsidy = subsidies.filter(
      (s) => !['APPROVED', 'REJECTED'].includes(s.status),
    );
    const approvedNotDisbursed = subsidies.filter(
      (s) => s.status === 'APPROVED' && !s.disbursed,
    );

    // 告知文书核查：应有文书齐备且无“待签收”（拒签须留置送达留痕）
    const requiredNotifyTypes = ['风险告知书'];
    if (plan) {
      requiredNotifyTypes.push('限期整改通知书');
      if (plan.stopUseRequired) requiredNotifyTypes.push('暂停使用通知');
      if (plan.resettlementRequired) requiredNotifyTypes.push('紧急转移通知');
    }
    if (latestAcceptance) requiredNotifyTypes.push('验收结果告知');
    const missingTypes = requiredNotifyTypes.filter(
      (t) => !notifications.some((n) => n.type === t),
    );
    // 仅法定送达文书需要签收/留置留痕；内部记录（封停确认、发放记录等）不阻塞
    const pendingSigns = notifications.filter(
      (n) => n.signStatus === '待签收' && requiredNotifyTypes.includes(n.type),
    );

    let resettlementDetail = '方案未要求安置，不适用';
    let resettlementPassed = true;
    if (plan?.resettlementRequired) {
      if (!resettlement) {
        resettlementPassed = false;
        resettlementDetail = '未建立安置记录';
      } else if (resettlement.status !== '已转移' && resettlement.status !== '已返回') {
        resettlementPassed = false;
        resettlementDetail = `安置状态：${resettlement.status}，人员尚未实际转移`;
      } else {
        resettlementDetail = `${resettlement.persons} 人安置到位（${resettlement.arrangement}，${resettlement.status}）`;
      }
    }

    const notifyDetail =
      missingTypes.length > 0
        ? `缺少文书：${missingTypes.join('、')}`
        : pendingSigns.length > 0
          ? `${pendingSigns.length} 份文书待签收`
          : `${notifications.length} 份文书均已送达留痕`;

    const checks = [
      {
        code: 'ACCEPTANCE',
        label: '最近一次验收结论为通过，且所有整改项逐条合格',
        passed: !!latestAcceptance && latestAcceptance.result === '通过',
        detail: latestAcceptance
          ? `第${latestAcceptance.round}次验收：${latestAcceptance.result}`
          : '尚无验收记录',
      },
      {
        code: 'ITEMS_DONE',
        label: '方案全部整改项施工完成',
        passed: !!plan && plan.items.every((i) => i.done),
        detail: plan
          ? `${plan.items.filter((i) => i.done).length}/${plan.items.length} 项完成`
          : '无整改方案',
      },
      {
        code: 'STOP_USE',
        label: '高风险房屋已实际停用并现场封停',
        passed: !plan?.stopUseRequired || house.stopUseConfirmed,
        detail: !plan
          ? '无整改方案'
          : !plan.stopUseRequired
            ? '方案未要求停用，不适用'
            : house.stopUseConfirmed
              ? '已封停确认'
              : '方案要求停用但未封停确认',
      },
      {
        code: 'RESETTLEMENT',
        label: '紧急转移人员已妥善安置',
        passed: resettlementPassed,
        detail: resettlementDetail,
      },
      {
        code: 'NOTIFY',
        label: '风险告知/整改/验收等法律文书已送达（签收或留置留痕）',
        passed: missingTypes.length === 0 && pendingSigns.length === 0,
        detail: notifyDetail,
      },
      {
        code: 'SUBSIDY_FINALIZED',
        label: '补助申请均已核定结案（不得在途销号）',
        passed: pendingSubsidy.length === 0,
        detail:
          pendingSubsidy.length === 0
            ? subsidies.length === 0
              ? '无补助申请'
              : '全部结案'
            : `${pendingSubsidy.length} 件仍在审核中`,
      },
      {
        code: 'SUBSIDY_DISBURSED',
        label: '核定通过的补助已发放至符合条件家庭',
        passed: approvedNotDisbursed.length === 0,
        detail:
          approvedNotDisbursed.length === 0
            ? '无待发补助'
            : `${approvedNotDisbursed.length} 件已核定未发放`,
      },
      {
        code: 'ISSUES',
        label: '无未化解的异常/协商事项',
        passed: openIssueList.length === 0,
        detail:
          openIssueList.length === 0
            ? '无未决事项'
            : openIssueList.map((i) => issueLabel(i.type)).join('、'),
      },
      {
        code: 'RECHECK',
        label: '整改后复查风险已降至一般关注/限期整改以下',
        passed: recheckList.length > 0,
        detail:
          recheckList.length > 0
            ? `复查等级：${recheckList[0].riskLevel}`
            : '尚无整改后复查记录',
      },
    ];
    return { checks, allPassed: checks.every((c) => c.passed) };
  }

  async close(user: any, houseId: string, body: any) {
    const house = await this.houseOrThrow(houseId);
    const { checks, allPassed } = await this.closurePrechecks(houseId);
    if (!allPassed) {
      throw new BadRequestException({
        message: '销号前置条件未全部满足，不能销号',
        checks,
      });
    }
    const closure = await this.closures.save(
      this.closures.create({
        houseId,
        status: '已销号',
        prechecks: checks,
        approvedById: user.id,
        approverName: user.name,
        opinion: body.opinion || '核查通过，同意销号',
        approvedAt: new Date(),
      }),
    );
    house.status = HouseStatus.CLOSED;
    await this.houses.save(house);
    return closure;
  }

  /** 反弹重开：由问题反弹事件调用，也供县级直接重开 */
  async reopen(houseId: string, reason: string) {
    const house = await this.houseOrThrow(houseId);
    house.status = HouseStatus.REBOUND;
    await this.houses.save(house);
    const last = await this.closures.findOne({
      where: { houseId },
      order: { createdAt: 'DESC' },
    });
    if (last && last.status === '已销号') {
      last.status = '反弹重开';
      last.opinion = reason;
      await this.closures.save(last);
    }
    return house;
  }
}

export function levelLabel(l: RiskLevel): string {
  return (
    {
      WATCH: '一般关注',
      FIX: '限期整改',
      STOP: '暂停使用',
      EVACUATE: '紧急转移',
    } as Record<RiskLevel, string>
  )[l];
}

export function issueLabel(t: IssueType): string {
  return (
    {
      REFUSE_FIX: '农户拒绝整改',
      MATERIAL_FRAUD: '施工队偷换材料',
      SUBSIDY_DISPUTE: '补助资格争议',
      RAIN_ESCALATION: '雨季风险加重',
      TENANT_REFUSE: '租户不愿搬离',
      ACCEPTANCE_FAIL: '验收不通过',
      REBOUND: '复查问题反弹',
      OTHER: '其他事项',
    } as Record<IssueType, string>
  )[t];
}
