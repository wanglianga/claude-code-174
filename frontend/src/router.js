import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('./views/Login.vue') },
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: () => import('./views/Dashboard.vue') },
    { path: '/houses', component: () => import('./views/Houses.vue') },
    { path: '/houses/:id', component: () => import('./views/HouseDetail.vue') },
    { path: '/issues', component: () => import('./views/Issues.vue') },
    { path: '/subsidies', component: () => import('./views/Subsidies.vue') },
  ],
});

router.beforeEach((to) => {
  const token = localStorage.getItem('token');
  if (to.path !== '/login' && !token) return '/login';
  if (to.path === '/login' && token) return '/dashboard';
  // 施工队无看板权限，默认进入房屋档案
  if (to.path === '/dashboard') {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (user?.role === 'CREW') return '/houses';
  }
});

export default router;
