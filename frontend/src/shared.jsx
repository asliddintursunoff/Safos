import { useEffect, useRef, useState } from "react";
import { api, lastBack, money, rememberBack, saveSession } from "./api";

export const tg = window.Telegram?.WebApp;

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
let leafletPromise;

export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = LEAFLET_CSS;
      document.head.appendChild(css);
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => {
      leafletPromise = null;
      reject(new Error("Xarita yuklanmadi"));
    };
    document.head.appendChild(script);
  });
  return leafletPromise;
}

export const STATUS = {
  PENDING: { color: "#A855F7", label: "Tasdiqlanishi kutilmoqda" },
  WAITING: { color: "#3B82F6", label: "Buyurtmani kutmoqda" },
  AVAILABLE: { color: "#22C55E", label: "Mahsulotlar mavjud" },
  POSSIBLE: { color: "#F59E0B", label: "Mahsulot kerak bo'lishi mumkin" },
  NOT_NEEDED: { color: "#EF4444", label: "Hozircha buyurtma kerak emas" },
};

export const ORDER_STATUS = {
  PENDING: { color: "#A855F7", label: "Tasdiqlanishi kutilmoqda" },
  APPROVED: { color: "#3B82F6", label: "Tasdiqlangan" },
  REJECTED: { color: "#EF4444", label: "Rad etilgan" },
  CANCELLED: { color: "#64748b", label: "Bekor qilindi" },
  DELIVERED: { color: "#22C55E", label: "Yetkazildi" },
};

export const BLOCKED = new Set(["PENDING", "WAITING"]);

export const RADIUS_OPTIONS = [
  { m: null, label: "Hammasi" },
  { m: 500, label: "500 m" },
  { m: 1000, label: "1 km" },
  { m: 2000, label: "2 km" },
  { m: 5000, label: "5 km" },
];

