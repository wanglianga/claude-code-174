<template>
  <div>
    <el-card class="section-card">
      <div class="bar">
        <h3 style="margin:0">治理看板</h3>
        <div style="display:flex;gap:10px;align-items:center">
          <el-select v-if="auth.isCounty" v-model="township" placeholder="全县" clearable style="width:160px" @change="load">
            <el-option v-for="r in rows" :key="r.township" :label="r.township" :value="r.township" />
          </el-select>
          <el-button :icon="Refresh" @click="load">刷新</el-button>
        </div>
      </div>
      <el-row :gutter="14" style="margin-top:12px">
        <el-col :span="6"><el-statistic title="房屋档案总数" :value="data.totals?.houses || 0" /></el-col>
        <el-col :span="6"><el-statistic title="已销号 / 销号率" :value="data.totals?.closed || 0"><template #suffix>套 / {{ ((data.totals?.closureRate||0)*100).toFixed(0) }}%</template></el-statistic></el-col>
        <el-col :span="6"><el-statistic title="反弹重开" :value="data.totals?.rebound || 0" /></el-col>
        <el-col :span="6"><el-statistic title="未化解事项" :value="data.issues?.open || 0" /></el-col>
      </el-row>
    </el-card>

    <el-row :gutter="14">
      <el-col :span="8">
        <el-card class="section-card" header="风险等级分布">
          <div v-for="(v, k) in data.riskDistribution" :key="k" class="dist-row">
            <el-tag :type="riskType[k]" size="small">{{ riskLabel[k] }}</el-tag>
            <el-progress :percentage="pct(v)" :stroke-width="14" :format="() => v + ' 套'" style="flex:1" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="section-card" header="高风险是否真正停用">
          <template v-if="data.highRiskControl">
            <p>暂停使用/紧急转移房屋：<b>{{ data.highRiskControl.highRiskTotal }}</b> 套；
              已现场封停确认：<b class="check-pass">{{ data.highRiskControl.stopUseConfirmed }}</b></p>
            <p>紧急转移：应转移 <b>{{ data.highRiskControl.evacuateTotal }}</b> 套，
              已实际转移 <b class="check-pass">{{ data.highRiskControl.evacuated }}</b>，
              验收后返回 {{ data.highRiskControl.returnedAfterAcceptance }}</p>
            <el-alert v-if="data.highRiskControl.notStopped.length" type="error" :closable="false"
              :title="`${data.highRiskControl.notStopped.length} 套高风险房屋尚未封停停用`">
              <div v-for="h in data.highRiskControl.notStopped" :key="h.code" style="font-size:12px">
                {{ h.code }} {{ h.address }}（{{ riskLabel[h.riskLevel] }} / {{ statusLabel[h.status] }}）
              </div>
            </el-alert>
            <el-alert v-else type="success" :closable="false" title="高风险房屋均已封停确认" />
          </template>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="section-card" header="补助是否发给符合条件家庭">
          <template v-if="data.subsidy">
            <div class="kv">
              <span><b>已申请</b>{{ data.subsidy.applied }} 件</span>
              <span><b>审核中</b>{{ data.subsidy.inReview }} 件</span>
              <span><b>核定通过</b>{{ data.subsidy.approved }} 件</span>
              <span><b>已驳回</b>{{ data.subsidy.rejected }} 件</span>
              <span><b>已发放</b>{{ data.subsidy.disbursed }} 件</span>
              <span><b>已发金额</b>¥{{ data.subsidy.disbursedAmount }}</span>
            </div>
          </template>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="section-card" header="按乡镇治理进度">
      <el-table :data="rows" size="small" stripe>
        <el-table-column prop="township" label="乡镇" width="100" />
        <el-table-column label="房屋/销号">
          <template #default="{ row }">{{ row.houses }} / {{ row.closed }}</template>
        </el-table-column>
        <el-table-column label="风险结构（关注/整改/停用/转移）">
          <template #default="{ row }">{{ row.risk.WATCH }} / {{ row.risk.FIX }} / {{ row.risk.STOP }} / {{ row.risk.EVACUATE }}</template>
        </el-table-column>
        <el-table-column label="整改中" prop="rectifying" width="70" />
        <el-table-column label="验收不通过" prop="acceptanceFail" width="90" />
        <el-table-column label="高风险封停">
          <template #default="{ row }">
            <el-tag :type="row.highRiskTotal===row.highRiskStopped ? 'success':'danger'" size="small">
              {{ row.highRiskStopped }}/{{ row.highRiskTotal }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="已转移" prop="evacuated" width="70" />
        <el-table-column label="未决事项" prop="openIssues" width="90" />
        <el-table-column label="补助核定/发放">
          <template #default="{ row }">{{ row.subsidyApproved }} / {{ row.subsidyDisbursed }}</template>
        </el-table-column>
        <el-table-column label="已发补助金额">
          <template #default="{ row }">¥{{ row.subsidyAmount }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import api from '../api';
import { RISK_LABEL as riskLabel, RISK_TYPE as riskType, STATUS_LABEL as statusLabel } from '../dict';
import { useAuth } from '../store';

const auth = useAuth();
const data = reactive({});
const rows = ref([]);
const township = ref('');

async function load() {
  const q = township.value ? `?township=${encodeURIComponent(township.value)}` : '';
  const ov = await api.get('/dashboard/overview' + q);
  Object.keys(data).forEach((k) => delete data[k]);
  Object.assign(data, ov);
  if (auth.isCounty) rows.value = await api.get('/dashboard/by-township');
}
function pct(v) {
  const total = data.totals?.houses || 0;
  return total ? Math.round((v / total) * 100) : 0;
}
onMounted(async () => {
  await load();
  if (!auth.isCounty) {
    // 乡镇也展示本乡镇单行（overview 已有数据），这里复用 by-township 会 403，跳过
  }
});
</script>

<style scoped>
.bar { display: flex; justify-content: space-between; align-items: center; }
.dist-row { display: flex; align-items: center; gap: 10px; margin: 8px 0; }
.dist-row .el-tag { width: 76px; justify-content: center; }
</style>
