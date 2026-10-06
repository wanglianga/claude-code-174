<template>
  <el-card>
    <div class="bar">
      <h3 style="margin:0">补助申请审核核定</h3>
      <el-select v-model="status" placeholder="全部环节" clearable style="width:150px" @change="load">
        <el-option v-for="(l,k) in subsidyLabel" :key="k" :label="l" :value="k" />
      </el-select>
    </div>
    <el-table :data="items" stripe style="margin-top:12px">
      <el-table-column label="房屋" min-width="160">
        <template #default="{ row }"><el-link type="primary" @click="openHouse(row.houseId)">查看房屋档案</el-link></template>
      </el-table-column>
      <el-table-column prop="applicantName" label="申请人" width="100" />
      <el-table-column label="困难类型" width="170">
        <template #default="{ row }">{{ diffLabel[row.difficultyType] }}</template>
      </el-table-column>
      <el-table-column label="申请/核定金额" width="150">
        <template #default="{ row }">¥{{ row.totalAmount }} / <b>¥{{ row.approvedAmount }}</b></template>
      </el-table-column>
      <el-table-column label="校验不通过项" min-width="200">
        <template #default="{ row }">
          <el-tag v-for="c in row.checks.filter(x=>!x.passed)" :key="c.code" size="small" type="danger" style="margin:2px">{{ c.label }}</el-tag>
          <span v-if="row.checks.every(x=>x.passed)" class="check-pass">四项校验均通过</span>
        </template>
      </el-table-column>
      <el-table-column label="环节" width="120">
        <template #default="{ row }">
          <el-tag size="small" :type="subsidyType[row.status]">{{ subsidyLabel[row.status] }}</el-tag>
          <el-tag v-if="row.disbursed" size="small" type="success" style="margin-left:4px">已发放</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-button v-if="row.status==='TOWNSHIP_REVIEW' && auth.isTownship" link type="primary" @click="$router.push(`/houses/${row.houseId}`)">去初审</el-button>
          <el-button v-if="row.status==='COUNTY_REVIEW' && auth.isCounty" link type="primary" @click="$router.push(`/houses/${row.houseId}`)">去核定</el-button>
          <el-button v-if="row.status==='APPROVED' && !row.disbursed && auth.isCounty" link type="success" @click="disburse(row)">发放</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '../api';
import {
  DIFFICULTY_LABEL as diffLabel,
  SUBSIDY_STATUS_LABEL as subsidyLabel, SUBSIDY_STATUS_TYPE as subsidyType,
} from '../dict';
import { useAuth } from '../store';

const auth = useAuth();
const router = useRouter();
const items = ref([]);
const status = ref('');

async function load() {
  items.value = await api.get('/subsidy-applications', { params: { status: status.value } });
}
function openHouse(id) { router.push(`/houses/${id}`); }
async function disburse(row) {
  await api.post(`/subsidies/${row.id}/disburse`, {});
  ElMessage.success('补助已发放');
  load();
}
onMounted(load);
</script>

<style scoped>
.bar { display: flex; justify-content: space-between; }
</style>
