<template>
  <el-container v-if="auth.token" class="layout">
    <el-aside width="230px" class="aside">
      <div class="logo">
        <el-icon :size="22"><House /></el-icon>
        <span>农房安全治理平台</span>
      </div>
      <el-menu :default-active="$route.path" router background-color="#1f3a5f" text-color="#cdd9e8" active-text-color="#ffd04b">
        <el-menu-item index="/dashboard">
          <el-icon><DataLine /></el-icon><span>治理看板</span>
        </el-menu-item>
        <el-menu-item index="/houses">
          <el-icon><Files /></el-icon><span>房屋档案</span>
        </el-menu-item>
        <el-menu-item index="/issues">
          <el-icon><Warning /></el-icon><span>异常协商事项</span>
        </el-menu-item>
        <el-menu-item v-if="auth.isTownship || auth.isCounty" index="/subsidies">
          <el-icon><Money /></el-icon><span>补助审核核定</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="crumb">县域农村自建房安全巡查整改补助平台</div>
        <div class="userbox">
          <el-tag size="small" type="info">{{ roleLabel[auth.role] }}</el-tag>
          <span class="uname">{{ auth.user?.name }}</span>
          <span v-if="auth.user?.township" class="tw">（{{ auth.user.township }}）</span>
          <el-button link type="primary" @click="logout">退出</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
  <router-view v-else />
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useAuth } from './store';
import { ROLE_LABEL as roleLabel } from './dict';

const auth = useAuth();
const router = useRouter();
function logout() {
  auth.logout();
  router.push('/login');
}
</script>

<style>
html, body, #app { margin: 0; height: 100%; }
body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #f0f2f5; }
.layout { height: 100vh; }
.aside { background: #1f3a5f; color: #fff; }
.logo { height: 60px; display: flex; align-items: center; gap: 8px; padding: 0 16px; font-weight: 700; font-size: 15px; color: #fff; background: #16294a; }
.aside .el-menu { border-right: none; }
.header { background: #fff; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 4px rgba(0,21,41,.08); }
.crumb { font-weight: 600; color: #303133; }
.userbox { display: flex; align-items: center; gap: 8px; }
.uname { font-weight: 600; }
.tw { color: #909399; font-size: 13px; }
.main { padding: 16px; }
.section-card { margin-bottom: 14px; }
.timeline-block { background: #fafbfc; border: 1px solid #ebeef5; border-radius: 6px; padding: 10px 14px; margin-bottom: 10px; }
.timeline-block h4 { margin: 0 0 8px; font-size: 14px; color: #1f3a5f; }
.kv { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 6px 16px; font-size: 13px; }
.kv b { color: #606266; font-weight: 400; margin-right: 4px; }
.check-pass { color: #67c23a; }
.check-fail { color: #f56c6c; }
</style>