export function useRoute() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const path = (hash.replace(/^#/, "") || "/").split("?")[0];
  const parts = path.split("/").filter(Boolean);
  return { path, parts, go: (to) => (window.location.hash = to) };
}

export function ErrorText({ error }) {
  if (!error) return null;
  return <div className="error">{error}</div>;
}

export function statusMeta(code, fallback) {
  return STATUS[code] || { color: "#94a3b8", label: fallback || code };
}

export function orderStatusMeta(code, fallback) {
  return ORDER_STATUS[code] || { color: "#94a3b8", label: fallback || code };
}

export function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function personName(p) {
  if (!p) return "";
  if (typeof p === "string") return p;
  return `${p.first_name || ""} ${p.last_name || ""}`.trim();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function parseAnyDate(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(str) || /Z$/.test(str)) {
    const iso = new Date(str);
    if (!Number.isNaN(iso.getTime())) return iso;
  }
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (ymd) {
    return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), Number(ymd[4] || 0), Number(ymd[5] || 0), Number(ymd[6] || 0));
  }
  const dmy = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmy) {
    return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), Number(dmy[4] || 0), Number(dmy[5] || 0), Number(dmy[6] || 0));
  }
  const fallback = new Date(str);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function formatDate(value) {
  const d = parseAnyDate(value);
  if (!d) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = parseAnyDate(value);
  if (!d) return "—";
  const hasTime = /T\d|\d{1,2}:\d{2}/.test(String(value)) || (d.getHours() !== 0 || d.getMinutes() !== 0);
  const date = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  if (!hasTime) return date;
  return `${date} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function toISODate(value) {
  const d = parseAnyDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function toDashDate(value) {
  const formatted = formatDate(value);
  return formatted ? formatted.replace(/\//g, "-") : "";
}

export function DatePicker({ label, value, onChange }) {
  const iso = toISODate(value);
  const shown = formatDate(value);
  return (
    <label className="date-picker">
      {label && <span className="muted">{label}</span>}
      <span className="date-picker-field">
        <span className={`date-value ${shown ? "" : "empty"}`}>{shown || "dd/mm/yyyy"}</span>
        <span className="date-icon" aria-hidden="true">📅</span>
        <input
          type="date"
          lang="en-GB"
          value={iso}
          onChange={(e) => onChange(e.target.value ? formatDate(e.target.value) : "")}
          aria-label={label || "Sana"}
        />
      </span>
    </label>
  );
}

export function DateInput(props) {
  return <DatePicker {...props} />;
}

const PHONE_PREFIX = "+998";

export function formatUzPhone(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("998")) digits = digits.slice(3);
  return PHONE_PREFIX + digits.slice(0, 9);
}

export function PhoneInput({ value, onChange, placeholder = "+998901234567", ...props }) {
  const display = formatUzPhone(value || PHONE_PREFIX);
  return (
    <input
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={display}
      placeholder={placeholder}
      onChange={(e) => onChange(formatUzPhone(e.target.value))}
      onFocus={(e) => {
        if (!value) onChange(PHONE_PREFIX);
        const el = e.target;
        requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
      }}
      onKeyDown={(e) => {
        const start = e.target.selectionStart ?? 0;
        const end = e.target.selectionEnd ?? 0;
        if ((e.key === "Backspace" || e.key === "Delete") && start <= 4 && end <= 4) {
          e.preventDefault();
        }
      }}
      {...props}
    />
  );
}

function displayName(...parts) {
  const joined = parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  if (!joined) return "";
  if (/^\+?\d[\d\s-]{6,}$/.test(joined)) return "";
  return joined;
}

export function takenByLabel(o) {
  if (!o) return "";
  const first = o.ordered_by_first_name || o.ordered_by?.first_name || "";
  const last = o.ordered_by_last_name || o.ordered_by?.last_name || "";
  return displayName(first, last) || displayName(o.ordered_by_name) || displayName(personName(o.ordered_by));
}

export function deliveredByLabel(o) {
  if (!o) return "";
  const first = o.delivered_by_first_name || o.delivered_by?.first_name || "";
  const last = o.delivered_by_last_name || o.delivered_by?.last_name || "";
  return displayName(first, last) || displayName(o.delivered_by_name) || displayName(personName(o.delivered_by));
}

export function ApproveToggle({ approved, busy, onClick }) {
  return (
    <button
      type="button"
      className={`icon-btn ${approved ? "off" : "ok"}`}
      disabled={busy}
      aria-label={approved ? "Tasdiqlamaslik" : "Tasdiqlash"}
      title={approved ? "Tasdiqlamaslik" : "Tasdiqlash"}
      onClick={onClick}
    >
      {approved ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12.5l5 5L20 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export function PhoneLink({ phone }) {
  if (!phone) return null;
  return <a href={`tel:${phone}`}>{phone}</a>;
}

export function InfoRows({ title, rows }) {
  const visible = (rows || []).filter((r) => r && r[1] != null && r[1] !== "");
  if (!visible.length) return null;
  return (
    <div className="card">
      {title && <div className="h2">{title}</div>}
      {visible.map(([label, value]) => (
        <div className="info-row" key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  );
}



export function distMeters(a, b) {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function userIcon(heading) {
  return window.L.divIcon({
    className: "",
    iconSize: [56, 56],
    iconAnchor: [28, 28],
    html: `<div class="user-marker" style="transform:rotate(${heading || 0}deg)"><div class="cone"></div><div class="core"></div></div>`,
  });
}

export function geoErrorMessage(err) {
  if (err && err.code === 1) {
    return "Joylashuvga ruxsat berilmagan. Brauzer sozlamasidan ruxsat bering.";
  }
  if (err && err.code === 3) {
    return "Joylashuvni olish vaqti tugadi. «Mening joyim» ni qayta bosing.";
  }
  return "Joylashuv hozircha olinmadi. «Mening joyim» ni bosing.";
}

export function ScreenHeader({ title, backTo, go }) {
  return (
    <div className="page-head">
      {backTo ? (
        <button type="button" className="back" onClick={() => go(backTo)} aria-label="Orqaga">←</button>
      ) : (
        <div className="head-space" />
      )}
      <h2>{title}</h2>
      <div className="head-space" />
    </div>
  );
}

export function TopBar({ title, subtitle, go }) {
  const initials = `${(subtitle || "S")[0] || "S"}`.toUpperCase();
  return (
    <div className="top">
      <div>
        <div className="brand">{title}</div>
        {subtitle && <div className="muted">{subtitle}</div>}
      </div>
      <button type="button" className="head-avatar" onClick={() => go("#/profile")} aria-label="Profil">
        {initials}
      </button>
    </div>
  );
}

export function Login({ onLogin }) {
  const [phone, setPhone] = useState("+998");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = { phone_number: phone, password };
      if (tg?.initDataUnsafe?.user?.id) body.telegram_id = tg.initDataUnsafe.user.id;
      const data = await api.login(body);
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <h1 className="h1">Safos</h1>
      <p className="muted">Xodim kabineti</p>
      <form className="card stack" onSubmit={submit}>
        <PhoneInput value={phone} onChange={setPhone} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Parol" />
        <ErrorText error={error} />
        <button className="btn" disabled={busy}>{busy ? "Kutilmoqda..." : "Kirish"}</button>
      </form>
    </div>
  );
}

export function MarketsScreen({ go, user }) {
  const [q, setQ] = useState("");
  const [radius, setRadius] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  async function load(search = q, meters = radius) {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (meters) {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
        });
        params.set("latitude", pos.coords.latitude);
        params.set("longitude", pos.coords.longitude);
        params.set("radius_in_meters", String(meters));
      }
      const qs = params.toString() ? `?${params}` : "";
      const data = await api.markets(qs);
      setItems(Array.isArray(data) ? data : data.results || []);
      setError("");
    } catch (e) {
      setError(meters ? "Joylashuv olinmadi yoki yaqin do'kon yo'q" : e.message);
    }
  }

  useEffect(() => { load("", null); }, []);

  const canOpenDebtStats = user && ["ADMIN", "DELIVERER"].includes(String(user.role_type || user.role || "").toUpperCase());

  return (
    <div>
      <div className="search-wrap">
        <input placeholder="Do'kon qidirish..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        <button className="btn small" onClick={() => load()}>Qidirish</button>
        {canOpenDebtStats && (
          <button className="btn secondary small" onClick={() => go("#/markets/statistics")}>Qarzli do'konlar</button>
        )}
      </div>
      <div className="chips">
        {RADIUS_OPTIONS.map((opt) => (
          <button
            key={String(opt.m)}
            type="button"
            className={`chip-btn ${radius === opt.m ? "on" : ""}`}
            onClick={() => { setRadius(opt.m); load(q, opt.m); }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <ErrorText error={error} />
      <div className="card" style={{ padding: 0 }}>
        {items.map((m) => {
          const meta = statusMeta(m.status_code, m.status);
          return (
            <div className="market-card" key={m.id} onClick={() => { rememberBack("#/markets"); go(`#/markets/${m.id}`); }}>
              <span className="ring" style={{ borderColor: m.last_order_open && m.last_order_agent_color ? m.last_order_agent_color : "transparent" }}>
                <span className="core" style={{ background: m.status_color_code || meta.color }} />
              </span>
              <div style={{ flex: 1 }}>
                <b>{m.name}</b>
                <div className="muted">{meta.label}</div>
                {m.last_order_open && m.last_order_agent_name && (
                  <div className="muted">Agent: {m.last_order_agent_name}</div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                {m.distance_m != null && <div className="muted">{m.distance_m} m</div>}
              </div>
            </div>
          );
        })}
        {!items.length && <div className="empty">Do'kon topilmadi</div>}
      </div>
      <button className="fab" onClick={() => go("#/markets/new")}>+</button>
    </div>
  );
}

