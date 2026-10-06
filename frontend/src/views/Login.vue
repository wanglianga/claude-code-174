<template>
  <div class="login-page">
    <el-card class="login-card">
      <div class="title">
        <el-icon :size="26" color="#1f3a5f"><House /></el-icon>
        <h2>农村自建房安全治理平台</h2>
      </div>
      <p class="sub">巡查 · 复核 · 整改 · 安置 · 补助 · 验收 · 销号 一栋一档</p>
      <el-form :model="form" label-width="0" @keyup.enter="submit">
        <el-form-item>
          <el-input v-model="form.username" size="large" placeholder="用户名" :prefix-icon="User" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" size="large" type="password" placeholder="密码" :prefix-icon="Lock" show-password />
        </el-form-item>
        <el-button type="primary" size="large" style="width:100%" :loading="loading" @click="submit">登 录</el-button>
      </el-form>
      <el-divider>演示账号（点击自动填充）</el-divider>
      <div class="accounts">
        <el-button v-for="a in accounts" :key="a.u" size="small" @click="fill(a.u, a.p)">
          {{ a.label }}
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue';
import api from '../api';
import { useAuth } from '../store';

const form = reactive({ username: '', password: '' });
const loading = ref(false);
const router = useRouter();
const auth = useAuth();

const accounts = [
  { label: '网格员', u: 'grid', p: 'grid123' },
  { label: '乡镇住建', u: 'township', p: 'town123' },
  { label: '县级主管', u: 'county', p: 'county123' },
  { label: '农户陈大山', u: 'farmer', p: 'farmer123' },
  { label: '施工队', u: 'crew', p: 'crew123' },
];
function fill(u, p) {
  form.username = u;
  form.password = p;
}

async function submit() {
  if (!form.username || !form.password) return ElMessage.warning('请输入用户名和密码');
  loading.value = true;
  try {
    const res = await api.post('/auth/login', form);
    auth.setLogin(res.token, res.user);
    ElMessage.success(`欢迎，${res.user.name}`);
    router.push('/dashboard');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page { height: 100vh; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #1f3a5f 0%, #2e5d8f 100%); }
.login-card { width: 430px; padding: 12px 18px; }
.title { display: flex; align-items: center; gap: 10px; justify-content: center; }
.title h2 { margin: 0; font-size: 19px; color: #1f3a5f; }
.sub { text-align: center; color: #909399; font-size: 13px; margin: 6px 0 18px; }
.accounts { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
</style>
