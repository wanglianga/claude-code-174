<template>
  <el-card shadow="never">
    <template #header>网格员巡查登记（提交后由规则引擎自动生成风险建议）</template>
    <el-form :model="f" label-width="130px" style="max-width:900px">
      <el-divider content-position="left">房屋位置与权属人</el-divider>
      <el-row :gutter="10">
        <el-col :span="8">
          <el-form-item label="档案编号（可选）"><el-input v-model="f.code" placeholder="留空自动生成" /></el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="已有档案（复查）">
            <el-select v-model="f.houseId" clearable filterable placeholder="复查时选择" style="width:100%">
              <el-option v-for="h in houses" :key="h.id" :value="h.id" :label="`${h.code} ${h.ownerName}`" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="10">
        <el-col :span="8"><el-form-item label="乡镇"><el-select v-model="f.township" allow-create filterable style="width:100%"><el-option v-for="t in towns" :key="t" :value="t" /></el-select></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="行政村"><el-input v-model="f.village" /></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="户主姓名"><el-input v-model="f.ownerName" /></el-form-item></el-col>
      </el-row>
      <el-row :gutter="10">
        <el-col :span="12"><el-form-item label="详细地址"><el-input v-model="f.address" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="联系电话"><el-input v-model="f.ownerPhone" /></el-form-item></el-col>
      </el-row>

      <el-divider content-position="left">房屋情况</el-divider>
      <el-row :gutter="10">
        <el-col :span="6"><el-form-item label="建成年份"><el-input-number v-model="f.buildYear" :min="1950" :max="2026" controls-position="right" style="width:100%" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="层数"><el-input-number v-model="f.floors" :min="1" :max="10" controls-position="right" style="width:100%" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="居住人数"><el-input-number v-model="f.residents" :min="0" :max="50" controls-position="right" style="width:100%" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="使用用途"><el-input v-model="f.usage" placeholder="住宅/经营等" /></el-form-item></el-col>
      </el-row>
      <el-row :gutter="10">
        <el-col :span="6"><el-form-item label="是否经营"><el-switch v-model="f.isBusiness" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="是否出租"><el-switch v-model="f.isRented" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="是否加层"><el-switch v-model="f.isAddedFloor" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="雨季险情加重"><el-switch v-model="f.rainSeason" /></el-form-item></el-col>
      </el-row>

      <el-divider content-position="left">隐患情况（0=无 1=明显 2=严重）</el-divider>
      <el-row :gutter="10">
        <el-col :span="8"><el-form-item label="墙体裂缝"><el-radio-group v-model="f.wallCrack"><el-radio-button :value="0">无</el-radio-button><el-radio-button :value="1">明显</el-radio-button><el-radio-button :value="2">严重</el-radio-button></el-radio-group></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="屋面渗漏"><el-radio-group v-model="f.roofLeak"><el-radio-button :value="0">无</el-radio-button><el-radio-button :value="1">局部</el-radio-button><el-radio-button :value="2">严重</el-radio-button></el-radio-group></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="地基沉降"><el-radio-group v-model="f.foundationSettlement"><el-radio-button :value="0">无</el-radio-button><el-radio-button :value="1">明显</el-radio-button><el-radio-button :value="2">严重</el-radio-button></el-radio-group></el-form-item></el-col>
      </el-row>

      <el-form-item label="现场照片">
        <el-upload :action="uploadUrl" :headers="headers" :on-success="(r)=>f.photos.push(r.url)" :show-file-list="false">
          <el-button>上传照片</el-button>
        </el-upload>
        <el-tag v-for="(u,i) in f.photos" :key="i" closable style="margin:4px 6px 0" @close="f.photos.splice(i,1)">照片{{ i+1 }}</el-tag>
      </el-form-item>
      <el-form-item label="巡查备注"><el-input v-model="f.notes" type="textarea" :rows="3" /></el-form-item>
      <el-form-item>
        <el-button type="primary" size="large" @click="submit">提交巡查登记</el-button>
        <span class="hint">系统自动判定：一般关注 / 限期整改 / 暂停使用 / 紧急转移，并推送乡镇复核。</span>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import http from '../api';
import { useAuthStore } from '../store';

const auth = useAuthStore();
const router = useRouter();
const towns = ['溪口镇', '云岭乡', '青山镇'];
const houses = ref([]);
const uploadUrl = '/api/upload';
const headers = computed(() => ({ Authorization: `Bearer ${localStorage.getItem('rhs_token')}` }));
const f = reactive({
  code: '', houseId: '', township: auth.user?.township || '溪口镇', village: '', address: '', ownerName: '', ownerPhone: '',
  buildYear: 2005, floors: 2, residents: 3, usage: '住宅',
  isBusiness: false, isRented: false, isAddedFloor: false, rainSeason: false,
  wallCrack: 0, roofLeak: 0, foundationSettlement: 0, photos: [], notes: '',
});
async function submit() {
  const { data } = await http.post('/api/inspections', f);
  ElMessage.success(`登记成功，风险建议：${{ NORMAL: '一般关注', RECTIFY: '限期整改', SUSPEND: '暂停使用', EVACUATE: '紧急转移' }[data.house.riskLevel]}`);
  router.push(`/houses/${data.house.id}`);
}
onMounted(async () => {
  const { data } = await http.get('/api/houses', { params: { limit: 500 } });
  houses.value = data.data;
});
</script>
<style scoped>.hint{color:#909caa;font-size:12px;margin-left:10px}</style>
