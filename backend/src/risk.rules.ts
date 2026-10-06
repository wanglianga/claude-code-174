import {
  House,
  Inspection,
  RiskLevel,
} from './entities';

export interface RiskInput {
  buildYear: number;
  floors: number;
  isBusiness: boolean;
  isRented: boolean;
  isAddedFloor: boolean;
  wallCrack: number; // 0/1/2
  roofLeak: number;
  foundationSettlement: number;
  residents: number;
  rainSeason?: boolean;
}

const LABELS: Record<string, string> = {
  age: '房龄超过30年，构件老化风险高',
  floors: '层数达到3层及以上（自建房高风险特征）',
  crack2: '墙体裂缝严重（结构性开裂）',
  crack1: '墙体存在明显裂缝',
  settlement2: '地基沉降严重（倾斜风险）',
  settlement1: '存在明显地基沉降迹象',
  addedFloor: '存在加层且为自建加层，超载隐患突出',
  business: '房屋用于经营，人员聚集',
  rented: '房屋对外出租，安全责任关系复杂',
  roof: '屋面渗漏严重',
  residents: '居住人数较多（≥6人）',
  rain: '雨季/强降雨后险情加重',
};

/**
 * 风险规则：
 *  紧急转移：地基沉降严重 / 墙体严重裂缝 + 加层 / 雨季任一严重结构项
 *  暂停使用：加层、经营/出租叠加结构隐患、两项明显结构缺陷
 *  限期整改：任一明显结构缺陷、严重渗漏、高房龄多层等
 *  一般关注：仅老旧、渗漏轻微、经营出租登记等
 */
export function evaluateRisk(input: RiskInput): { level: RiskLevel; reasons: string[] } {
  const reasons: string[] = [];
  const age = new Date().getFullYear() - input.buildYear;
  if (age > 30) reasons.push(LABELS.age);
  if (input.floors >= 3) reasons.push(LABELS.floors);
  if (input.wallCrack === 2) reasons.push(LABELS.crack2);
  else if (input.wallCrack === 1) reasons.push(LABELS.crack1);
  if (input.foundationSettlement === 2) reasons.push(LABELS.settlement2);
  else if (input.foundationSettlement === 1) reasons.push(LABELS.settlement1);
  if (input.isAddedFloor) reasons.push(LABELS.addedFloor);
  if (input.isBusiness) reasons.push(LABELS.business);
  if (input.isRented) reasons.push(LABELS.rented);
  if (input.roofLeak === 2) reasons.push(LABELS.roof);
  if (input.residents >= 6) reasons.push(LABELS.residents);
  if (input.rainSeason) reasons.push(LABELS.rain);

  const structuralSevere = input.wallCrack === 2 || input.foundationSettlement === 2;
  const structuralAny = structuralSevere || input.wallCrack === 1 || input.foundationSettlement === 1;
  const occupancyRisk = (input.isBusiness || input.isRented || input.floors >= 3 || input.residents >= 6);

  let level = RiskLevel.NORMAL;

  if (
    input.foundationSettlement === 2 ||
    (input.wallCrack === 2 && input.isAddedFloor) ||
    (input.rainSeason && structuralSevere) ||
    (structuralSevere && occupancyRisk && input.residents > 0)
  ) {
    level = RiskLevel.EVACUATE;
  } else if (
    input.isAddedFloor ||
    (structuralAny && occupancyRisk) ||
    (input.wallCrack === 1 && input.foundationSettlement === 1) ||
    (input.rainSeason && structuralAny)
  ) {
    level = RiskLevel.SUSPEND;
  } else if (
    structuralAny ||
    input.roofLeak === 2 ||
    (age > 30 && input.floors >= 3) ||
    (age > 40 && occupancyRisk)
  ) {
    level = RiskLevel.RECTIFY;
  } else if (reasons.length > 0) {
    level = RiskLevel.NORMAL;
  }

  if (reasons.length === 0) reasons.push('未发现明显风险因素，纳入日常关注');
  return { level, reasons };
}

export function riskInputFromHouse(h: House): RiskInput {
  return {
    buildYear: h.buildYear,
    floors: h.floors,
    isBusiness: h.isBusiness,
    isRented: h.isRented,
    isAddedFloor: h.isAddedFloor,
    wallCrack: h.wallCrack,
    roofLeak: h.roofLeak,
    foundationSettlement: h.foundationSettlement,
    residents: h.residents,
  };
}

export function riskInputFromInspection(i: Inspection): RiskInput {
  return {
    buildYear: i.buildYear,
    floors: i.floors,
    isBusiness: i.isBusiness,
    isRented: i.isRented,
    isAddedFloor: i.isAddedFloor,
    wallCrack: i.wallCrack,
    roofLeak: i.roofLeak,
    foundationSettlement: i.foundationSettlement,
    residents: i.residents,
    rainSeason: i.rainSeason,
  };
}
