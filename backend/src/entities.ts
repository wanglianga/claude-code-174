import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

/* ============ 枚举 ============ */

export enum UserRole {
  GRID = 'GRID', // 网格员
  TOWNSHIP = 'TOWNSHIP', // 乡镇住建人员（兼验收）
  COUNTY = 'COUNTY', // 县级主管部门
  FARMER = 'FARMER', // 农户（户主）
  CREW = 'CREW', // 施工队
}

export enum RiskLevel {
  WATCH = 'WATCH', // 一般关注
  FIX = 'FIX', // 限期整改
  STOP = 'STOP', // 暂停使用
  EVACUATE = 'EVACUATE', // 紧急转移
}

export enum HouseStatus {
  INSPECTED = 'INSPECTED', // 已巡查待复核
  REVIEWED = 'REVIEWED', // 已复核待方案
  PLANNED = 'PLANNED', // 方案已制定待告知
  RECTIFYING = 'RECTIFYING', // 整改中
  ACCEPTANCE_FAIL = 'ACCEPTANCE_FAIL', // 验收不通过
  PENDING_CLOSURE = 'PENDING_CLOSURE', // 待县级销号
  CLOSED = 'CLOSED', // 已销号
  REBOUND = 'REBOUND', // 问题反弹重开
}

export enum Severity {
  NONE = 'NONE',
  MINOR = 'MINOR',
  SEVERE = 'SEVERE',
}

export enum DifficultyType {
  NONE = 'NONE', // 无困难
  DIBAO = 'DIBAO', // 低保
  TEKUN = 'TEKUN', // 特困供养
  TUOPIN = 'TUOPIN', // 脱贫不稳定/边缘户
  DISASTER_ILLNESS = 'DISASTER_ILLNESS', // 因灾因病因学突发困难
}

export enum SubsidyStatus {
  DRAFT = 'DRAFT',
  TOWNSHIP_REVIEW = 'TOWNSHIP_REVIEW', // 待乡镇初审
  COUNTY_REVIEW = 'COUNTY_REVIEW', // 待县级核定
  APPROVED = 'APPROVED', // 核定通过
  REJECTED = 'REJECTED', // 驳回
}

export enum IssueType {
  REFUSE_FIX = 'REFUSE_FIX', // 农户拒绝整改
  MATERIAL_FRAUD = 'MATERIAL_FRAUD', // 偷换材料
  SUBSIDY_DISPUTE = 'SUBSIDY_DISPUTE', // 补助资格争议
  RAIN_ESCALATION = 'RAIN_ESCALATION', // 雨季风险加重
  TENANT_REFUSE = 'TENANT_REFUSE', // 租户不愿搬离
  ACCEPTANCE_FAIL = 'ACCEPTANCE_FAIL', // 验收不通过
  REBOUND = 'REBOUND', // 复查问题反弹
  OTHER = 'OTHER',
}

export enum IssueStatus {
  OPEN = 'OPEN',
  PROCESSING = 'PROCESSING',
  RESOLVED = 'RESOLVED',
}

/* ============ 用户 ============ */

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  passwordHash: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ default: '' })
  township: string; // 所属乡镇（网格员/乡镇人员）

  @Column({ default: '' })
  village: string;

  @Column({ default: '' })
  phone: string;

  @CreateDateColumn()
  createdAt: Date;
}

/* ============ 施工队 ============ */

@Entity('construction_crews')
export class ConstructionCrew {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  /** 资质等级 甲级/乙级/丙级 */
  @Column()
  qualificationLevel: string;

  @Column()
  certNo: string;

  @Column({ type: 'date' })
  validUntil: string;

  @Column({ default: '' })
  scope: string;

  @Column({ default: '' })
  contact: string;

  @Column({ default: '' })
  linkedUsername: string;

  @Column({ default: false })
  blacklisted: boolean;
}

/* ============ 房屋档案（一栋一档） ============ */

@Entity('houses')
export class House {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  code: string; // 房屋档案编号

  @Column()
  township: string;

  @Column()
  village: string;

  @Column({ default: '' })
  address: string; // 详细地址（村组门牌号）

  @Column({ type: 'numeric', precision: 10, scale: 6, default: 0 })
  lng: number;

  @Column({ type: 'numeric', precision: 10, scale: 6, default: 0 })
  lat: number;

  @Column()
  ownerName: string;

  @Column({ default: '' })
  ownerPhone: string;

  @Column({ type: 'uuid', nullable: true })
  ownerUserId: string | null;

  /* ---- 巡查登记字段（最新一次巡查的快照） ---- */
  @Column({ type: 'int', nullable: true })
  buildYear: number | null;

  @Column({ type: 'int', nullable: true })
  floors: number | null;

