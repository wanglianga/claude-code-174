import { defineStore } from 'pinia';

export const useAuth = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: JSON.parse(localStorage.getItem('user') || 'null'),
  }),
  getters: {
    role: (s) => s.user?.role || '',
    isGrid: (s) => s.user?.role === 'GRID',
    isTownship: (s) => s.user?.role === 'TOWNSHIP',
    isCounty: (s) => s.user?.role === 'COUNTY',
    isFarmer: (s) => s.user?.role === 'FARMER',
    isCrew: (s) => s.user?.role === 'CREW',
  },
  actions: {
    setLogin(token, user) {
      this.token = token;
      this.user = user;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.clear();
    },
  },
});
