<template>
  <el-card>
    <div class="bar">
      <h3 style="margin:0">房屋档案</h3>
      <div style="display:flex;gap:8px">
        <el-input v-model="query.keyword" placeholder="档案号/地址/户主" clearable style="width:200px" @keyup.enter="load" />
        <el-select v-model="query.township" placeholder="乡镇" clearable style="width:120px" @change="load">
          <el-option v-if="auth.isCounty || auth.isTownship" v-for="t in townships" :key="t" :label="t" :value="t" />
        </el-select>
        <el-select v-model="query.riskLevel" placeholder="风险类型" clearable style="width:130px" @change="load">
          <el-option v-for="(l,k) in riskLabel" :key="k" :label="l" :value="k" />
        </el-select>
        <el-select v-model="query.status" placeholder="治理状态" clearable style="width:140px" @change="load">
          <el-option v-for="(l,k) in statusLabel" :key="k" :label="l" :value="k" />
        </el-select>
        <el-button @click="load">查询</el-button>
        <el-button v-if="auth.isGrid" type="primary" @click="openCreate">＋ 巡查登记（建档）</el-button>
      </div>
    </div>

    <el-table :data="items" stripe style="margin-top:12px" @row-click="(r)=>$router.push(`/houses/${r.id}`)" row-class-name="clickable">
      <el-table-column prop="code" label="档案号" width="140" />
      <el-table-column label="乡镇/村组">
        <template #default="{ row }">{{ row.township }} · {{ row.village }}</template>
      </el-table-column>
      <el-table-column prop="address" label="地址" min-width="160" />
      <el-table-column prop="ownerName" label="户主" width="90" />
      <el-table-column label="用途" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.isBusiness" size="small" type="danger" effect="plain">经营</el-tag>
          <el-tag v-if="row.isRented" size="small" type="warning" effect="plain">出租</el-tag>
          <span v-if="!row.isBusiness && !row.isRented">自住</span>
        </template>
      </el-table-column>
      <el-table-column label="隐患">
        <template #default="{ row }">
          <el-tag v-if="row.isAddedFloor" size="small" type="danger">加层</el-tag>
          <el-tag v-if="row.wallCracks!=='NONE'" size="small" :type="sevType[row.wallCracks]">墙裂{{sevLabel[row.wallCracks]}}</el-tag>
          <el-tag v-if="row.roofLeak!=='NONE'" size="small" :type="sevType[row.roofLeak]">渗漏{{sevLabel[row.roofLeak]}}</el-tag>
          <el-tag v-if="row.foundationSettlement!=='NONE'" size="small" :type="sevType[row.foundationSettlement]">沉降{{sevLabel[row.foundationSettlement]}}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="风险" width="100">
        <template #default="{ row }"><el-tag :type="riskType[row.riskLevel]">{{ riskLabel[row.riskLevel] }}</el-tag></template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }"><el-tag :type="statusType[row.status]" effect="plain">{{ statusLabel[row.status] }}</el-tag></template>
      </el-table-column>
    </el-table>
    <el-pagination style="margin-top:10px;justify-content:flex-end" layout="total, prev, pager, next" :total="total" :page-size="query.size" v-model:current-page="query.page" @current-change="load" />

    <!-- 巡查登记 -->
    <el-dialog v-model="creating" title="网格员巡查登记（自动建档 + 风险判定）" width="760px">
      <el-form :model="form" label-width="110px">
        <el-divider content-position="left">房屋位置与权属</el-divider>
        <el-row :gutter="10">
          <el-col :span="8"><el-form-item label="乡镇" required><el-input v-model="form.township" :placeholder="auth.user?.township || '青山镇'" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="村/社区" required><el-input v-model="form.village" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="户主姓名" required><el-input v-model="form.ownerName" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="详细地址" required><el-input v-model="form.address" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="经度"><el-input v-model="form.lng" placeholder="110.42" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="纬度"><el-input v-model="form.lat" placeholder="31.15" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="联系电话"><el-input v-model="form.ownerPhone" /></el-form-item></el-col>
        </el-row>
        <el-divider content-position="left">房屋状况</el-divider>
        <el-row :gutter="10">
          <el-col :span="6"><el-form-item label="建成年份" required><el-input-number v-model="form.buildYear" :min="1950" :max="2026" controls-position="right" style="width:100%" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="层数" required><el-input-number v-model="form.floors" :min="1" :max="10" controls-position="right" style="width:100%" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="居住人数" required><el-input-number v-model="form.residents" :min="0" :max="200" controls-position="right" style="width:100%" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="结构形式">
            <el-select v-model="form.structure" style="width:100%"><el-option label="砖混" value="砖混"/><el-option label="砖木" value="砖木"/><el-option label="土木" value="土木"/><el-option label="框架" value="框架"/></el-select>
          </el-form-item></el-col>
          <el-col :span="6"><el-form-item label="使用用途">
            <el-select v-model="form.usage" style="width:100%"><el-option label="自住" value="自住"/><el-option label="自住+经营" value="自住+经营"/><el-option label="出租" value="出租"/><el-option label="混合" value="混合"/></el-select>
          </el-form-item></el-col>
          <el-col :span="6"><el-form-item label="是否经营"><el-switch v-model="form.isBusiness" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="是否出租"><el-switch v-model="form.isRented" /></el-form-item></el-col>
          <el-col :span="6"><el-form-item label="是否加层"><el-switch v-model="form.isAddedFloor" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="墙体裂缝">
            <el-radio-group v-model="form.wallCracks"><el-radio-button label="NONE">无</el-radio-button><el-radio-button label="MINOR">轻微</el-radio-button><el-radio-button label="SEVERE">严重</el-radio-button></el-radio-group>
          </el-form-item></el-col>
          <el-col :span="8"><el-form-item label="屋面渗漏">
            <el-radio-group v-model="form.roofLeak"><el-radio-button label="NONE">无</el-radio-button><el-radio-button label="MINOR">轻微</el-radio-button><el-radio-button label="SEVERE">严重</el-radio-button></el-radio-group>
          </el-form-item></el-col>
          <el-col :span="8"><el-form-item label="地基沉降">
            <el-radio-group v-model="form.foundationSettlement"><el-radio-button label="NONE">无</el-radio-button><el-radio-button label="MINOR">轻微</el-radio-button><el-radio-button label="SEVERE">严重</el-radio-button></el-radio-group>
          </el-form-item></el-col>
        </el-row>
        <el-form-item label="巡查备注"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="creating=false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">提交巡查并自动判定风险</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '../api';
