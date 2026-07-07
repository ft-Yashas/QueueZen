import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// ─── Org admin API instance ───────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("queuezen_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      const hadToken = !!localStorage.getItem("queuezen_token");
      localStorage.removeItem("queuezen_token");
      localStorage.removeItem("queuezen_org");
      if (hadToken) {
        window.location.href = "/admin/login";
      }
    }
    return Promise.reject(error);
  }
);

// ─── Counter staff API instance ───────────────────────────────────────────────
const staffApi = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

staffApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("queuezen_staff_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

staffApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      const hadToken = !!localStorage.getItem("queuezen_staff_token");
      localStorage.removeItem("queuezen_staff_token");
      localStorage.removeItem("queuezen_staff");
      if (hadToken) {
        window.location.href = "/counter/login";
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const registerOrg = (data) => api.post("/auth/register", data);
export const loginOrg = (data) => api.post("/auth/login", data);
export const getMe = () => api.get("/auth/me");
export const updateSettings = (data) => api.put("/auth/settings", data);

// ─── Queue (Public) ───────────────────────────────────────────────────────────
export const getQueue = (orgId) => api.get(`/queue/${orgId}`);

export const joinQueue = (orgId, formData) =>
  api.post(`/queue/${orgId}/join`, formData, {
    timeout: 30000,
  });

export const verifyOtp = (orgId, tokenId, otpCode) =>
  api.post(`/queue/${orgId}/token/${tokenId}/verify-otp`, { otpCode });

export const getToken = (orgId, tokenId) => api.get(`/queue/${orgId}/token/${tokenId}`);

export const getAIWaitEstimate = (orgId, tokenId) =>
  api.get(`/queue/${orgId}/token/${tokenId}/ai-wait-estimate`);

export const submitFeedback = (orgId, tokenId, rating, comment) =>
  api.post(`/queue/${orgId}/token/${tokenId}/feedback`, { rating, comment });

// ─── Queue (Admin) ────────────────────────────────────────────────────────────
export const callNext = () => api.post("/queue/action/next");
export const skipCurrent = () => api.post("/queue/action/skip");
export const completeCurrent = () => api.post("/queue/action/complete");
export const clearQueue = () => api.delete("/queue/action/clear");
export const getStats = () => api.get("/queue/action/stats");
export const getPriorityRequests = () => api.get("/queue/action/priority-requests");
export const verifyPriority = (tokenId, action) =>
  api.post("/queue/action/verify-priority", { tokenId, action });
export const recallToken = (tokenId) => api.post("/queue/action/recall", { tokenId });
export const toggleQueue = () => api.post("/queue/action/toggle-queue");

// ─── Staff Management (Admin) ──────────────────────────────────────────────────
export const getStaffList = () => api.get("/staff/list");
export const createStaff = (data) => api.post("/staff/create", data);
export const deleteStaff = (staffId) => api.delete(`/staff/${staffId}`);

// ─── Counter Staff Auth ───────────────────────────────────────────────────────
export const loginStaff = (data) => staffApi.post("/staff/login", data);
export const getCounterMe = () => staffApi.get("/staff/me");

// ─── Counter Queue Actions (use staffApi so staff JWT is sent) ────────────────
export const counterCallNext = () => staffApi.post("/queue/action/next");
export const counterSkip = () => staffApi.post("/queue/action/skip");
export const counterComplete = () => staffApi.post("/queue/action/complete");
export const counterRecall = (tokenId) => staffApi.post("/queue/action/recall", { tokenId });
export const counterGetQueue = (orgId) => staffApi.get(`/queue/${orgId}`);

// ─── Helper ───────────────────────────────────────────────────────────────────
export const getUploadUrl = (filename) =>
  filename ? `${API_URL}/uploads/priority-docs/${filename}` : null;

export default api;
