import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConstructionCrew,
  House,
  Issue,
  IssueStatus,
  IssueType,
  RiskLevel,
  Severity,
  User,
  UserRole,
  DifficultyType,
  Inspection,
} from './entities';
import * as bcrypt from 'bcryptjs';
import { evaluateRisk } from './risk/rules';

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(House) private readonly houses: Repository<House>,
    @InjectRepository(ConstructionCrew)
    private readonly crews: Repository<ConstructionCrew>,
    @InjectRepository(Inspection)
    private readonly inspections: Repository<Inspection>,
  ) {}

  async onModuleInit() {
    if ((await this.users.count()) > 0) return;

    const mk = async (u: Partial<User> & { username: string; password: string; role: UserRole; name: string }) => {
      const entity = this.users.create({
        username: u.username,
        passwordHash: await bcrypt.hash(u.password, 10),
        name: u.name,
        role: u.role,
        township: u.township || '',
        village: u.village || '',
        phone: u.phone || '',
      });
      return this.users.save(entity);
    };

    const grid = await mk({
      username: 'grid',
      password: 'grid123',
      name: '李网格',
      role: UserRole.GRID,
      township: '青山镇',
      village: '和平村',
    });
    await mk({
      username: 'grid2',
      password: 'grid123',
      name: '赵巡查',
      role: UserRole.GRID,
      township: '白云乡',
      village: '茶园村',
    });
    await mk({
      username: 'township',
      password: 'town123',
      name: '王建国',
      role: UserRole.TOWNSHIP,
      township: '青山镇',
      phone: '13800000001',
    });
    await mk({
      username: 'township2',
      password: 'town123',
      name: '孙复核',
      role: UserRole.TOWNSHIP,
      township: '白云乡',
    });
    await mk({
      username: 'county',
      password: 'county123',
      name: '张监管',
      role: UserRole.COUNTY,
      township: '县住建局',
    });
    const farmer = await mk({
      username: 'farmer',
      password: 'farmer123',
      name: '陈大山',
      role: UserRole.FARMER,
      township: '青山镇',
      village: '和平村',
      phone: '13900000001',
    });
    const farmer2 = await mk({
      username: 'farmer2',
      password: 'farmer123',
      name: '林桂英',
      role: UserRole.FARMER,
      township: '白云乡',
      village: '茶园村',
      phone: '13900000002',
    });
    await mk({
      username: 'crew',
      password: 'crew123',
      name: '周工（安固施工队）',
      role: UserRole.CREW,
    });

    await this.crews.save(
      this.crews.create({
        name: '安固加固工程队',
        qualificationLevel: '乙级',
        certNo: 'AG-2024-018',
        validUntil: '2027-12-31',
        scope: '承重墙加固、屋面防水、加层拆除',
        contact: '周工 13700000001',
        linkedUsername: 'crew',
      }),
    );
    await this.crews.save(
      this.crews.create({
        name: '利民修缮队',
        qualificationLevel: '丙级',
        certNo: 'LM-2023-106',
        validUntil: '2027-06-30',
        scope: '屋面修复、墙面修缮',
        contact: '吴队长 13700000002',
      }),
    );
    await this.crews.save(
      this.crews.create({
        name: '黑马施工队',
        qualificationLevel: '乙级',
        certNo: 'HM-2022-009',
        validUntil: '2026-03-31',
        scope: '土建施工',
        contact: '马某某 13700000003',
        blacklisted: true,
      }),
    );

    /* 房屋1：经营+加层+严重墙裂 → 紧急转移（完整流程演示用） */
    const h1 = await this.houses.save(
      this.houses.create({
        code: 'NF-2026-0001',
        township: '青山镇',
        village: '和平村',
        address: '和平村三组 17 号',
        lng: 110.42,
        lat: 31.15,
        ownerName: '陈大山',
        ownerPhone: '13900000001',
        ownerUserId: farmer.id,
        buildYear: 1998,
        floors: 3,
        usage: '自住+经营',
        isBusiness: true,
        isRented: false,
        isAddedFloor: true,
        wallCracks: Severity.SEVERE,
        roofLeak: Severity.MINOR,
        foundationSettlement: Severity.MINOR,
        residents: 5,
        structure: '砖混',
        difficultyType: DifficultyType.DIBAO,
      }),
    );

    /* 房屋2：严重屋面渗漏 → 限期整改 */
    const h2 = await this.houses.save(
      this.houses.create({
        code: 'NF-2026-0002',
        township: '白云乡',
        village: '茶园村',
        address: '茶园村一组 8 号',
        lng: 110.55,
        lat: 31.22,
        ownerName: '林桂英',
        ownerPhone: '13900000002',
        ownerUserId: farmer2.id,
        buildYear: 2008,
        floors: 2,
        usage: '自住',
        isBusiness: false,
        isRented: false,
        isAddedFloor: false,
        wallCracks: Severity.NONE,
        roofLeak: Severity.SEVERE,
        foundationSettlement: Severity.NONE,
        residents: 3,
        structure: '砖木',
        difficultyType: DifficultyType.NONE,
      }),
    );

    for (const h of [h1, h2]) {
      const { level, hits } = evaluateRisk({
        buildYear: h.buildYear,
        floors: h.floors,
        usage: h.usage,
        isBusiness: h.isBusiness,
        isRented: h.isRented,
        isAddedFloor: h.isAddedFloor,
        wallCracks: h.wallCracks,
        roofLeak: h.roofLeak,
        foundationSettlement: h.foundationSettlement,
        residents: h.residents,
        structure: h.structure,
      });
      h.riskLevel = level;
      await this.houses.save(h);
      const insp = this.inspections.create({
        houseId: h.id,
        inspectorId: grid.id,
        inspectorName: '李网格',
        inspectedAt: new Date('2026-09-28T09:00:00Z'),
        snapshot: {
          buildYear: h.buildYear,
          floors: h.floors,
          usage: h.usage,
          isBusiness: h.isBusiness,
          isRented: h.isRented,
          isAddedFloor: h.isAddedFloor,
          wallCracks: h.wallCracks,
          roofLeak: h.roofLeak,
          foundationSettlement: h.foundationSettlement,
          residents: h.residents,
          structure: h.structure,
        },
        riskLevel: level,
        ruleHits: hits,
        notes: '秋季安全巡查初查',
      });
      const saved = await this.inspections.save(insp);
      h.latestInspectionId = saved.id;
      await this.houses.save(h);
    }
  }
}