export function NewMarket({ go, backTo = "#/", marketId = null }) {
  const editing = Boolean(marketId);
  const [form, setForm] = useState({
    name: "", description: "", owner_first_name: "", owner_last_name: "",
    owner_phone_number: "+998", discount_percentage: "", latitude: "", longitude: "",
  });
  const [photo, setPhoto] = useState(null);
  const [existingImage, setExistingImage] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("Joylashuv ixtiyoriy");
  const [busy, setBusy] = useState(false);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!marketId) return;
    api.market(marketId).then((m) => {
      setForm({
        name: m.name || "",
        description: m.description || "",
        owner_first_name: m.owner_first_name || m.owner?.first_name || "",
        owner_last_name: m.owner_last_name || m.owner?.last_name || "",
        owner_phone_number: formatUzPhone(m.owner_phone_number || m.owner?.phone_number || "+998"),
        discount_percentage: m.discount_percentage ?? "",
        latitude: m.latitude ?? "",
        longitude: m.longitude ?? "",
      });
      setExistingImage(m.image || null);
      if (m.latitude && m.longitude) setNote("Xaritadan tanlangan");
    }).catch((err) => setError(err.message));
  }, [marketId]);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then(() => {
      if (cancelled) return;
      const el = document.getElementById("pick-map");
      if (!el || !window.L || mapRef.current) return;
      const map = window.L.map(el).setView([41.31, 69.24], 12);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      map.on("click", (e) => {
        set("latitude", e.latlng.lat.toFixed(6));
        set("longitude", e.latlng.lng.toFixed(6));
        if (markerRef.current) map.removeLayer(markerRef.current);
        markerRef.current = window.L.marker(e.latlng).addTo(map);
        setNote("Xaritadan tanlandi");
      });
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (!mapRef.current || !window.L || form.latitude === "" || form.longitude === "") return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    mapRef.current.setView([lat, lng], 16);
    if (markerRef.current) mapRef.current.removeLayer(markerRef.current);
    markerRef.current = window.L.marker([lat, lng]).addTo(mapRef.current);
  }, [form.latitude, form.longitude]);

  function currentLocation() {
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      set("latitude", lat);
      set("longitude", lng);
      setNote("Joriy joylashuv olindi");
      if (mapRef.current && window.L) {
        mapRef.current.setView([lat, lng], 16);
        if (markerRef.current) mapRef.current.removeLayer(markerRef.current);
        markerRef.current = window.L.marker([lat, lng]).addTo(mapRef.current);
      }
    }, () => setNote("Joylashuv olinmadi, xaritadan tanlang yoki bo'sh qoldiring"));
  }

  async function submit(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("name", form.name);
    if (form.description) fd.append("description", form.description);
    if (form.owner_first_name) fd.append("owner_first_name", form.owner_first_name);
    if (form.owner_last_name) fd.append("owner_last_name", form.owner_last_name);
    if (formatUzPhone(form.owner_phone_number).length === 13) fd.append("owner_phone_number", formatUzPhone(form.owner_phone_number));
    if (form.discount_percentage !== "") fd.append("discount_percentage", form.discount_percentage);
    if (form.latitude !== "" && form.longitude !== "") {
      fd.append("latitude", form.latitude);
      fd.append("longitude", form.longitude);
    }
    if (photo) fd.append("image", photo);
    setBusy(true);
    setError("");
    try {
      if (editing) {
        await api.updateMarket(marketId, fd);
        go(backTo || `#/markets/${marketId}`);
      } else {
        await api.createMarket(fd);
        go(backTo);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <ScreenHeader title={editing ? "Do'konni tahrirlash" : "Yangi do'kon"} backTo={backTo} go={go} />
      <input placeholder="Do'kon nomi *" value={form.name} onChange={(e) => set("name", e.target.value)} required />
      {existingImage && !photo && <img className="market-hero" src={existingImage} alt="" decoding="async" />}
      <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0] || null)} />
      <input placeholder="Egasi ismi" value={form.owner_first_name} onChange={(e) => set("owner_first_name", e.target.value)} />
      <input placeholder="Egasi familiyasi" value={form.owner_last_name} onChange={(e) => set("owner_last_name", e.target.value)} />
      <PhoneInput placeholder="Egasi telefoni" value={form.owner_phone_number} onChange={(v) => set("owner_phone_number", v)} />
      <textarea placeholder="Izoh" value={form.description} onChange={(e) => set("description", e.target.value)} />
      <input placeholder="Chegirma %" type="number" value={form.discount_percentage} onChange={(e) => set("discount_percentage", e.target.value)} />
      <button type="button" className="btn secondary" onClick={currentLocation}>Joriy joylashuv</button>
      <div className="muted">{note}</div>
      <div id="pick-map" className="map pick" />
      <div className="grid2">
        <input placeholder="Lat" value={form.latitude} onChange={(e) => set("latitude", e.target.value)} />
        <input placeholder="Lng" value={form.longitude} onChange={(e) => set("longitude", e.target.value)} />
      </div>
      <ErrorText error={error} />
      <button className="btn" disabled={busy}>{busy ? "Saqlanmoqda..." : "Saqlash"}</button>
    </form>
  );
}

