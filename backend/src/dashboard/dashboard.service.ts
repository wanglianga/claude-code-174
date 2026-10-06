import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Acceptance,
  Closure,
  ConstructionCrew,
  House,
  Issue,
  IssueStatus,
  NotifyRecord,
  Resettlement,
  RiskLevel,
  SubsidyApplication,
  SubsidyStatus,
} from '../entities';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(House) private readonly houses: Repository<House>,
    @InjectRepository(Issue) private readonly issues: Repository<Issue>,
    @InjectRepository(SubsidyApplication)
    private readonly subsidies: Repository<SubsidyApplication>,
    @InjectRepository(Acceptance)
    private readonly acceptances: Repository<Acceptance>,
    @InjectRepository(Closure) private readonly closures: Repository<Closure>,
    @InjectRepository(Resettlement)
    private readonly resettlements: Repository<Resettlement>,
    @InjectRepository(NotifyRecord)
    private readonly notifies: Repository<NotifyRecord>,
  ) {}

  /**
   * 县级治理看板：不只看数量销号，还看高风险是否真正停用、
   * 整改是否按方案完成、补助是否发给符合条件家庭。
   */
  async overview(scope: { township?: string; ownerUserId?: string } = {}) {
    const qb = this.houses.createQueryBuilder('h');
    if (scope.township) qb.andWhere('h.township = :t', { t: scope.township });
    if (scope.ownerUserId) qb.andWhere('h."ownerUserId" = :ou', { ou: scope.ownerUserId });
    const houses = await qb.getMany();
    const houseIds = new Set(houses.map((h) => h.id));

    const riskDist: Record<string, number> = {
      WATCH: 0,
      FIX: 0,
      STOP: 0,
      EVACUATE: 0,
    };
    const statusDist: Record<string, number> = {};
    const highRisk = houses.filter(
      (h) =>
        [RiskLevel.STOP, RiskLevel.EVACUATE].includes(h.riskLevel) ||
        h.stopUseConfirmed,
    );
    // 紧急转移口径：当前紧急转移等级，或已建立安置台账的房屋（复查降级后仍可追踪管控真实性）
    const allRes = await this.resettlements.find();
    const evacHouses = houses.filter(
      (h) => h.riskLevel === RiskLevel.EVACUATE || allRes.some((r) => r.houseId === h.id),
    );

    for (const h of houses) {
      riskDist[h.riskLevel] = (riskDist[h.riskLevel] || 0) + 1;
      statusDist[h.status] = (statusDist[h.status] || 0) + 1;
    }

    /* 安置真实情况 */
    const resettlements = allRes.filter((r) => houseIds.has(r.houseId));
    const evacIds = new Set(evacHouses.map((h) => h.id));
    const evacR = resettlements.filter((r) => evacIds.has(r.houseId));
    // 曾实际转移（含验收合格后已返回）——证明转移不是纸面数字
    const transferred = evacR.filter((r) => r.transferredAt);
    const returned = evacR.filter((r) => r.status === '已返回');

    /* 补助：核定/发放/驳回/在途，发给困难家庭的金额 */
    const subsidyQb = this.subsidies.createQueryBuilder('s');
    if (scope.township || scope.ownerUserId) {
      subsidyQb.innerJoin('houses', 'hh', 'hh.id = s."houseId"');
      if (scope.township) subsidyQb.andWhere('hh.township = :t', { t: scope.township });
      if (scope.ownerUserId) subsidyQb.andWhere('hh."ownerUserId" = :ou', { ou: scope.ownerUserId });
    }
    const subsidyApps = scope.township || scope.ownerUserId
      ? await subsidyQb.getMany()
      : (await subsidyQb.getMany()).filter((s) => houseIds.has(s.houseId));
    const approved = subsidyApps.filter((s) => s.status === SubsidyStatus.APPROVED);
    const disbursed = approved.filter((s) => s.disbursed);
    const inReview = subsidyApps.filter(
      (s) =>
        s.status === SubsidyStatus.TOWNSHIP_REVIEW ||
        s.status === SubsidyStatus.COUNTY_REVIEW,
    );

    /* 销号与反弹 */
    const relevantClosures = (await this.closures
      .createQueryBuilder('c')
      .getMany()).filter((c) => houseIds.has(c.houseId));
    const closedCount = relevantClosures.filter((c) => c.status === '已销号').length;
    const reboundCount = relevantClosures.filter((c) => c.status === '反弹重开').length;

    /* 异常事项 */
    const issueQb = this.issues
      .createQueryBuilder('i')
      .innerJoin('houses', 'hi', 'hi.id = i."houseId"');
    if (scope.township) issueQb.andWhere('hi.township = :t', { t: scope.township });
    if (scope.ownerUserId) issueQb.andWhere('hi."ownerUserId" = :ou', { ou: scope.ownerUserId });
    const issueRows = await issueQb.getMany();
    const openIssues = issueRows.filter((i) => i.status !== IssueStatus.RESOLVED);

    return {
      generatedAt: new Date().toISOString(),
      filter: {
        scope: scope.ownerUserId
          ? '本人名下房屋'
          : scope.township
            ? scope.township
            : '全县',
      },
      totals: {
        houses: houses.length,
        closed: closedCount,
        rebound: reboundCount,
        closureRate: houses.length ? +(closedCount / houses.length).toFixed(3) : 0,
      },
      riskDistribution: riskDist,
      statusDistribution: statusDist,
      /** 高风险是否真正停用 */
      highRiskControl: {
        highRiskTotal: highRisk.length,
        stopUseConfirmed: highRisk.filter((h) => h.stopUseConfirmed).length,
        evacuateTotal: evacHouses.length,
        evacuated: transferred.length,
        returnedAfterAcceptance: returned.length,
        notStopped: highRisk
          .filter((h) => !h.stopUseConfirmed)
          .map((h) => ({ code: h.code, address: h.address, riskLevel: h.riskLevel, status: h.status })),
      },
      /** 补助是否发给符合条件家庭 */
      subsidy: {
        applied: subsidyApps.length,
        inReview: inReview.length,
        approved: approved.length,
        rejected: subsidyApps.filter((s) => s.status === SubsidyStatus.REJECTED).length,
        disbursed: disbursed.length,
        approvedAmount: approved.reduce((s, a) => s + Number(a.approvedAmount), 0),
        disbursedAmount: disbursed.reduce((s, a) => s + Number(a.approvedAmount), 0),
      },
      issues: {
        total: issueRows.length,
        open: openIssues.length,
        byType: issueRows.reduce<Record<string, number>>((acc, i) => {
          acc[i.type] = (acc[i.type] || 0) + 1;
          return acc;
        }, {}),
        openList: openIssues.slice(0, 20).map((i) => ({
          id: i.id,
          type: i.type,
          status: i.status,
          description: i.description.slice(0, 60),
        })),
      },
    };
  }

  /** 按乡镇分组的治理进度（县级主管部门视角；乡镇用户仅本乡镇） */
  async byTownship(filterTownship?: string) {
    let houses = await this.houses.find();
    if (filterTownship) houses = houses.filter((h) => h.township === filterTownship);
    const townships = Array.from(new Set(houses.map((h) => h.township))).sort();
    const subsidies = await this.subsidies.find();
    const resettlements = await this.resettlements.find();
    const issues = await this.issues
      .createQueryBuilder('i')
      .innerJoin('houses', 'hi', 'hi.id = i."houseId"')
      .addSelect(['hi.township AS tw'])
      .getRawAndEntities();

    const rows = [];
    for (const tw of townships) {
      const hs = houses.filter((h) => h.township === tw);
      const ids = new Set(hs.map((h) => h.id));
      const high = hs.filter(
        (h) =>
          [RiskLevel.STOP, RiskLevel.EVACUATE].includes(h.riskLevel) ||
          h.stopUseConfirmed,
      );
      const evac = hs.filter(
        (h) =>
          h.riskLevel === RiskLevel.EVACUATE ||
          resettlements.some((r) => r.houseId === h.id),
      );
      const evacIds = new Set(evac.map((h) => h.id));
      const twSubsidy = subsidies.filter((s) =>
        hs.some((h) => h.id === s.houseId),
      );
      const twIssueIdx = issues.raw
        .map((r, idx) => ({ tw: r.tw, e: issues.entities[idx] }))
        .filter((x) => x.tw === tw);
      rows.push({
        township: tw,
        houses: hs.length,
        risk: {
          WATCH: hs.filter((h) => h.riskLevel === RiskLevel.WATCH).length,
          FIX: hs.filter((h) => h.riskLevel === RiskLevel.FIX).length,
          STOP: hs.filter((h) => h.riskLevel === RiskLevel.STOP).length,
          EVACUATE: evac.length,
        },
        closed: hs.filter((h) => h.status === 'CLOSED').length,
        rectifying: hs.filter((h) => h.status === 'RECTIFYING').length,
        acceptanceFail: hs.filter((h) => h.status === 'ACCEPTANCE_FAIL').length,
        highRiskStopped: high.filter((h) => h.stopUseConfirmed).length,
        highRiskTotal: high.length,
        evacuated: resettlements.filter(
          (r) => evacIds.has(r.houseId) && r.transferredAt,
        ).length,
        openIssues: twIssueIdx.filter((x) => x.e.status !== IssueStatus.RESOLVED).length,
        subsidyApproved: twSubsidy.filter((s) => s.status === SubsidyStatus.APPROVED).length,
        subsidyDisbursed: twSubsidy.filter(
          (s) => s.status === SubsidyStatus.APPROVED && s.disbursed,
        ).length,
        subsidyAmount: twSubsidy
          .filter((s) => s.status === SubsidyStatus.APPROVED && s.disbursed)
          .reduce((sum, s) => sum + Number(s.approvedAmount), 0),
      });
    }
    return rows;
  }
}
