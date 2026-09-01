const ACCESS = "safos_access";
const REFRESH = "safos_refresh";
const USER = "safos_user";

const API_BASE = import.meta.env.VITE_API_URL || "";

export function getAccess() {
  return localStorage.getItem(ACCESS);
}
export function getRefresh() {
  return localStorage.getItem(REFRESH);
}
export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER) || "null");
  } catch {
    return null;
  }
}

export function saveSession({ access, refresh, user }) {
  if (access) localStorage.setItem(ACCESS, access);
  if (refresh) localStorage.setItem(REFRESH, refresh);
  if (user) localStorage.setItem(USER, JSON.stringify(user));
  const cloud = window.Telegram?.WebApp?.CloudStorage;
  if (cloud && refresh) {
    try {
      cloud.setItem("safos_refresh", refresh);
    } catch {
      /* optional */
    }
  }
}

export function clearSession() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
  localStorage.removeItem(USER);
}

async function parseError(res) {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) return data.detail.join(", ");
    const first = Object.values(data)[0];
    if (Array.isArray(first)) return first[0];
    if (typeof first === "string") return first;
    return JSON.stringify(data);
  } catch {
    return `Xatolik (${res.status})`;
  }
}

async function refreshTokens() {
  const refresh = getRefresh();
  if (!refresh) return false;
  const res = await fetch(`${API_BASE}/api/users/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    clearSession();
    return false;
  }
  const data = await res.json();
  saveSession({ access: data.access, refresh: data.refresh || refresh });
  return true;
}

export async function requestPage(url) {
  const parsed = new URL(url, window.location.origin);
  return request(`${parsed.pathname}${parsed.search}`);
}

export async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  const token = getAccess();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401 && getRefresh()) {
    const ok = await refreshTokens();
    if (ok) {
      headers.Authorization = `Bearer ${getAccess()}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
  }
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  login: (body) =>
    request("/api/users/login/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: () => request("/api/users/me/"),
  logout: (refresh) =>
    request("/api/users/logout/", {
      method: "POST",
      body: JSON.stringify({ refresh }),
    }),
  users: (params = "") => request(`/api/users/${params}`),
  createUser: (body) =>
    request("/api/users/", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id, body) =>
    request(`/api/users/${id}/`, { method: "PATCH", body: body instanceof FormData ? body : JSON.stringify(body) }),
  deleteUser: (id) => request(`/api/users/${id}/`, { method: "DELETE" }),

  markets: (qs = "") => request(`/api/markets/${qs}`),
  market: (id) => request(`/api/markets/${id}/`),
  createMarket: (body) =>
    request("/api/markets/", {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  updateMarket: (id, body) =>
    request(`/api/markets/${id}/`, {
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  deleteMarket: (id) => request(`/api/markets/${id}/`, { method: "DELETE" }),
  analyticsSummary: () => request("/api/markets/analytics/summary/"),
  analyticsVolume: (qs = "") => request(`/api/markets/analytics/volume/${qs}`),
  analyticsActivity: (qs = "") => request(`/api/markets/analytics/activity/${qs}`),
  analyticsDetail: (id) => request(`/api/markets/analytics/${id}/`),
  marketDebts: (id, qs = "?page_size=200") =>
    request(`/api/markets/analytics/${id}/debts/${qs}`),
  setMarketStatus: (id, status) =>
    request(`/api/markets/analytics/${id}/status/`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
  bulkMarketStatus: (body) =>
    request("/api/markets/analytics/activity/status/", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  products: () => request("/api/products/"),
  createProduct: (formData) =>
    request("/api/products/", { method: "POST", body: formData }),
  updateProduct: (id, formData) =>
    request(`/api/products/${id}/`, { method: "PATCH", body: formData }),
  deleteProduct: (id) => request(`/api/products/${id}/`, { method: "DELETE" }),
  categories: () => request("/api/products/categories/"),
  createCategory: (body) =>
    request("/api/products/categories/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCategory: (id, body) =>
    request(`/api/products/categories/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteCategory: (id) =>
    request(`/api/products/categories/${id}/`, { method: "DELETE" }),
  orders: (qs = "") => request(`/api/orders/${qs}`),
  order: (id) => request(`/api/orders/${id}/`),
  createOrder: (body) =>
    request("/api/orders/", { method: "POST", body: JSON.stringify(body) }),
  updateOrder: (id, body) =>
    request(`/api/orders/${id}/`, { method: "PUT", body: JSON.stringify(body) }),
  deleteOrder: (id) => request(`/api/orders/${id}/`, { method: "DELETE" }),
  setOrderStatus: (id, status) =>
    request(`/api/orders/${id}/status/`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
  myMoney: (qs = "") => request(`/api/orders/my-order-price${qs}`),
  usersMoney: (qs = "") => request(`/api/orders/users-total-price${qs}`),
  todayCount: () => request("/api/orders/today/count-of-orders"),
  todayMarkets: () => request("/api/orders/today/delivering-markets"),
  pay: (body) =>
    request("/api/transactions/", { method: "POST", body: JSON.stringify(body) }),
  payments: (marketId, qs = "") => {
    const suffix = qs ? (qs.startsWith("?") ? qs : `&${qs}`) : "";
    return request(`/api/transactions/?market_id=${marketId}${suffix}`);
  },
  delivererPayments: (qs = "") => {
    const suffix = qs ? (qs.startsWith("?") ? qs : `?${qs}`) : "";
    return request(`/api/transactions/${suffix}`);
  },
  workerStats: (qs = "") => {
    const suffix = qs ? (qs.startsWith("?") ? qs : `?${qs}`) : "";
    return request(`/api/transactions/worker-statistics/${suffix}`);
  },
  requestPage,
};

export function money(value) {
  const n = Number(value || 0);
  return n.toLocaleString("uz-UZ", { maximumFractionDigits: 0 }) + " so'm";
}

export function unitLabel(unit) {
  return { KG: "kg", GR: "gr", UNIT: "dona" }[unit] || unit || "";
}

const BACK_KEY = "safos_back";
export function rememberBack(path) {
  if (path) sessionStorage.setItem(BACK_KEY, path);
}
export function lastBack(fallback = "#/") {
  return sessionStorage.getItem(BACK_KEY) || fallback;
}