import {
  RISK_LABEL as riskLabel, RISK_TYPE as riskType,
  STATUS_LABEL as statusLabel, STATUS_TYPE as statusType,
  SEVERITY_LABEL as sevLabel, SEVERITY_TYPE as sevType,
} from '../dict';
import { useAuth } from '../store';

const auth = useAuth();
const router = useRouter();
const items = ref([]);
const total = ref(0);
const townships = ['青山镇', '白云乡'];
const query = reactive({ keyword: '', township: '', riskLevel: '', status: '', page: 1, size: 20 });
const creating = ref(false);
const saving = ref(false);
const form = reactive({});

function resetForm() {
  Object.assign(form, {
    township: auth.user?.township || '青山镇', village: '', address: '', ownerName: '',
    ownerPhone: '', lng: '', lat: '', buildYear: 2000, floors: 2, residents: 1,
    structure: '砖混', usage: '自住', isBusiness: false, isRented: false, isAddedFloor: false,
    wallCracks: 'NONE', roofLeak: 'NONE', foundationSettlement: 'NONE', notes: '',
  });
}
function openCreate() { resetForm(); creating.value = true; }

async function load() {
  const res = await api.get('/houses', { params: query });
  items.value = res.items;
  total.value = res.total;
}
async function save() {
  saving.value = true;
  try {
    const res = await api.post('/houses', form);
    ElMessage.success(`登记成功，系统判定风险等级：${riskLabel[res.inspection.riskLevel]}，命中 ${res.inspection.ruleHits.length} 条规则`);
    creating.value = false;
    await load();
    router.push(`/houses/${res.house.id}`);
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>

<style scoped>
.bar { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
:deep(.clickable) { cursor: pointer; }
</style>
