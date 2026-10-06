import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConsultationNote,
  House,
  HouseStatus,
  Issue,
  IssueStatus,
  IssueType,
  UserRole,
} from '../entities';

@Injectable()
export class IssuesService {
  constructor(
    @InjectRepository(Issue) private readonly issues: Repository<Issue>,
    @InjectRepository(House) private readonly houses: Repository<House>,
  ) {}

  /** 上报异常/协商事项（巡查、复核、告知、整改、安置、补助、验收各环节均可） */
  async report(user: any, houseId: string, body: any) {
    const house = await this.houses.findOne({ where: { id: houseId } });
    if (!house) throw new NotFoundException('房屋档案不存在');
    if (user.role === UserRole.FARMER && house.ownerUserId !== user.id) {
      throw new ForbiddenException('只能对本人名下房屋登记事项');
    }
    if (!Object.values(IssueType).includes(body.type)) {
      throw new BadRequestException('事项类型不合法');
    }
    if (!body.description) throw new BadRequestException('请描述事项情况');

    const issue = await this.issues.save(
      this.issues.create({
        houseId,
        type: body.type,
        description: body.description,
        reportedById: user.id,
        reportedByName: user.name,
        status: IssueStatus.OPEN,
      }),
    );

    // 雨季风险加重 / 复查反弹：房屋回到待巡查状态，必须重新走巡查-复核流程
    if (body.type === IssueType.REBOUND || body.type === IssueType.RAIN_ESCALATION) {
      house.status = HouseStatus.REBOUND;
      await this.houses.save(house);
      const last = await this.issues.manager.query(
        `SELECT * FROM closures WHERE "houseId" = $1 AND status = '已销号' ORDER BY "createdAt" DESC LIMIT 1`,
        [houseId],
      );
      if (last[0]) {
        await this.issues.manager.query(
          `UPDATE closures SET status = '反弹重开' WHERE id = $1`,
          [last[0].id],
        );
      }
    }
    return issue;
  }

  async addConsultation(user: any, issueId: string, body: any) {
    const issue = await this.issues.findOne({ where: { id: issueId } });
    if (!issue) throw new NotFoundException('事项不存在');
    if (issue.status === IssueStatus.RESOLVED) {
      throw new BadRequestException('事项已化解，不能继续追加协商记录');
    }
    const note: ConsultationNote = {
      at: new Date().toISOString(),
      participants: body.participants || '',
      content: body.content || '',
    };
    issue.consultations = [...(issue.consultations || []), note];
    issue.status = IssueStatus.PROCESSING;
    return this.issues.save(issue);
  }

  async resolve(user: any, issueId: string, body: any) {
    const issue = await this.issues.findOne({ where: { id: issueId } });
    if (!issue) throw new NotFoundException('事项不存在');
    if (issue.status === IssueStatus.RESOLVED) {
      throw new BadRequestException('事项已化解');
    }
    // 偷换材料必须记录核查处置（返工/更换材料）才能化解
    if (issue.type === IssueType.MATERIAL_FRAUD && !body.resolution) {
      throw new BadRequestException('偷换材料事项须填写核查处置结果（返工、更换合格材料等）');
    }
    issue.status = IssueStatus.RESOLVED;
    issue.resolution = body.resolution || '经协商化解';
    return this.issues.save(issue);
  }

  async list(user: any, q: any) {
    const qb = this.issues
      .createQueryBuilder('i')
      .innerJoin('houses', 'h', 'h.id = i."houseId"')
      .addSelect(['h.code AS house_code', 'h.township AS township', 'h."riskLevel" AS risk_level', 'h.address AS address'])
      .orderBy('i."createdAt"', 'DESC');
    if (q.status) qb.andWhere('i.status = :s', { s: q.status });
    if (q.type) qb.andWhere('i.type = :t', { t: q.type });
    if (q.houseId) qb.andWhere('i."houseId" = :hid', { hid: q.houseId });
    if (user.role === UserRole.TOWNSHIP && user.township) {
      qb.andWhere('h.township = :tw', { tw: user.township });
    }
    if (user.role === UserRole.GRID && user.township) {
      qb.andWhere('h.township = :tw', { tw: user.township });
    }
    if (user.role === UserRole.FARMER) {
      qb.andWhere('h."ownerUserId" = :ou', { ou: user.id });
    }
    qb.limit(200);
    const { entities, raw } = await qb.getRawAndEntities();
    return entities.map((e, idx) => ({
      ...e,
      houseCode: raw[idx].house_code,
      township: raw[idx].township,
      riskLevel: raw[idx].risk_level,
      address: raw[idx].address,
    }));
  }
}
