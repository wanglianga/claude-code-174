<template>
  <el-card>
    <div class="bar">
      <h3 style="margin:0">异常事项与基层协商</h3>
      <div style="display:flex;gap:8px">
        <el-select v-model="status" placeholder="全部状态" clearable style="width:130px" @change="load">
          <el-option v-for="(l,k) in issueStatusLabel" :key="k" :label="l" :value="k" />
        </el-select>
        <el-select v-model="type" placeholder="全部类型" clearable style="width:160px" @change="load">
          <el-option v-for="(l,k) in issueLabel" :key="k" :label="l" :value="k" />
        </el-select>
        <el-button @click="load">查询</el-button>
      </div>
    </div>
    <el-table :data="items" stripe style="margin-top:12px">
      <el-table-column prop="houseCode" label="房屋档案" width="140">
        <template #default="{ row }"><el-link type="primary" @click="$router.push(`/houses/${row.houseId}`)">{{ row.houseCode }}</el-link></template>
      </el-table-column>
      <el-table-column prop="township" label="乡镇" width="90" />
      <el-table-column label="风险" width="100">
        <template #default="{ row }"><el-tag size="small" :type="riskType[row.riskLevel]">{{ riskLabel[row.riskLevel] }}</el-tag></template>
      </el-table-column>
      <el-table-column label="事项类型" width="150">
        <template #default="{ row }">{{ issueLabel[row.type] }}</template>
      </el-table-column>
      <el-table-column prop="description" label="情况描述" min-width="220" show-overflow-tooltip />
      <el-table-column label="协商次数" width="90">
        <template #default="{ row }">{{ row.consultations?.length || 0 }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }"><el-tag size="small" :type="issueStatusType[row.status]">{{ issueStatusLabel[row.status] }}</el-tag></template>
      </el-table-column>
      <el-table-column label="上报人/时间" width="170">
        <template #default="{ row }">
          <div style="font-size:12px">{{ row.reportedByName }}</div>
          <div style="font-size:12px;color:#909399">{{ fmt(row.createdAt) }}</div>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import api from '../api';
import {
  RISK_LABEL as riskLabel, RISK_TYPE as riskType,
  ISSUE_LABEL as issueLabel,
  ISSUE_STATUS_LABEL as issueStatusLabel, ISSUE_STATUS_TYPE as issueStatusType,
} from '../dict';

const items = ref([]);
const status = ref('');
const type = ref('');
function fmt(t) { return new Date(t).toLocaleString('zh-CN', { hour12: false }); }

async function load() {
  items.value = await api.get('/issues', { params: { status: status.value, type: type.value } });
}
onMounted(load);
</script>

<style scoped>
.bar { display: flex; justify-content: space-between; }
</style>
