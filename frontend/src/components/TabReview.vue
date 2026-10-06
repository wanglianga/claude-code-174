<template>
  <div>
    <el-alert v-for="p in archive.plans" :key="p.id" :closable="false" class="blk"
      :title="`第${archive.plans.indexOf(p)+1}轮方案 · ${RISK[p.decision].label} · 期限 ${fmtDay(p.deadline)} · ${p.reviewedAt ? fmtDate(p.reviewedAt) : ''}`"
      :type="p.decision==='EVACUATE'?'error':p.decision==='SUSPEND'?'warning':''">
      <div>{{ p.requirement }}</div>
          <el-tag size="small" :type="p.stopUseRequired?'danger':'info'" style="margin:4px 6px 0 0">要求停用：{{ p.stopUseRequired ? '是' : '否' }}</el-tag>
          <el-tag size="small" :type="p.evacuationRequired?'danger':'info'">要求转移：{{ p.evacuationRequired ? '是' : '否' }}</el-tag>
          <el-table :data="p.items" size="small" border style="margin-top:8px">
            <el-table-column label="整改项" width="160">
              <template #default="{ row }">{{ ITEM_TYPES[row.type] }}</template>
            </el-table-column>
            <el-table-column prop="description" label="具体要求" min-width="220" />
            <el-table-column label="施工状态" width="110">
              <template #default="{ row }">
                <el-select v-model="row.status" size="small" :disabled="!canItemEdit" @change="setStatus(row)">
                  <el-option v-for="(v,k) in ITEM_STATUS" :key="k" :label="v.label" :value="k" />
                </el-select>
              </template>
            </el-table-column>
          </el-table>
    </el-alert>

    <el-card v-if="canReview" shadow="never" class="form-card">
      <template #header>{{ archive.plans.length ? '反弹后重新复核（新方案）' : '乡镇复核：确认风险并下达整改方案' }}</template>
      <el-form label-width="120px" size="default">
        <el-form-item label="依据巡查记录">
          <el-select v-model="form.inspectionId" style="width:320px">
            <el-option v-for="i in archive.inspections" :key="i.id"
              :label="`${fmtDate(i.inspectedAt)} · ${RISK[i.riskLevel].label}`" :value="i.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="复核风险结论">
          <el-radio-group v-model="form.decision">
            <el-radio-button v-for="(v,k) in RISK" :key="k" :value="k">{{ v.label }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="整改期限"><el-date-picker v-model="form.deadline" type="date" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item label="必改措施">
          <el-checkbox-group v-model="form.itemTypes">
            <el-checkbox v-for="(lab,k) in ITEM_TYPES" :key="k" :value="k" :label="k">{{ lab }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="具体要求"><el-input v-model="form.requirement" type="textarea" :rows="2" placeholder="整改总体要求，将同步进入风险告知书" /></el-form-item>
        <el-form-item>
          <el-button type="primary" @click="submit">下达整改方案</el-button>
          <span class="hint">暂停使用/紧急转移结论会自动要求先停用、先转移；方案是后续告知、开工、验收、销号的总依据。</span>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive } from 'vue';
import { ElMessage } from 'element-plus';
import http from '../api';
import { RISK, ITEM_TYPES, ITEM_STATUS, fmtDate, fmtDay } from '../labels';
import { useAuthStore } from '../store';
const props = defineProps(['archive']);
const emit = defineEmits(['reload']);
const auth = useAuthStore();
const canReview = ['TOWNSHIP_REVIEWER', 'COUNTY_ADMIN'].includes(auth.role);
const canItemEdit = ['TOWNSHIP_REVIEWER', 'ACCEPTOR', 'COUNTY_ADMIN'].includes(auth.role);

const DEFAULT_DESC = {
  REMOVE_ILLEGAL_FLOOR: '拆除违法违规加层部分并清运',
  REINFORCE_WALL: '对承重墙体进行加固处理',
  REPAIR_ROOF: '重做屋面防水、修复破损构件',
  EVICT_TENANTS: '清退经营户与租户，消除人员聚集',
  SET_WARNING: '设置危房警示标志和围挡',
  TEMP_RESETTLEMENT: '安排居住人员临时安置',
};
const form = reactive({ inspectionId: '', decision: 'RECTIFY', deadline: '', itemTypes: ['REINFORCE_WALL'], requirement: '' });

async function submit() {
  if (!form.inspectionId) return ElMessage.warning('请选择巡查记录');
  if (!form.itemTypes.length) return ElMessage.warning('至少选择一项必改措施');
  await http.post('/api/reviews', {
    inspectionId: form.inspectionId,
    decision: form.decision,
    deadline: form.deadline,
    requirement: form.requirement,
    items: form.itemTypes.map((t) => ({ type: t, description: DEFAULT_DESC[t] })),
  });
  ElMessage.success('整改方案已下达');
  emit('reload');
}
async function setStatus(row) {
  await http.post(`/api/rectification-items/${row.id}/status`, { status: row.status });
  ElMessage.success('整改项状态已更新');
  emit('reload');
}
</script>
<style scoped>
.blk { margin-bottom:12px; }
.form-card { margin-top:14px; }
.hint { color:#909caa; font-size:12px; margin-left:10px; }
</style>
