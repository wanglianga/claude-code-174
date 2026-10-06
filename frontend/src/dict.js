export const RISK_LABEL = {
  WATCH: '一般关注',
  FIX: '限期整改',
  STOP: '暂停使用',
  EVACUATE: '紧急转移',
};

export const RISK_TYPE = {
  WATCH: 'info',
  FIX: 'warning',
  STOP: 'danger',
  EVACUATE: 'danger',
};

export const STATUS_LABEL = {
  INSPECTED: '已巡查待复核',
  REVIEWED: '已复核待方案',
  PLANNED: '方案已下达',
  RECTIFYING: '整改中',
  ACCEPTANCE_FAIL: '验收不通过',
  PENDING_CLOSURE: '待县级销号',
  CLOSED: '已销号',
  REBOUND: '反弹/重开待巡查',
};

export const STATUS_TYPE = {
  INSPECTED: 'info',
  REVIEWED: '',
  PLANNED: 'warning',
  RECTIFYING: 'primary',
  ACCEPTANCE_FAIL: 'danger',
  PENDING_CLOSURE: 'warning',
  CLOSED: 'success',
  REBOUND: 'danger',
};

export const SEVERITY_LABEL = { NONE: '无', MINOR: '轻微', SEVERE: '严重' };
export const SEVERITY_TYPE = { NONE: 'success', MINOR: 'warning', SEVERE: 'danger' };

export const DIFFICULTY_LABEL = {
  NONE: '无困难类型',
  DIBAO: '低保户',
  TEKUN: '特困供养户',
  TUOPIN: '脱贫不稳定/边缘易致贫户',
  DISASTER_ILLNESS: '因灾因病因学突发严重困难户',
};

export const SUBSIDY_STATUS_LABEL = {
  DRAFT: '草稿',
  TOWNSHIP_REVIEW: '乡镇初审中',
  COUNTY_REVIEW: '县级核定中',
  APPROVED: '核定通过',
  REJECTED: '已驳回',
};

export const SUBSIDY_STATUS_TYPE = {
  DRAFT: 'info',
  TOWNSHIP_REVIEW: 'warning',
  COUNTY_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

export const ISSUE_LABEL = {
  REFUSE_FIX: '农户拒绝整改',
  MATERIAL_FRAUD: '施工队偷换材料',
  SUBSIDY_DISPUTE: '补助资格争议',
  RAIN_ESCALATION: '雨季风险加重',
  TENANT_REFUSE: '租户不愿搬离',
  ACCEPTANCE_FAIL: '验收不通过',
  REBOUND: '复查问题反弹',
  OTHER: '其他事项',
};

export const ISSUE_STATUS_LABEL = { OPEN: '待处理', PROCESSING: '协商中', RESOLVED: '已化解' };
export const ISSUE_STATUS_TYPE = { OPEN: 'danger', PROCESSING: 'warning', RESOLVED: 'success' };

export const ROLE_LABEL = {
  GRID: '网格员',
  TOWNSHIP: '乡镇住建人员',
  COUNTY: '县级主管部门',
  FARMER: '农户',
  CREW: '施工队',
};
