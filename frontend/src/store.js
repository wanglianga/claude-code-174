import { defineStore } from 'pinia';
import axios from './api';

export const useAuthStore = defineStore('auth', {
  state: () => ({ token: '', user: null }),
  getters: {
    role: (s) => s.user?.role || '',
    isCounty: (s) => s.user?.role === 'COUNTY_ADMIN',
    isTownship: (s) => s.user?.role === 'TOWNSHIP_REVIEWER',
    isGrid: (s) => s.user?.role === 'GRID_WORKER',
    isFarmer: (s) => s.user?.role === 'FARMER',
    isTeam: (s) => s.user?.role === 'TEAM',
    isAcceptor: (s) => s.user?.role === 'ACCEPTOR',
  },
  actions: {
    async login(username, password) {
      const { data } = await axios.post('/api/auth/login', { username, password });
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('rhs_token', data.token);
      localStorage.setItem('rhs_user', JSON.stringify(data.user));
    },
    restore() {
      const t = localStorage.getItem('rhs_token');
      const u = localStorage.getItem('rhs_user');
      if (t) this.token = t;
      if (u) this.user = JSON.parse(u);
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('rhs_token');
      localStorage.removeItem('rhs_user');
    },
  },
});