  /** 自住 / 经营 / 出租 / 混合 */
  @Column({ default: '自住' })
  usage: string;

  @Column({ default: false })
  isBusiness: boolean;

  @Column({ default: false })
  isRented: boolean;

  @Column({ default: false })
  isAddedFloor: boolean; // 是否擅自加层

  @Column({ type: 'enum', enum: Severity, default: Severity.NONE })
  wallCracks: Severity;

  @Column({ type: 'enum', enum: Severity, default: Severity.NONE })
  roofLeak: Severity;

  @Column({ type: 'enum', enum: Severity, default: Severity.NONE })
  foundationSettlement: Severity;

  @Column({ type: 'int', default: 0 })
  residents: number;

  @Column({ default: '' })
  structure: string; // 结构形式：砖混/砖木/土木/框架

  /* ---- 困难类型 / 权属（农户申报，乡镇核验） ---- */
  @Column({ type: 'enum', enum: DifficultyType, default: DifficultyType.NONE })
  difficultyType: DifficultyType;

  @Column({ default: false })
  ownershipVerified: boolean; // 房屋权属是否已核验

  /* ---- 治理状态 ---- */
  @Column({ type: 'enum', enum: RiskLevel, default: RiskLevel.WATCH })
  riskLevel: RiskLevel;

  @Column({ type: 'enum', enum: HouseStatus, default: HouseStatus.INSPECTED })
  status: HouseStatus;

  @Column({ type: 'uuid', nullable: true })
  latestInspectionId: string | null;

  @Column({ default: false })
  stopUseConfirmed: boolean; // 高风险房屋是否已实际停用（封停确认）

  @CreateDateColumn()
  createdAt: Date;
}

/* ============ 巡查记录 ============ */

@Entity('inspections')
export class Inspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => House, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'houseId' })
  house: House;

  @Column({ type: 'uuid' })
  houseId: string;

  @Column({ type: 'uuid' })
  inspectorId: string;

  @Column()
  inspectorName: string;

  @Column({ type: 'timestamptz' })
  inspectedAt: Date;

  /** 巡查数据快照 */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  snapshot: Record<string, any>;

  @Column({ type: 'enum', enum: RiskLevel })
  riskLevel: RiskLevel;

  /** 命中的风险规则 */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  ruleHits: { code: string; level: RiskLevel; message: string }[];

  @Column({ default: '' })
  notes: string;

  /** 复查标记：整改后复查 */
  @Column({ default: false })
  isRecheck: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

/* ============ 乡镇复核 ============ */

@Entity('reviews')
export class ReviewRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  houseId: string;

  @Column({ type: 'uuid' })
  inspectionId: string;

  @Column({ type: 'uuid' })
  reviewerId: string;

  @Column()
  reviewerName: string;

  /** 确认 / 调整等级 / 退回补充 */
  @Column()
  action: string;

  @Column({ type: 'enum', enum: RiskLevel })
  confirmedLevel: RiskLevel;

  @Column({ default: '' })
  opinion: string;

  @CreateDateColumn()
  createdAt: Date;
}

/* ============ 整改方案 ============ */

export interface PlanItem {
  key: string;
  title: string; // 拆除违建加层/加固承重墙/修复屋面/清退经营租户/设置警示/临时安置
  requiredCrewLevel?: string; // 所需施工队资质
  done?: boolean; // 施工完成标记
}

@Entity('rectification_plans')
export class RectificationPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  houseId: string;

  @Column({ type: 'uuid' })
  reviewId: string;

  @Column({ type: 'jsonb' })
  items: PlanItem[];

  @Column({ type: 'date' })
  deadline: string;

  @Column({ default: false })
  stopUseRequired: boolean;

  @Column({ default: false })
  resettlementRequired: boolean;

  @Column({ type: 'uuid' })
  createdById: string;

  @Column()
  createdByName: string;

  @Column({ default: '' })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;
}

/* ============ 告知记录（风险告知/停用/转移/补助决定，可拒签留痕） ============ */

@Entity('notifications')
export class NotifyRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  houseId: string;

  /** 风险告知书 / 暂停使用通知 / 限期整改通知书 / 紧急转移通知 / 补助核定决定 / 验收结果告知 */
  @Column()
  type: string;

  @Column({ type: 'text', default: '' })
  content: string;

  /** 待签收 / 已签收 / 拒绝签收（留置送达） */
  @Column({ default: '待签收' })
  signStatus: string;

  @Column({ default: '' })
  signer: string; // 签收人（户主/家属）

  @Column({ default: '' })
  method: string; // 当面/留置/公告

  @Column({ type: 'uuid' })
  createdById: string;

  @Column()
  createdByName: string;

  @CreateDateColumn()
  createdAt: Date;
}

/* ============ 临时安置 ============ */

