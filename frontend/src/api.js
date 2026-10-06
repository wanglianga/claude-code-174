import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from './router';

const api = axios.create({ baseURL: '/api', timeout: 15000 });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status = err.response?.status;
    const data = err.response?.data;
    let msg = data?.message || err.message || '请求失败';
    if (Array.isArray(msg)) msg = msg.join('；');
    if (status === 401) {
      localStorage.clear();
      router.push('/login');
      msg = '登录已过期，请重新登录';
    }
    ElMessage.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    return Promise.reject(err);
  },
);

export default api;
