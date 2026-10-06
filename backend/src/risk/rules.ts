import { RiskLevel, Severity } from '../entities';

export interface RiskInput {
  buildYear: number | null;
  floors: number | null;
  usage: string;
  isBusiness: boolean;
  isRented: boolean;
  isAddedFloor: boolean;
  wallCracks: Severity;
  roofLeak: Severity;
  foundationSettlement: Severity;
  residents: number;
  structure: string;
}

export interface RuleHit {
  code: string;
  level: RiskLevel;
  message: string;
}

const LEVEL_WEIGHT: Record<RiskLevel, number> = {
  [RiskLevel.WATCH]: 1,
  [RiskLevel.FIX]: 2,
  [RiskLevel.STOP]: 3,
  [RiskLevel.EVACUATE]: 4,
};

/**
 * 风险规则引擎：命中多条规则时取最高等级。
 * 紧急转移 > 暂停使用 > 限期整改 > 一般关注
 */
export function evaluateRisk(input: RiskInput): {
  level: RiskLevel;
  hits: RuleHit[];
} {
  const hits: RuleHit[] = [];
  const crowded = input.isBusiness || input.isRented;
  const oldHouse = input.buildYear != null && input.buildYear < 1990;

  if (input.foundationSettlement === Severity.SEVERE) {
    hits.push({
      code: 'R-EVAC-01',
      level: RiskLevel.EVACUATE,
      message: '地基出现严重沉降，房屋存在整体失稳风险，建议立即紧急转移居住人员',
    });
  }
  if (input.isAddedFloor && input.floors != null && input.floors >= 4) {
    hits.push({
      code: 'R-EVAC-02',
      level: RiskLevel.EVACUATE,
      message: `擅自加层至${input.floors}层，远超原结构承载，建议立即停用并紧急转移`,
    });
  }
  if (input.wallCracks === Severity.SEVERE && input.isAddedFloor) {
    hits.push({
      code: 'R-EVAC-03',
      level: RiskLevel.EVACUATE,
      message: '承重墙严重开裂且存在擅自加层，坍塌风险高，建议立即紧急转移',
    });
  }
  if (input.wallCracks === Severity.SEVERE) {
    hits.push({
      code: 'R-STOP-01',
      level: RiskLevel.STOP,
      message: '墙体严重开裂，建议暂停使用并限期加固承重墙',
    });
  }
  if (crowded && input.roofLeak === Severity.SEVERE) {
    hits.push({
      code: 'R-STOP-02',
      level: RiskLevel.STOP,
      message: '房屋用于经营/出租且屋面严重渗漏，人员密集，建议暂停使用',
    });
  }
  if (crowded && (oldHouse || input.structure === '土木')) {
    hits.push({
      code: 'R-STOP-03',
      level: RiskLevel.STOP,
      message: '经营/出租房屋为老旧土木结构或建成年限过长，建议暂停使用并鉴定',
    });
  }
  if (input.isAddedFloor) {
    hits.push({
      code: 'R-FIX-01',
      level: RiskLevel.FIX,
      message: '存在擅自加层，限期拆除违建加层并恢复原结构',
    });
  }
  if (input.roofLeak === Severity.SEVERE) {
    hits.push({
      code: 'R-FIX-02',
      level: RiskLevel.FIX,
      message: '屋面严重渗漏，限期修复屋面防水',
    });
  }
  if (
    input.wallCracks === Severity.MINOR ||
    input.roofLeak === Severity.MINOR ||
    input.foundationSettlement === Severity.MINOR
  ) {
    hits.push({
      code: 'R-WATCH-01',
      level: RiskLevel.WATCH,
      message: '存在轻微裂缝/渗漏/沉降迹象，列入一般关注并定期复查',
    });
  }

  let level = RiskLevel.WATCH;
  for (const h of hits) {
    if (LEVEL_WEIGHT[h.level] > LEVEL_WEIGHT[level]) level = h.level;
  }
  if (hits.length === 0) {
    hits.push({
      code: 'R-WATCH-00',
      level: RiskLevel.WATCH,
      message: '本次巡查未发现明显隐患，列入一般关注台账',
    });
  }
  return { level, hits };
}