@Entity('resettlements')
export class Resettlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  houseId: string;

  @Column({ type: 'int' })
  persons: number;

  /** 投亲靠友 / 集中安置点 / 租赁补贴 */
  @Column()
  arrangement: string;

  @Column({ default: '' })
  membersDetail: string; // 含老人、租户、经营者等非户主决策人情况

  /** 拟安置 / 已转移 / 已返回 */
  @Column({ default: '拟安置' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  transferredAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  returnedAt: Date | null;

  @Column({ default: '' })
  note: string;

  @CreateDateColumn()
  createdAt: Date;
}

/* ============ 补助申请 ============ */

export interface BudgetItem {
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

export interface SubsidyCheck {
  code: string;
  label: string;
  passed: boolean;
  detail: string;
}

@Entity('subsidy_applications')
export class SubsidyApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  houseId: string;

  @Column()
  applicantName: string;

  @Column({ type: 'enum', enum: DifficultyType })
  difficultyType: DifficultyType;

  @Column({ default: false })
  difficultyProof: boolean; // 困难证明材料

  @Column({ default: false })
  ownershipProof: boolean; // 权属证明材料

  @Column({ type: 'jsonb', default: () => "'[]'" })
  budgetItems: BudgetItem[];

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  approvedAmount: number;

  @Column({ type: 'uuid', nullable: true })
  crewId: string | null;

  @Column({ type: 'enum', enum: SubsidyStatus, default: SubsidyStatus.DRAFT })
  status: SubsidyStatus;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  checks: SubsidyCheck[];

  @Column({ type: 'uuid', nullable: true })
  townshipReviewerId: string | null;

  @Column({ default: '' })
  townshipOpinion: string;

  @Column({ type: 'uuid', nullable: true })
  countyReviewerId: string | null;

  @Column({ default: '' })
  countyOpinion: string;

  @Column({ default: false })
  disbursed: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  disbursedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}

/* ============ 施工日志（材料/照片/阶段进度，可举证偷换材料） ============ */

export interface MaterialProof {
  name: string;
  brand: string;
  spec: string;
  batch: string;
  qty: number;
  cert: string; // 合格证明/检测报告
  matchedSpec?: boolean; // 是否与方案约定一致（验收/巡查比对）
}

@Entity('construction_logs')
export class ConstructionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  houseId: string;

  /** 材料进场 / 拆除加层 / 承重墙加固 / 屋面修复 / 主体施工 / 竣工自查 */
  @Column()
  stage: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  materials: MaterialProof[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  photos: string[];

  @Column({ type: 'uuid' })
  createdById: string;

  @Column()
  createdByName: string;

  @CreateDateColumn()
  createdAt: Date;
}

/* ============ 验收（按整改项逐条确认） ============ */

@Entity('acceptances')
export class Acceptance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  houseId: string;

  @Column({ type: 'int', default: 1 })
  round: number;

  /** 通过 / 不通过 */
  @Column()
  result: string;

  @Column({ type: 'jsonb' })
  items: {
    key: string;
    title: string;
    passed: boolean;
    note: string;
  }[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  photos: string[];

  @Column({ type: 'uuid' })
  inspectorId: string;

  @Column()
  inspectorName: string;

  @Column({ default: '' })
  opinion: string;

  @CreateDateColumn()
  createdAt: Date;
}

/* ============ 异常/协商事件（基层协商成本留痕） ============ */

export interface ConsultationNote {
  at: string;
  participants: string; // 村干部/老人家庭成员/租户/经营者/施工队
  content: string;
}

@Entity('issues')
export class Issue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  houseId: string;

  @Column({ type: 'enum', enum: IssueType })
  type: IssueType;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: IssueStatus, default: IssueStatus.OPEN })
  status: IssueStatus;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  consultations: ConsultationNote[];

  @Column({ type: 'text', default: '' })
  resolution: string;

  @Column({ type: 'uuid' })
  reportedById: string;

  @Column()
  reportedByName: string;

  @CreateDateColumn()
  createdAt: Date;
}

/* ============ 销号 ============ */

@Entity('closures')
export class Closure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  houseId: string;

  /** 申请销号 / 已销号 / 反弹重开 / 驳回 */
  @Column()
  status: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  prechecks: { code: string; label: string; passed: boolean; detail: string }[];

  @Column({ type: 'uuid', nullable: true })
  approvedById: string | null;

  @Column({ default: '' })
  approverName: string;

  @Column({ default: '' })
  opinion: string;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}

export const ALL_ENTITIES = [
  User,
  ConstructionCrew,
  House,
  Inspection,
  ReviewRecord,
  RectificationPlan,
  NotifyRecord,
  Resettlement,
  SubsidyApplication,
  ConstructionLog,
  Acceptance,
  Issue,
  Closure,
];