export function MapScreen({ go }) {
  const [markets, setMarkets] = useState([]);
  const [q, setQ] = useState("");
  const [radius, setRadius] = useState(null);
  const [error, setError] = useState("");
  const [hasUser, setHasUser] = useState(false);
  const [routeNote, setRouteNote] = useState("");
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const userRef = useRef(null);
  const routeRef = useRef(null);
  const hereRef = useRef(null);
  const headingRef = useRef(0);

  const visible = (() => {
    const term = q.trim().toLowerCase();
    let rows = markets.filter((m) => m.latitude && m.longitude);
    if (term) rows = rows.filter((m) => (m.name || "").toLowerCase().includes(term));
    if (radius && hereRef.current) {
      rows = rows.filter((m) => distMeters(hereRef.current, [m.latitude, m.longitude]) <= radius);
    }
    return rows;
  })();

  useEffect(() => {
    api.markets().then((d) => setMarkets(Array.isArray(d) ? d : d.results || [])).catch((e) => setError(e.message));
  }, []);

  function drawUser() {
    const map = mapRef.current;
    const here = hereRef.current;
    if (!map || !here || !window.L) return;
    if (userRef.current) {
      userRef.current.setLatLng(here);
      userRef.current.setIcon(userIcon(headingRef.current));
    } else {
      userRef.current = window.L.marker(here, { icon: userIcon(headingRef.current), zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup("Sizning joylashuvingiz");
    }
  }

  function requestHere() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject({ code: 1 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          hereRef.current = [pos.coords.latitude, pos.coords.longitude];
          if (pos.coords.heading != null && !Number.isNaN(pos.coords.heading) && pos.coords.heading >= 0) {
            headingRef.current = pos.coords.heading;
          }
          setHasUser(true);
          drawUser();
          resolve(hereRef.current);
        },
        reject,
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 20000 }
      );
    });
  }

  async function ensureHere() {
    if (hereRef.current) return hereRef.current;
    return requestHere();
  }

  async function drawRoute(to) {
    const map = mapRef.current;
    if (!map) return;
    let here;
    try {
      here = await ensureHere();
    } catch (err) {
      setRouteNote(geoErrorMessage(err));
      return;
    }
    setRouteNote("");
    fetch(`https://router.project-osrm.org/route/v1/driving/${here[1]},${here[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`)
      .then((r) => r.json())
      .then((data) => {
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (!coords) {
          setRouteNote("Yo‘nalish chizilmadi. Qayta urinib ko‘ring.");
          return;
        }
        if (routeRef.current) map.removeLayer(routeRef.current);
        routeRef.current = window.L.geoJSON(
          { type: "LineString", coordinates: coords },
          { style: { color: "#1b7a4a", weight: 5, opacity: 0.85 } }
        ).addTo(map);
      })
      .catch(() => setRouteNote("Yo‘nalish chizilmadi. Internetni tekshiring."));
  }
  const drawRouteRef = useRef(drawRoute);
  drawRouteRef.current = drawRoute;

  useEffect(() => {
    let cancelled = false;
    let watchId = null;
    function onOrient(e) {
      let heading = e.webkitCompassHeading;
      if (heading == null && e.alpha != null) heading = (360 - e.alpha) % 360;
      if (heading == null || Number.isNaN(heading)) return;
      headingRef.current = heading;
      drawUser();
    }

    loadLeaflet().then(() => {
      if (cancelled) return;
      const el = document.getElementById("agent-map");
      if (!el || !window.L) return;
      const map = window.L.map(el, { zoomControl: false }).setView([41.31, 69.24], 12);
      window.L.control.zoom({ position: "bottomleft" }).addTo(map);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      mapRef.current = map;
      layerRef.current = window.L.layerGroup().addTo(map);
      map.getContainer().addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-dir-lat]");
        if (!btn) return;
        ev.preventDefault();
        drawRouteRef.current([Number(btn.dataset.dirLat), Number(btn.dataset.dirLng)]);
      });

      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition((pos) => {
          hereRef.current = [pos.coords.latitude, pos.coords.longitude];
          if (pos.coords.heading != null && !Number.isNaN(pos.coords.heading) && pos.coords.heading >= 0) {
            headingRef.current = pos.coords.heading;
          }
          setHasUser(true);
          drawUser();
        }, (err) => {
          if (err && err.code === 1) {
            setRouteNote("Joylashuvga ruxsat berilmagan. Brauzer sozlamasidan ruxsat bering.");
          }
        }, { enableHighAccuracy: true, maximumAge: 3000 });
      }

      window.addEventListener("deviceorientationabsolute", onOrient);
      window.addEventListener("deviceorientation", onOrient);
    });

    return () => {
      cancelled = true;
      window.removeEventListener("deviceorientationabsolute", onOrient);
      window.removeEventListener("deviceorientation", onOrient);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
      userRef.current = null;
      routeRef.current = null;
    };
  }, []);

  const visibleIds = visible.map((m) => m.id).join(",");

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !window.L) return;
    layer.clearLayers();
    visible.forEach((m) => {
      const statusColor = m.status_color_code || statusMeta(m.status_code).color;
      const agentColor = m.last_order_open ? m.last_order_agent_color : null;
      const label = statusMeta(m.status_code, m.status).label;
      const agentLine = m.last_order_open && m.last_order_agent_name
        ? `<div class="muted">Agent: ${esc(m.last_order_agent_name)}</div>`
        : "";
      const photo = m.image
        ? `<img src="${esc(m.image)}" alt="${esc(m.name)}" decoding="async" loading="lazy" />`
        : `<div class="ph">Rasm yo‘q</div>`;
      if (agentColor) {
        window.L.circleMarker([m.latitude, m.longitude], {
          radius: 16, color: agentColor, fillColor: agentColor, fillOpacity: 0.18, weight: 4,
        }).addTo(layer);
      }
      const marker = window.L.circleMarker([m.latitude, m.longitude], {
        radius: 9, color: "#fff", fillColor: statusColor, fillOpacity: 1, weight: 2,
      }).addTo(layer);
      marker.bindPopup(
        `<div class="pop-card">${photo}<b>${esc(m.name)}</b><div class="muted">${esc(label)}</div>${agentLine}<div class="pop-actions"><button type="button" class="pop-dir" data-dir-lat="${m.latitude}" data-dir-lng="${m.longitude}">Yo‘nalish</button><a class="pop-open" href="#/markets/${m.id}">Ochish</a></div></div>`,
        { maxWidth: 230, minWidth: 200 }
      );
    });
    if (q.trim() && visible.length === 1) {
      map.flyTo([visible[0].latitude, visible[0].longitude], 16);
    } else if (visible.length > 1 && (q.trim() || radius)) {
      map.fitBounds(visible.map((m) => [m.latitude, m.longitude]), { padding: [40, 40], maxZoom: 15 });
    } else if (!q.trim() && !radius && visible.length) {
      map.fitBounds(visible.map((m) => [m.latitude, m.longitude]), { padding: [40, 40], maxZoom: 14 });
    }
  }, [visibleIds, q, radius]);

  function recenter() {
    if (typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) {
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
    ensureHere()
      .then((here) => {
        setRouteNote("");
        if (mapRef.current) mapRef.current.flyTo(here, 16);
        drawUser();
      })
      .catch((err) => setRouteNote(geoErrorMessage(err)));
  }

  function pickHit(m) {
    setQ(m.name);
    if (mapRef.current) {
      mapRef.current.flyTo([m.latitude, m.longitude], 17);
      const layer = layerRef.current;
      layer?.eachLayer((l) => {
        if (l.getLatLng && Math.abs(l.getLatLng().lat - m.latitude) < 1e-6) l.openPopup?.();
      });
    }
  }

  return (
    <div>
      <ErrorText error={error} />
      <div className="map-wrap">
        <div id="agent-map" className="map" style={{ height: "58vh" }} />
        <div className="map-float">
          <div className="search-wrap" style={{ margin: 0 }}>
            <input placeholder="Do‘kon nomini qidirish..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {q.trim() && (
            <div className="map-hits">
              {visible.slice(0, 6).map((m) => (
                <div className="map-hit" key={m.id} onClick={() => pickHit(m)}>
                  <span className="ring" style={{ borderColor: m.last_order_open && m.last_order_agent_color ? m.last_order_agent_color : "transparent" }}>
                    <span className="core" style={{ background: m.status_color_code || statusMeta(m.status_code).color }} />
                  </span>
                  <div>
                    <b>{m.name}</b>
                    <div className="muted">{statusMeta(m.status_code, m.status).label}</div>
                  </div>
                </div>
              ))}
              {!visible.length && <div className="map-hit muted">Topilmadi</div>}
            </div>
          )}
        </div>
        <div className="map-actions">
          <button type="button" className="me-btn" onClick={recenter}>Mening joyim</button>
        </div>
      </div>
      <div className="chips" style={{ marginTop: 10 }}>
        {RADIUS_OPTIONS.map((opt) => (
          <button
            key={String(opt.m)}
            type="button"
            className={`chip-btn ${radius === opt.m ? "on" : ""}`}
            onClick={() => setRadius(opt.m)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {routeNote && <div className="error">{routeNote}</div>}
      {hasUser && <div className="muted" style={{ marginTop: 6 }}>Joylashuv va qaragan tomon yangilanmoqda</div>}
      <div className="card legend">
        {Object.values(STATUS).map((s) => (
          <span key={s.label}><span className="dot" style={{ background: s.color }} />{s.label}</span>
        ))}
        <span><span className="dot" style={{ background: "#1b7a4a" }} />Sizning joyingiz va qaragan tomon</span>
        <span><span className="ring" style={{ borderColor: "#2FFFE3", width: 18, height: 18 }}><span className="core" style={{ width: 8, height: 8, background: "#888" }} /></span>Tashqi halqa — agent rangi (buyurtma hali yetkazilmagan)</span>
      </div>
    </div>
  );
}

export function MyOrdersScreen({ go }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api.orders("?page_size=200")
      .then((d) => setItems(d.results || d))
      .catch((e) => setError(e.message));
  }, []);
  const groups = [];
  items.forEach((o) => {
    const day = o.created_date || (o.created_at || "").slice(0, 10);
    const last = groups[groups.length - 1];
    if (!last || last.day !== day) groups.push({ day, rows: [o] });
    else last.rows.push(o);
  });
  return (
    <div>
      <ErrorText error={error} />
      {groups.map((g) => (
        <div key={g.day}>
          <div className="date-head">{formatDate(g.day)}</div>
          <div className="card">
            {g.rows.map((o) => (
              <div className="list-item" key={o.id} onClick={() => { rememberBack("#/orders"); go(`#/orders/${o.id}`); }}>
                <div className="row">
                  <b>{o.markent_name}</b>
                  <span className="badge" style={{ background: orderStatusMeta(o.status_code, o.status).color }}>{o.status}</span>
                </div>
                <div className="muted">{formatDateTime(o.created_at)} · {money(o.total_price_with_discount)}</div>
                {takenByLabel(o) && <div className="muted">Olgan: {takenByLabel(o)}</div>}
                {deliveredByLabel(o) && <div className="muted">Yetkazgan: {deliveredByLabel(o)}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
      {!items.length && <div className="empty">Hali buyurtma yo'q</div>}
    </div>
  );
}

export function MoneyScreen() {
  const [data, setData] = useState(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");
  const [title, setTitle] = useState("Bugun");

  function toApiDate(value) {
    return toDashDate(value);
  }

  async function loadToday() {
    try {
      const res = await api.myMoney("");
      setData(res);
      setTitle("Bugun");
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  async function loadRange(e) {
    e.preventDefault();
    if (!start || !end) return setError("Boshlanish va tugash sanasini tanlang");
    try {
      const res = await api.myMoney(`?start_date=${toApiDate(start)}&end_date=${toApiDate(end)}`);
      setData(res);
      setTitle(`${formatDate(start)} — ${formatDate(end)}`);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { loadToday(); }, []);

  return (
    <div>
      <div className="card">
        <div className="muted">{title} jami</div>
        <div className="stat">{money(data?.total)}</div>
        <div className="muted" style={{ marginTop: 10 }}>Shundan yetkazilgan</div>
        <div className="h2" style={{ margin: 0 }}>{money(data?.delivered)}</div>
      </div>
      <form className="card stack" onSubmit={loadRange}>
        <div className="h2">Sana oralig'i</div>
        <DatePicker label="Boshlanish" value={start} onChange={setStart} />
        <DatePicker label="Tugash" value={end} onChange={setEnd} />
        <ErrorText error={error} />
        <div className="grid2">
          <button className="btn secondary" type="button" onClick={loadToday}>Bugun</button>
          <button className="btn">Hisoblash</button>
        </div>
      </form>
    </div>
  );
}

export function OrderFlow({ marketId, user, go, editOrderId, backTo = "#/" }) {
  const [market, setMarket] = useState(null);
  const [cats, setCats] = useState([]);
  const [cart, setCart] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const blocked = market && BLOCKED.has(market.status_code);
  const editing = Boolean(editOrderId);

  useEffect(() => {
    api.market(marketId).then(setMarket).catch((e) => setError(e.message));
    api.products().then(setCats).catch((e) => setError(e.message));
  }, [marketId]);

  useEffect(() => {
    if (!editOrderId) return;
    api.order(editOrderId).then((order) => {
      const next = {};
      (order.items || []).forEach((it) => {
        if (it.product_id) next[it.product_id] = it.quantity;
      });
      setCart(next);
    }).catch((e) => setError(e.message));
  }, [editOrderId]);

  useEffect(() => {
    if (editOrderId || !market) return;
    if (BLOCKED.has(market.status_code) && market.last_order_id) {
      go(`#/markets/${marketId}/edit/${market.last_order_id}`);
    }
  }, [market, editOrderId, marketId, go]);

  const products = cats.flatMap((c) => c.products || []);
  function setQty(id, qty) {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }
  const items = Object.entries(cart).map(([product_id, quantity]) => ({ product_id, quantity }));
  const total = products.reduce((sum, p) => sum + Number(p.price) * (cart[p.id] || 0), 0);

  async function submit() {
    if (!items.length) return setError("Mahsulot tanlang");
    setBusy(true);
    try {
      if (editing) {
        await api.updateOrder(editOrderId, { items });
        rememberBack(backTo);
        go(`#/orders/${editOrderId}`);
      } else {
        const order = await api.createOrder({ market_id: marketId, items });
        rememberBack(backTo);
        go(`#/orders/${order.id}`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (blocked && !editing) {
    return (
      <div>
        <ScreenHeader title={market?.name || "Do'kon"} backTo={backTo} go={go} />
        <div className="card">
          <p>Bu do'kondan hozir buyurtma olingan ({statusMeta(market.status_code, market.status).label}).</p>
          {market.last_order_id && (
            <button className="btn" onClick={() => go(`#/markets/${marketId}/edit/${market.last_order_id}`)}>
              Oxirgi buyurtmani tahrirlash
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title={editing ? "Tahrirlash" : "Buyurtma olish"} backTo={backTo} go={go} />
      <div className="muted" style={{ marginBottom: 8 }}>{market?.name}</div>
      {cats.map((cat) => (
        <div className="card" key={cat.id}>
          <div className="h2">{cat.name}</div>
          {(cat.products || []).map((p) => (
            <div className="list-item" key={p.id}>
              <div className="product-row">
                <div>
                  <b>{p.name}</b>
                  <div className="muted">{money(p.price)} / {p.unit_display || p.unit}</div>
                </div>
                <div className="qty">
                  <button className="qty-btn" type="button" onClick={() => setQty(p.id, (cart[p.id] || 0) - 1)}>−</button>
                  <input
                    className="qty-input"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={cart[p.id] || 0}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setQty(p.id, Number.isNaN(n) || n < 0 ? 0 : n);
                    }}
                  />
                  <button className="qty-btn" type="button" onClick={() => setQty(p.id, (cart[p.id] || 0) + 1)}>+</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
      <ErrorText error={error} />
      <div className="checkout">
        <div>
          <div className="muted">Jami</div>
          <b>{money(total)}</b>
        </div>
        <button className="btn" disabled={busy} onClick={submit}>
          {editing ? "Saqlash" : "Buyurtma berish"}
        </button>
      </div>
    </div>
  );
}

export function OrderView({ id, user, go, backTo }) {
  const [order, setOrder] = useState(null);
  const [market, setMarket] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const back = backTo || lastBack(user?.role_type === "DELIVERER" ? "#/" : "#/orders");

  useEffect(() => {
    let alive = true;
    setMarket(null);
    api.order(id).then(async (o) => {
      if (!alive) return;
      setOrder(o);
      if (!o.market_id) return;
      try {
        const m = await api.market(o.market_id);
        if (alive) setMarket(m);
      } catch {
        /* owner fields may already be on the order */
      }
    }).catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [id]);

  async function remove() {
    if (order && order.ordered_by?.id !== user.id) {
      setError("Boshqa agent buyurtmasini o'chira olmaysiz");
      return;
    }
    if (!confirm("O'chirilsinmi?")) return;
    try {
      await api.deleteOrder(id);
      go(back);
    } catch (e) {
      setError(e.message);
    }
  }

  async function setStatus(status) {
    setBusy(true);
    setError("");
    try {
      await api.setOrderStatus(id, status);
      // If order marked delivered, navigate to market page immediately so the market can be processed
      if (status === "DELIVERED") {
        try {
          const marketId = order?.market_id;
          if (marketId) {
            go(`#/markets/${marketId}`);
            return;
          }
        } catch (_) {
          // fall through to refresh order if navigation isn't possible
        }
      }
      const next = await api.order(id);
      setOrder(next);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!order) {
    return (
      <div>
        <ScreenHeader title="Buyurtma" backTo={back} go={go} />
        <div className="card">Yuklanmoqda...</div>
      </div>
    );
  }
  const canEdit = ["PENDING", "APPROVED"].includes(order.status_code);
  const role = user?.role_type;
  const st = order.status_code;
  const delivererActions = [];
  const canManageOrderStatus = role === "DELIVERER" || role === "ADMIN";
  if (canManageOrderStatus) {
    if (st === "PENDING") {
      delivererActions.push({ status: "REJECTED", label: "Rad etish", className: "btn danger" });
    } else if (st === "APPROVED") {
      delivererActions.push({ status: "DELIVERED", label: "Yetkazildi", className: "btn" });
      delivererActions.push({ status: "CANCELLED", label: "Bekor qilish", className: "btn danger" });
    } else if (st === "DELIVERED") {
      delivererActions.push({ status: "CANCELLED", label: "Bekor qilish", className: "btn ghost" });
    } else if (st === "CANCELLED" || st === "REJECTED") {
      delivererActions.push({ status: "APPROVED", label: "Qayta tasdiqlash", className: "btn" });
    }
  }
  const showApproveToggle = canManageOrderStatus && (st === "PENDING" || st === "APPROVED");
  const meta = orderStatusMeta(order.status_code, order.status);
  const owner = order.market_owner || null;
  const ownerName = personName(owner)
    || [market?.owner_first_name, market?.owner_last_name].filter(Boolean).join(" ").trim()
    || "";
  const ownerPhone = owner?.phone_number || market?.owner_phone_number || "";
  const taker = order.ordered_by;
  const giver = order.delivered_by;
  const discount = order.market_discount_percentage ?? market?.discount_percentage;

  return (
    <div>
      <ScreenHeader title={order.market_name} backTo={back} go={go} />
      <div className="card">
        <div className="row">
          <span className="badge" style={{ background: meta.color }}>{order.status}</span>
          <div className="row" style={{ gap: 8, width: "auto" }}>
            {showApproveToggle && (
              <ApproveToggle
                approved={st === "APPROVED"}
                busy={busy}
                onClick={() => setStatus(st === "APPROVED" ? "PENDING" : "APPROVED")}
              />
            )}
            <b>{money(order.total_price_with_discount)}</b>
          </div>
        </div>
        {Number(order.total_price) !== Number(order.total_price_with_discount) && (
          <div className="muted" style={{ marginTop: 6 }}>Chegirmasiz: {money(order.total_price)}</div>
        )}
      </div>
      <InfoRows
        title="Do'kon"
        rows={[
          ["Nomi", order.market_name],
          ["Egasi", ownerName],
          ["Egasi telefoni", ownerPhone ? <PhoneLink phone={ownerPhone} /> : ""],
          ["Chegirma", discount != null && discount !== "" ? `${discount}%` : ""],
          ["To'landimi", order.is_debt_paid ? "To'langan" : "Qarz"],
          ["Izoh", order.market_description || market?.description || ""],
        ]}
      />
      <InfoRows
        title="Buyurtmani olgan"
        rows={[
          ["Ism", taker?.first_name || ""],
          ["Familiya", taker?.last_name || ""],
          ["Telefon", taker?.phone_number ? <PhoneLink phone={taker.phone_number} /> : ""],
          ["Lavozim", taker?.role_type || ""],
        ]}
      />
      {giver && (
        <InfoRows
          title="Yetkazgan"
          rows={[
            ["Ism", giver.first_name || ""],
            ["Familiya", giver.last_name || ""],
            ["Telefon", giver.phone_number ? <PhoneLink phone={giver.phone_number} /> : ""],
            ["Lavozim", giver.role_type || ""],
          ]}
        />
      )}
      <InfoRows
        title="Vaqt"
        rows={[
          ["Yaratilgan", order.created_at ? formatDateTime(order.created_at) : ""],
          ["Tasdiqlangan", order.approved_at ? formatDateTime(order.approved_at) : ""],
          ["Yetkazilgan", order.delivered_at ? formatDateTime(order.delivered_at) : ""],
          ["Bekor qilingan", order.cancelled_at ? formatDateTime(order.cancelled_at) : ""],
        ]}
      />
      <div className="card">
        <div className="h2">Mahsulotlar</div>
        {(order.items || []).map((it, i) => (
          <div className="list-item" key={i}>
            <div className="row">
              <span>
                {it.product_name} × {it.quantity}
                {it.product_unit ? ` ${it.product_unit}` : ""}
              </span>
              <b>{money(it.total_price)}</b>
            </div>
            {it.product_price != null && (
              <div className="muted">{money(it.product_price)} / dona</div>
            )}
          </div>
        ))}
      </div>
      {delivererActions.length > 0 && (
        <div className="stack" style={{ marginBottom: 8 }}>
          {delivererActions.map((a) => (
            <button key={a.status} className={a.className} disabled={busy} onClick={() => setStatus(a.status)}>
              {a.label}
            </button>
          ))}
        </div>
      )}
      {canEdit && (
        <button className="btn secondary" onClick={() => go(`#/markets/${order.market_id}/edit/${order.id}`)}>Tahrirlash</button>
      )}
      {order.ordered_by?.id === user.id && order.status_code === "PENDING" && (
        <button className="btn danger" style={{ marginTop: 8 }} onClick={remove}>O'chirish</button>
      )}
      <ErrorText error={error} />
    </div>
  );
}

function DelivererTransactionsSection({ user }) {
  const [rows, setRows] = useState([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [marketQuery, setMarketQuery] = useState("");
  const [dateQuery, setDateQuery] = useState("");
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(targetPage = 1, reset = false) {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("page_size", "40");
      if (marketQuery.trim()) params.set("market_name", marketQuery.trim());
      if (dateQuery) params.set("date", dateQuery);
      const data = await api.delivererPayments(params.toString());
      const results = Array.isArray(data.results) ? data.results : [];
      setRows((prev) => (reset ? results : [...prev, ...results]));
      setNext(Boolean(data.next));
      setTodayTotal(Number(data.today_total || 0));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (user?.role_type !== "DELIVERER") return;
    setPage(1);
    setRows([]);
    setNext(false);
    load(1, true);
  }, [user?.role_type, user?.id]);

  const grouped = rows.reduce((acc, tx) => {
    const key = (tx.payment_date || "").slice(0, 10);
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(tx);
    return acc;
  }, {});

  const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  function resetFilters() {
    setMarketQuery("");
    setDateQuery("");
    setPage(1);
    setRows([]);
    setNext(false);
    load(1, true);
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <div className="h2" style={{ margin: 0 }}>Tranzaktsiyalar</div>
        <b>{money(todayTotal)}</b>
      </div>
      <div className="muted" style={{ marginBottom: 10 }}>Bugun qabul qilingan: {money(todayTotal)}</div>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setRows([]);
          setNext(false);
          load(1, true);
        }}
      >
        <input
          placeholder="Do'kon nomi bo'yicha qidirish"
          value={marketQuery}
          onChange={(e) => setMarketQuery(e.target.value)}
        />
        <DatePicker value={dateQuery} onChange={setDateQuery} />
        <div className="grid2">
          <button type="submit" className="btn secondary" disabled={busy}>{busy ? "Qidirilmoqda..." : "Qidirish"}</button>
          <button type="button" className="btn ghost" onClick={resetFilters}>Tozalash</button>
        </div>
      </form>
      <ErrorText error={error} />
      {sortedKeys.length ? sortedKeys.map((day) => {
        const dayRows = grouped[day];
        const dayTotal = dayRows.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
        return (
          <div className="card" key={day} style={{ marginTop: 12 }}>
            <div className="row">
              <b>{formatDate(day)}</b>
              <b>{money(dayTotal)}</b>
            </div>
            {dayRows.map((tx) => (
              <div className="list-item" key={tx.id}>
                <div className="row">
                  <span>{tx.market_name || "Do'kon"}</span>
                  <b>{money(tx.amount)}</b>
                </div>
                <div className="muted">{formatDateTime(tx.payment_date)}</div>
              </div>
            ))}
          </div>
        );
      }) : (
        !busy && <div className="empty">Hech qanday tranzaksiya topilmadi</div>
      )}
      {next && (
        <button type="button" className="btn secondary" disabled={busy} style={{ marginTop: 12 }} onClick={() => {
          const nextPage = page + 1;
          setPage(nextPage);
          load(nextPage, false);
        }}>
          {busy ? "Yuklanmoqda..." : "Yana yuklash"}
        </button>
      )}
    </div>
  );
}

export function ProfileScreen({ user, onLogout }) {
  const initials = `${(user.first_name || "A")[0]}${(user.last_name || "")[0] || ""}`.toUpperCase();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user.first_name || "");
  const [lastName, setLastName] = useState(user.last_name || "");
  const [photoFile, setPhotoFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e && e.preventDefault && e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let res;
      if (photoFile) {
        const fd = new FormData();
        fd.append("first_name", firstName);
        fd.append("last_name", lastName);
        fd.append("photo", photoFile);
        res = await api.updateUser(user.id, fd);
      } else {
        // If user cleared names or wants to clear photo, send JSON; to delete photo send { photo: null }
        const body = { first_name: firstName, last_name: lastName };
        res = await api.updateUser(user.id, body);
      }
      // Refresh current user and persist session
      const me = await api.me();
      saveSession({ user: me });
      // Reload to ensure App picks up new user state
      window.location.reload();
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  }

  async function deletePhoto() {
    if (!confirm("Rasm o'chirilsinmi?")) return;
    setBusy(true);
    setError("");
    try {
      await api.updateUser(user.id, { photo: null });
      const me = await api.me();
      saveSession({ user: me });
      window.location.reload();
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="card" style={{ textAlign: "center" }}>
        {user.photo ? (
          <img src={user.photo} alt="avatar" className="avatar" decoding="async" />
        ) : (
          <div className="avatar">{initials}</div>
        )}
        {!editing && <div className="h2" style={{ marginBottom: 2 }}>{user.first_name} {user.last_name}</div>}
        <span className="chip">{user.role_label || user.role_type}</span>
      </div>

      {editing ? (
        <form className="card stack" onSubmit={submit}>
          <input placeholder="Ism" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <input placeholder="Familiya" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0] || null)} />
          {error && <div className="error">{error}</div>}
          <div className="grid2">
            <button className="btn" disabled={busy}>{busy ? "Saqlanmoqda..." : "Saqlash"}</button>
            <button type="button" className="btn ghost" onClick={() => { setEditing(false); setError(""); setPhotoFile(null); setFirstName(user.first_name || ""); setLastName(user.last_name || ""); }}>Bekor qilish</button>
          </div>
        </form>
      ) : (
        <div>
          <div className="card">
            <div className="info-row"><span>Ism</span><b>{user.first_name || "—"} {user.last_name || ""}</b></div>
            <div className="info-row"><span>Lavozim</span><b>{user.role_label || user.role_type}</b></div>
            <div className="info-row"><span>Telefon</span><b>{user.phone_number || "—"}</b></div>
            <div className="info-row"><span>Ish boshlagan</span><b>{formatDateTime(user.created_at)}</b></div>
            <div className="info-row"><span>Oxirgi kirish</span><b>{formatDateTime(user.last_login)}</b></div>
          </div>

          <div className="stack">
            <button className="btn" onClick={() => setEditing(true)}>Profilni tahrirlash</button>
            {user.photo && <button className="btn secondary" onClick={deletePhoto}>Rasmni o'chirish</button>}
            <button className="btn ghost" onClick={onLogout}>Chiqish</button>
          </div>
          {error && <div className="error">{error}</div>}
        </div>
      )}
    </div>
  );
}

export function OrderListCard({ items, go, from, empty = "Buyurtma yo'q" }) {
  const groups = [];
  items.forEach((o) => {
    const day = o.created_date || (o.created_at || "").slice(0, 10);
    const last = groups[groups.length - 1];
    if (!last || last.day !== day) groups.push({ day, rows: [o] });
    else last.rows.push(o);
  });
  if (!items.length) return <div className="empty">{empty}</div>;
  return (
    <div>
      {groups.map((g) => (
        <div key={g.day}>
          <div className="date-head">{formatDate(g.day)}</div>
          <div className="card">
            {g.rows.map((o) => {
              const meta = orderStatusMeta(o.status_code, o.status);
              return (
                <div
                  className="list-item"
                  key={o.id}
                  onClick={() => { rememberBack(from); go(`#/orders/${o.id}`); }}
                >
                  <div className="row">
                    <b>{o.markent_name}</b>
                    <span className="badge" style={{ background: meta.color }}>{o.status}</span>
                  </div>
                  <div className="muted">{formatDateTime(o.created_at)} · {money(o.total_price_with_discount)}</div>
                  {takenByLabel(o) && <div className="muted">Olgan: {takenByLabel(o)}</div>}
                  {deliveredByLabel(o) && <div className="muted">Yetkazgan: {deliveredByLabel(o)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
