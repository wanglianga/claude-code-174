import axios from 'axios';
import { ElMessage } from 'element-plus';

const http = axios.create({ timeout: 20000 });

http.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('rhs_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

http.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg = err.response?.data?.message || err.message;
    if (err.response?.status === 401) {
      localStorage.removeItem('rhs_token');
      if (location.hash !== '#/login') location.hash = '#/login';
    } else if (err.config && !err.config.silent) {
      ElMessage.error(typeof msg === 'string' ? msg : '请求失败');
    }
    return Promise.reject(err);
  },
);

export default http;
