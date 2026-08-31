import { useEffect, useRef, useState } from "react";
import { api, lastBack, money, rememberBack, unitLabel } from "./api";
import {
  ErrorText,
  MapScreen,
  MarketsScreen,
  NewMarket,
  OrderFlow,
  OrderListCard,
  OrderView,
  ProfileScreen,
  ScreenHeader,
  TopBar,
  distMeters,
  esc,
  geoErrorMessage,
  orderStatusMeta,
  personName,
  formatDateTime,
  statusMeta,
  takenByLabel,
  deliveredByLabel,
  userIcon,
  ApproveToggle,
} from "./shared";

const TABS = [
  ["/", "Bugun", "📦"],
  ["/markets", "Do'konlar", "🏪"],
  ["/map", "Xarita", "🗺️"],
  ["/pending", "Tasdiq", "⏳"],
  ["/history", "Tarix", "📋"],
  ["/transactions", "Tranzaksiyalar", "💰"],
];

const ADMIN_TABS = [...TABS, ["/products", "Mahsulotlar", "🛒"], ["/users", "Xodimlar", "👥"]];

function formatDisplayDate(value) {
  if (!value) return "";
  const str = String(value).trim();
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const slash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const dd = String(Number(slash[1])).padStart(2, "0");
    const mm = String(Number(slash[2])).padStart(2, "0");
    return `${dd}/${mm}/${slash[3]}`;
  }
  const dash = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dash) {
    const dd = String(Number(dash[1])).padStart(2, "0");
    const mm = String(Number(dash[2])).padStart(2, "0");
    return `${dd}/${mm}/${dash[3]}`;
  }
  return str;
}

function parseDisplayDate(value) {
  if (!value) return "";
  const str = String(value).trim();
  const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return "";
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!year || !month || !day) return "";
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return "";
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function toISODateFromDisplay(value) {
  const display = parseDisplayDate(value);
  if (!display) return "";
  const [dd, mm, yyyy] = display.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

function toOrderBackendDate(value) {
  const parsed = parseDisplayDate(value);
  if (!parsed) return "";
  const [dd, mm, yyyy] = parsed.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

function toPaymentBackendDate(value) {
  return parseDisplayDate(value) || "";
}

function DateField({ label, value, onChange }) {
  return (
    <div style={{ flex: 1, minWidth: 130 }}>
      {label && <label className="muted" style={{ display: "block", marginBottom: 4 }}>{label}</label>}
      <input
        type="text"
        value={value || ""}
        placeholder="dd/mm/yyyy"
        inputMode="numeric"
        autoComplete="off"
        onChange={(e) => onChange(formatDisplayDate(e.target.value))}
        style={{ width: "100%" }}
        aria-label={label || "Date"}
      />
    </div>
  );
}

function nearestOrder(start, points) {
  const remaining = points.map((p) => ({ ...p }));
  const ordered = [];
  let cur = start;
  while (remaining.length) {
    let bestI = 0;
    let bestD = Infinity;
    remaining.forEach((p, i) => {
      const d = distMeters(cur, [p.lat, p.lng]);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    });
    const next = remaining.splice(bestI, 1)[0];
    next.straight_m = Math.round(bestD);
    ordered.push(next);
    cur = [next.lat, next.lng];
  }
  return ordered;
}

function uniqueMarkets(orders) {
  const seen = new Set();
  const out = [];
  (orders || []).forEach((o) => {
    const lat = o.market_location_latitude;
    const lng = o.market_location_longitude;
    if (lat == null || lng == null) return;
    const key = o.market_id;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      order_id: o.id,
      market_id: o.market_id,
      name: o.markent_name,
      lat,
      lng,
      status: o.market_status,
      status_code: o.market_status_code,
      status_color: o.market_status_color,
      image: o.market_image,
    });
  });
  return out;
}

function marketStatusColor(code, fallback) {
  const statusCode = (code || fallback || "").toString().trim().toUpperCase();
  const directMap = {
    PENDING: "#A855F7",
    WAITING: "#3B82F6",
    AVAILABLE: "#22C55E",
    POSSIBLE: "#F59E0B",
    NOT_NEEDED: "#EF4444",
  };
  if (directMap[statusCode]) return directMap[statusCode];
  if (typeof code === "string" && /^#[0-9a-fA-F]{3,8}$/.test(code.trim())) return code.trim();
  return statusMeta(statusCode, fallback).color || "#94a3b8";
}

function numberedIcon(n, color, big) {
  const size = big ? 34 : 26;
  return window.L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="num-marker ${big ? "big" : ""}" style="background:${color || "#0f9f6e"}">${n}</div>`,
  });
}

function TodayScreen({ go }) {
  const [counts, setCounts] = useState(null);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [c, o] = await Promise.all([
        api.todayCount(),
        api.orders("?status=APPROVED&page_size=200"),
      ]);
      setCounts(c);
      setOrders(o.results || o);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  const products = counts?.counts_of_each_product || [];

  return (
    <div>
      <ErrorText error={error} />
      <div className="card today-hero">
        <div className="row">
          <div>
            <div className="muted">Tasdiqlangan buyurtmalar</div>
            <div className="stat">{counts?.total_count_of_orders ?? "—"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="muted">Jami</div>
            <b>{money(counts?.total_price_with_discount)}</b>
          </div>
        </div>
        <button className="btn" style={{ marginTop: 12 }} onClick={() => go("#/near")}>
          Yaqin yo'llar
        </button>
      </div>

      <div className="card">
        <div className="h2">Qolgan mahsulotlar</div>
        {products.length ? products.map((p) => (
          <div className="list-item plain-item" key={`${p.product_name}-${p.unit}`}>
            <div className="row">
              <span>{p.product_name}</span>
              <b>{p.total_quantity} {unitLabel(p.unit)}</b>
            </div>
          </div>
        )) : (
          <div className="muted">Bugun qolgan mahsulot yo'q</div>
        )}
      </div>

      {orders.map((o) => {
        const meta = orderStatusMeta(o.status_code, o.status);
        return (
          <div
            className="card"
            key={o.id}
            onClick={() => { rememberBack("#/" ); go(`#/orders/${o.id}`); }}
            style={{ cursor: "pointer" }}
          >
            <div className="row">
              <b>{o.markent_name}</b>
              <span className="badge" style={{ background: meta.color }}>{o.status}</span>
            </div>
            <div className="muted">{o.created_at} · {money(o.total_price_with_discount)}</div>
            {takenByLabel(o) && <div className="muted">Olgan: {takenByLabel(o)}</div>}
            {deliveredByLabel(o) && <div className="muted">Yetkazgan: {deliveredByLabel(o)}</div>}
          </div>
        );
      })}
      {!orders.length && <div className="empty">Bugun tasdiqlangan buyurtma yo'q</div>}
    </div>
  );
}

function NearWaysScreen({ go }) {
  const [rows, setRows] = useState([]);
  const [ordered, setOrdered] = useState([]);
  const [error, setError] = useState("");
  const [routeNote, setRouteNote] = useState("Joylashuv olinmoqda...");
  const [nextName, setNextName] = useState("");
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const userRef = useRef(null);
  const routeRef = useRef(null);
  const hereRef = useRef(null);
  const headingRef = useRef(0);
  const rowsRef = useRef([]);
  rowsRef.current = rows;

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
          drawUser();
          resolve(hereRef.current);
        },
        reject,
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
      );
    });
  }

  async function drawRouteLine(here, stops) {
    const map = mapRef.current;
    if (!map || !stops.length) {
      if (routeRef.current && map) {
        map.removeLayer(routeRef.current);
        routeRef.current = null;
      }
      return;
    }
    const coords = [here, ...stops.map((s) => [s.lat, s.lng])]
      .map((p) => `${p[1]},${p[0]}`)
      .join(";");
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
      );
      const data = await res.json();
      const geometry = data?.routes?.[0]?.geometry;
      if (!geometry) {
        setRouteNote("Yo'nalish chizilmadi. Qayta urinib ko'ring.");
        return;
      }
      if (routeRef.current) map.removeLayer(routeRef.current);
      routeRef.current = window.L.geoJSON(geometry, {
        style: { color: "#0f9f6e", weight: 5, opacity: 0.88 },
      }).addTo(map);
      const b = routeRef.current.getBounds();
      if (b.isValid()) map.fitBounds(b, { padding: [48, 48], maxZoom: 15 });
      setRouteNote("");
    } catch {
      setRouteNote("Yo'nalish chizilmadi. Internetni tekshiring.");
    }
  }

  function paintStops(stops) {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !window.L) return;
    layer.clearLayers();
    stops.forEach((m, i) => {
      const color = m.status_color || statusMeta(m.status_code, m.status).color;
      const label = statusMeta(m.status_code, m.status).label;
      const photo = m.image
        ? `<img src="${esc(m.image)}" alt="${esc(m.name)}" />`
        : `<div class="ph">Rasm yo‘q</div>`;
      const marker = window.L.marker([m.lat, m.lng], {
        icon: numberedIcon(i + 1, color, i === 0),
        zIndexOffset: 200 - i,
      }).addTo(layer);
      marker.bindPopup(
        `<div class="pop-card">${photo}<b>${i + 1}. ${esc(m.name)}</b><div class="muted">${esc(label)}</div><div class="pop-actions"><a class="pop-open" href="#/orders/${m.order_id}" style="grid-column:1/-1">Buyurtmani ochish</a></div></div>`,
        { maxWidth: 230, minWidth: 200 }
      );
    });
  }

  async function plan(list) {
    const points = uniqueMarkets(list);
    let here;
    try {
      here = hereRef.current || await requestHere();
    } catch (err) {
      setRouteNote(geoErrorMessage(err));
      setOrdered(points);
      paintStops(points);
      return;
    }
    drawUser();
    if (!points.length) {
      setOrdered([]);
      paintStops([]);
      if (routeRef.current && mapRef.current) {
        mapRef.current.removeLayer(routeRef.current);
        routeRef.current = null;
      }
      setNextName("");
      setRouteNote("Yetkaziladigan do'kon qolmadi");
      return;
    }
    const stops = nearestOrder(here, points);
    setOrdered(stops);
    setNextName(stops[0] ? `${stops[0].name} · ${stops[0].straight_m} m` : "");
    paintStops(stops);
    await drawRouteLine(here, stops);
  }

  const planRef = useRef(plan);
  planRef.current = plan;

  async function loadAndPlan() {
    try {
      const [data, markets] = await Promise.all([api.todayMarkets(), api.markets()]);
      const list = Array.isArray(data) ? data : data.results || [];
      const byId = {};
      (Array.isArray(markets) ? markets : markets.results || []).forEach((m) => {
        byId[m.id] = m;
      });
      const merged = list.map((o) => {
        const m = byId[o.market_id] || {};
        return {
          ...o,
          market_status: o.market_status || m.status,
          market_status_code: o.market_status_code || m.status_code,
          market_status_color: o.market_status_color || m.status_color_code,
          market_image: o.market_image || m.image,
        };
      });
      setRows(merged);
      setError("");
      await planRef.current(merged);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    const el = document.getElementById("near-map");
    if (!el || !window.L) return;
    const map = window.L.map(el, { zoomControl: false }).setView([41.31, 69.24], 12);
    window.L.control.zoom({ position: "bottomleft" }).addTo(map);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    layerRef.current = window.L.layerGroup().addTo(map);

    let watchId = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition((pos) => {
        const first = !hereRef.current;
        hereRef.current = [pos.coords.latitude, pos.coords.longitude];
        if (pos.coords.heading != null && !Number.isNaN(pos.coords.heading) && pos.coords.heading >= 0) {
          headingRef.current = pos.coords.heading;
        }
        drawUser();
        if (first && rowsRef.current.length) planRef.current(rowsRef.current);
      }, (err) => {
        if (err && err.code === 1) setRouteNote(geoErrorMessage(err));
      }, { enableHighAccuracy: true, maximumAge: 3000 });
    }

    function onOrient(e) {
      let heading = e.webkitCompassHeading;
      if (heading == null && e.alpha != null) heading = (360 - e.alpha) % 360;
      if (heading == null || Number.isNaN(heading)) return;
      headingRef.current = heading;
      drawUser();
    }
    window.addEventListener("deviceorientationabsolute", onOrient);
    window.addEventListener("deviceorientation", onOrient);

    rememberBack("#/near");
    loadAndPlan();
    const timer = setInterval(loadAndPlan, 15000);

    return () => {
      clearInterval(timer);
      window.removeEventListener("deviceorientationabsolute", onOrient);
      window.removeEventListener("deviceorientation", onOrient);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      map.remove();
      mapRef.current = null;
      userRef.current = null;
      routeRef.current = null;
    };
  }, []);

  function recenter() {
    if (typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) {
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
    requestHere()
      .then((here) => {
        if (mapRef.current) mapRef.current.flyTo(here, 16);
        planRef.current(rowsRef.current);
      })
      .catch((err) => setRouteNote(geoErrorMessage(err)));
  }

  return (
    <div>
      <ScreenHeader title="Yaqin yo'llar" backTo="#/" go={go} />
      {nextName && (
        <div className="near-banner">
          <div className="muted">Keyingi do'kon</div>
          <b>{nextName}</b>
        </div>
      )}
      <ErrorText error={error} />
      <div className="map-wrap">
        <div id="near-map" className="map" style={{ height: "52vh" }} />
        <div className="map-actions">
          <button type="button" className="me-btn" onClick={recenter}>Mening joyim</button>
        </div>
      </div>
      {routeNote && <div className={routeNote.includes("qolmadi") ? "muted" : "error"} style={{ marginTop: 8 }}>{routeNote}</div>}
      <div className="card" style={{ marginTop: 10 }}>
        <div className="h2">Ketma-ketlik (eng yaqindan)</div>
        {ordered.map((m, i) => (
          <div
            className="list-item"
            key={m.market_id}
            onClick={() => { rememberBack("#/near"); go(`#/orders/${m.order_id}`); }}
          >
            <div className="row">
              <span>
                <span className="dot" style={{ background: m.status_color || statusMeta(m.status_code, m.status).color }} />
                <b>{i + 1}.</b> {m.name}
              </span>
              <span className="muted">{m.straight_m != null ? `${m.straight_m} m` : ""}</span>
            </div>
            <div className="muted">{statusMeta(m.status_code, m.status).label}</div>
          </div>
        ))}
        {!ordered.length && <div className="muted">Xaritada ko'rsatiladigan do'kon yo'q</div>}
      </div>
    </div>
  );
}

function MarketHub({ marketId, go }) {
  const [market, setMarket] = useState(null);
  const [stats, setStats] = useState(null);
  const [debts, setDebts] = useState([]);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusDraft, setStatusDraft] = useState("AVAILABLE");

  async function load() {
    try {
      const [m, s, d] = await Promise.all([
        api.market(marketId),
        api.analyticsDetail(marketId).catch(() => null),
        api.marketDebts(marketId).catch(() => []),
      ]);
      setMarket(m);
      setStatusDraft((m?.status_code || m?.status || "AVAILABLE").toUpperCase());
      setStats(s);
      const rows = Array.isArray(d) ? d : d.results || [];
      setDebts(rows);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, [marketId]);

  async function submitPay(e) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) {
      setError("To'lov summasi 0 dan katta bo'lishi kerak");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.pay({ market_id: marketId, amount: value });
      setAmount("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateMarketStatus(nextStatus) {
    if (statusBusy || !nextStatus) return;
    const current = (market?.status_code || market?.status || "").toUpperCase();
    if (nextStatus === current) return;
    setStatusBusy(true);
    setError("");
    try {
      await api.setMarketStatus(marketId, nextStatus);
      const nextColor = marketStatusColor(nextStatus, nextStatus);
      setMarket((prev) => prev ? {
        ...prev,
        status: nextStatus,
        status_code: nextStatus,
        status_color_code: nextColor,
      } : prev);
      setStatusDraft(nextStatus);
      setStats((prev) => prev ? { ...prev, status: nextStatus, status_code: nextStatus } : prev);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setStatusBusy(false);
    }
  }

  if (!market) {
    return (
      <div>
        <ScreenHeader title="Do'kon" backTo={lastBack("#/markets")} go={go} />
        <div className="card">{error || "Yuklanmoqda..."}</div>
      </div>
    );
  }
  const meta = statusMeta(market.status_code, market.status);
  const credit = stats?.credit_amount ?? market.credit_amount ?? 0;
  const debtTotal = stats?.total_debt != null
    ? stats.total_debt
    : debts.reduce((sum, o) => sum + Number(o.remaining_debt || 0), 0);
  const currentStatus = (market.status_code || market.status || "AVAILABLE").toUpperCase();
  const marketStatusOptions = [
    { value: "AVAILABLE", label: "Mahsulotlar mavjud" },
    { value: "POSSIBLE", label: "Mahsulot kerak bo'lishi mumkin" },
    { value: "NOT_NEEDED", label: "Mahsulot kerak bo'lmasligi mumkin" },
  ];

  return (
    <div>
      <ScreenHeader title={market.name} backTo={lastBack("#/markets")} go={go} />
      {market.image && <img className="market-hero" src={market.image} alt={market.name} />}
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <span className="ring" style={{ borderColor: "transparent" }}>
            <span className="core" style={{ background: market.status_color_code || meta.color }} />
          </span>
          <div style={{ flex: 1 }}>
            <b>{meta.label}</b>
            {personName(market.last_order_taken_by) && (
              <div className="muted">Oxirgi olgan: {personName(market.last_order_taken_by)}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <select
            value={statusDraft}
            onChange={(e) => setStatusDraft(e.target.value)}
            disabled={statusBusy}
            style={{ flex: 1, minWidth: 0 }}
          >
            {marketStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn secondary"
            disabled={statusBusy || statusDraft === currentStatus}
            onClick={() => updateMarketStatus(statusDraft)}
            style={{ width: 'auto', minWidth: 90, padding: '9px 12px', fontSize: 12, borderRadius: 10 }}
          >
            {statusBusy ? '...' : 'Saqlash'}
          </button>
        </div>
      </div>
      <div className="stack">
        <button className="btn" onClick={() => go(`#/markets/${marketId}/order`)}>Buyurtma olish</button>
        <button className="btn secondary" onClick={() => go(`#/markets/${marketId}/orders`)}>
          Barcha buyurtmalar
        </button>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="info-row"><span>Balans</span><b>{money(credit)}</b></div>
        <div className="info-row"><span>Qarz</span><b>{money(debtTotal)}</b></div>
      </div>

      <form className="card stack" onSubmit={submitPay}>
        <div className="h2">To'lov qabul qilish</div>
        <input
          type="number"
          inputMode="decimal"
          min="1"
          step="1"
          placeholder="Summa, so'm"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button className="btn" disabled={busy}>{busy ? "Saqlanmoqda..." : "Qabul qilish"}</button>
      </form>
      <ErrorText error={error} />

      <div className="stack" style={{ marginTop: 12 }}>
        <button className="btn secondary" type="button" onClick={() => go(`#/markets/${marketId}/payments`)}>
          To'lovlar
        </button>
        <button className="btn secondary" type="button" onClick={() => go(`#/markets/${marketId}/debts`)}>
          Qarzdagi buyurtmalar
        </button>
      </div>
    </div>
  );
}

function MarketPaymentsScreen({ marketId, go }) {
  const [rows, setRows] = useState([]);
  const [market, setMarket] = useState(null);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(currentPage = 1) {
    setBusy(true);
    setError("");
    try {
      const d = await api.payments(marketId, `page=${currentPage}&page_size=40`);
      const results = Array.isArray(d.results) ? d.results : [];
      setRows((prev) => (currentPage > 1 ? prev.concat(results) : results));
      setPage(currentPage);
      setNext(Boolean(d.next));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    api.market(marketId).then(setMarket).catch(() => {});
    load(1);
  }, [marketId]);

  return (
    <div>
      <ScreenHeader title={market?.name || "To'lovlar"} backTo={`#/markets/${marketId}`} go={go} />
      <ErrorText error={error} />
      {rows.map((p) => (
        <div className="card" key={p.id} style={{ marginTop: 12 }}>
          <div className="row">
            <b>{formatDateTime(p.payment_date)}</b>
            <b>{money(p.amount)}</b>
          </div>
          {p.taken_by && <div className="muted">Qabul qilgan: {personName(p.taken_by)}</div>}
          <div className="muted">Taqsimlangan: {money(p.allocated_total || 0)}</div>
        </div>
      ))}
      {!rows.length && !busy && <div className="empty">To'lovlar yo'q</div>}
      {next && (
        <button className="btn secondary" disabled={busy} style={{ marginTop: 12 }} onClick={() => load(page + 1)}>
          {busy ? "Yuklanmoqda..." : "Yana yuklash"}
        </button>
      )}
    </div>
  );
}

function MarketDebtOrdersScreen({ marketId, go }) {
  const [items, setItems] = useState([]);
  const [market, setMarket] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.market(marketId).then(setMarket).catch(() => {});
    api.marketDebts(marketId).then((d) => { const rows = Array.isArray(d) ? d : d.results || []; setItems(rows); }).catch((e) => setError(e.message));
  }, [marketId]);

  return (
    <div>
      <ScreenHeader title={market?.name || "Qarzdagi buyurtmalar"} backTo={`#/markets/${marketId}`} go={go} />
      <ErrorText error={error} />
      {items.map((o) => {
        const taken = takenByLabel(o) || personName(o.ordered_by);
        const given = deliveredByLabel(o) || personName(o.delivered_by);
        return (
          <div
            className="card"
            key={o.id}
            onClick={() => { rememberBack(`#/markets/${marketId}/debts`); go(`#/orders/${o.id}`); }}
            style={{ cursor: "pointer" }}
          >
            <div className="row">
              <b>{o.created_at}</b>
              <span className="badge" style={{ background: orderStatusMeta(o.status_code || o.status, o.status).color }}>
                Qarz
              </span>
            </div>
            {taken && <div className="muted">Olgan: {taken}</div>}
            {given && <div className="muted">Yetkazgan: {given}</div>}
            <div className="info-row"><span>Jami</span><b>{money(o.total_price_with_discount)}</b></div>
            <div className="info-row"><span>To'langan</span><b>{money(o.allocated_amount)}</b></div>
            <div className="info-row"><span>Qolgan qarz</span><b>{money(o.remaining_debt)}</b></div>
          </div>
        );
      })}
      {!items.length && !error && <div className="empty">Qarzdor buyurtma yo'q</div>}
    </div>
  );
}

function MarketOrdersScreen({ marketId, go }) {
  const [items, setItems] = useState([]);
  const [market, setMarket] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.market(marketId).then(setMarket).catch(() => {});
    api.orders(`?market_id=${marketId}&page_size=200`)
      .then((d) => {
        const rows = d.results || d;
        setItems(rows.filter((o) => String(o.market_id) === String(marketId)));
      })
      .catch((e) => setError(e.message));
  }, [marketId]);

  return (
    <div>
      <ScreenHeader title={market?.name || "Buyurtmalar"} backTo={`#/markets/${marketId}`} go={go} />
      <ErrorText error={error} />
      <OrderListCard
        items={items}
        go={go}
        from={`#/markets/${marketId}/orders`}
        empty="Bu do'konda buyurtma yo'q"
      />
    </div>
  );
}

function PendingScreen({ go }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    try {
      const [pending, approved] = await Promise.all([
        api.orders("?status=PENDING&page_size=200"),
        api.orders("?status=APPROVED&page_size=200"),
      ]);
      const rows = [...(pending.results || pending), ...(approved.results || approved)];
      const uniq = [];
      const seen = new Set();
      rows.forEach((o) => {
        if (seen.has(o.id)) return;
        seen.add(o.id);
        uniq.push(o);
      });
      setItems(uniq);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  const visible = items.filter((o) => {
    if (filter === "pending") return o.status_code === "PENDING";
    if (filter === "approved") return o.status_code === "APPROVED";
    return true;
  });

  async function toggleApprove(o, e) {
    e.stopPropagation();
    const next = o.status_code === "APPROVED" ? "PENDING" : "APPROVED";
    setBusyId(o.id);
    setError("");
    try {
      await api.setOrderStatus(o.id, next);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  return (
    <div>
      <ErrorText error={error} />
      <div className="chips">
        {[
          ["all", "Hammasi"],
          ["pending", "Kutilmoqda"],
          ["approved", "Tasdiqlangan"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`chip-btn ${filter === key ? "on" : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {visible.map((o) => {
        const meta = orderStatusMeta(o.status_code, o.status);
        const approved = o.status_code === "APPROVED";
        const taken = takenByLabel(o);
        return (
          <div className="card select-card" key={o.id}>
            <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1 }} onClick={() => { rememberBack("#/pending"); go(`#/orders/${o.id}`); }}>
                <div className="row">
                  <b>{o.markent_name}</b>
                  <span className="badge" style={{ background: meta.color }}>{o.status}</span>
                </div>
                <div className="muted">{o.created_at} · {money(o.total_price_with_discount)}</div>
                {taken && <div className="muted">Olgan: {taken}</div>}
                {deliveredByLabel(o) && <div className="muted">Yetkazgan: {deliveredByLabel(o)}</div>}
              </div>
              <ApproveToggle
                approved={approved}
                busy={busyId === o.id}
                onClick={(e) => toggleApprove(o, e)}
              />
            </div>
          </div>
        );
      })}
      {!visible.length && <div className="empty">Bu bo‘limda buyurtma yo'q</div>}
    </div>
  );
}

function HistoryScreen({ go }) {
  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [marketQuery, setMarketQuery] = useState("");
  const [dateQuery, setDateQuery] = useState("");

  async function load(url, qs = null) {
    setBusy(true);
    try {
      const d = url
        ? await api.requestPage(url)
        : await api.orders(qs || `?page_size=${dateQuery ? 10000 : 40}`);
      const rows = d.results || d;
      setItems((prev) => (url ? prev.concat(rows) : rows));
      setNext(dateQuery ? null : (d.next || null));
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function runSearch(e) {
    e.preventDefault();
    const params = new URLSearchParams({ page_size: dateQuery ? "10000" : "40" });
    if (marketQuery.trim()) params.set("search", marketQuery.trim());
    if (dateQuery) params.set("date", toOrderBackendDate(dateQuery));
    setItems([]);
    setNext(null);
    await load(null, `?${params.toString()}`);
  }

  useEffect(() => {
    load(null, "?page_size=40");
  }, []);

  return (
    <div>
      <form className="card stack" style={{ marginBottom: 10 }} onSubmit={runSearch}>
        <input
          placeholder="Do'kon nomi bo'yicha qidirish"
          value={marketQuery}
          onChange={(e) => setMarketQuery(e.target.value)}
        />
        <DateField value={dateQuery} onChange={setDateQuery} />
        <button type="submit" className="btn secondary" disabled={busy}>{busy ? "Qidirilmoqda..." : "Qidirish"}</button>
      </form>
      <ErrorText error={error} />
      <OrderListCard items={items} go={go} from="#/history" empty="Buyurtmalar tarixi bo'sh" />
      {next && (
        <button className="btn secondary" disabled={busy} onClick={() => load(next)}>
          {busy ? "Yuklanmoqda..." : "Yana yuklash"}
        </button>
      )}
    </div>
  );
}

function TransactionsScreen({ go }) {
  const [rows, setRows] = useState([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [marketQuery, setMarketQuery] = useState("");
  const [dateQuery, setDateQuery] = useState("");
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(currentPage = 1, qs = null) {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams(qs ? qs.replace(/^\?/, "") : "");
      const hasDateFilter = Boolean(params.get("date"));
      params.set("page", String(currentPage));
      params.set("page_size", hasDateFilter ? "10000" : "40");
      const d = await api.delivererPayments(`?${params.toString()}`);
      const results = Array.isArray(d.results) ? d.results : [];
      setRows((prev) => (currentPage > 1 ? prev.concat(results) : results));
      setPage(currentPage);
      setNext(hasDateFilter ? false : Boolean(d.next));
      setTodayTotal(Number(d.today_total || 0));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runSearch(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (marketQuery.trim()) params.set("market_name", marketQuery.trim());
    if (dateQuery) params.set("date", toPaymentBackendDate(dateQuery));
    setRows([]);
    setNext(false);
    await load(1, `?${params.toString()}`);
  }

  useEffect(() => {
    load(1, "?page_size=40");
  }, []);

  const grouped = rows.reduce((acc, tx) => {
    const key = (tx.payment_date || "").slice(0, 10);
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(tx);
    return acc;
  }, {});

  const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row">
          <div className="h2" style={{ margin: 0 }}>Tranzaksiyalar</div>
          <b>{money(todayTotal)}</b>
        </div>
        <div className="muted">Bugun qabul qilingan: {money(todayTotal)}</div>
      </div>
      <form className="card stack" style={{ marginBottom: 10 }} onSubmit={runSearch}>
        <input
          placeholder="Do'kon nomi bo'yicha qidirish"
          value={marketQuery}
          onChange={(e) => setMarketQuery(e.target.value)}
        />
        <DateField value={dateQuery} onChange={setDateQuery} />
        <button type="submit" className="btn secondary" disabled={busy}>{busy ? "Qidirilmoqda..." : "Qidirish"}</button>
      </form>
      <ErrorText error={error} />
      {sortedKeys.length ? sortedKeys.map((day) => {
        const dayRows = grouped[day];
        const dayTotal = dayRows.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
        return (
          <div className="card" key={day} style={{ marginTop: 12 }}>
            <div className="row">
              <b>{new Date(`${day}T00:00:00`).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" })}</b>
              <b>{money(dayTotal)}</b>
            </div>
            {dayRows.map((tx) => (
              <div className="list-item" key={tx.id}>
                <div className="row">
                  <span>{tx.market_name || "Do'kon"}</span>
                  <b>{money(tx.amount)}</b>
                </div>
                <div className="muted">
                  {tx.taken_by ? `${personName(tx.taken_by)} · ` : ""}
                  {new Date(tx.payment_date).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        );
      }) : (!busy && <div className="empty">Hech qanday tranzaksiya topilmadi</div>)}
      {next && (
        <button className="btn secondary" disabled={busy} style={{ marginTop: 12 }} onClick={() => load(page + 1, `?${new URLSearchParams({
          page: String(page + 1),
          page_size: "40",
          ...(marketQuery.trim() ? { market_name: marketQuery.trim() } : {}),
          ...(dateQuery ? { date: dateQuery } : {}),
        }).toString()}`)}>
          {busy ? "Yuklanmoqda..." : "Yana yuklash"}
        </button>
      )}
    </div>
  );
}

function MarketStatisticsScreen({ go, compact = false }) {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [inactiveDays, setInactiveDays] = useState("");
  const [hasDebt, setHasDebt] = useState(false);
  const [ordering, setOrdering] = useState("-days_since_last_order");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [statusChoice, setStatusChoice] = useState("WAITING");
  const [totals, setTotals] = useState({ market_count: 0, markets_with_debt: 0, total_debt: 0 });

  useEffect(() => {
    if (compact) return;
    try {
      const savedSelection = JSON.parse(sessionStorage.getItem("market-statistics-selection") || "[]");
      if (Array.isArray(savedSelection) && savedSelection.length) setSelected(new Set(savedSelection));
      const savedFilters = JSON.parse(sessionStorage.getItem("market-statistics-filters") || "null");
      if (savedFilters) {
        setSearch(savedFilters.search || "");
        setInactiveDays(savedFilters.inactiveDays || "");
        setHasDebt(Boolean(savedFilters.hasDebt));
        setOrdering(savedFilters.ordering || "-days_since_last_order");
      }
    } catch {
      // ignore stale session data
    }
  }, [compact]);

  useEffect(() => {
    if (compact) return;
    sessionStorage.setItem("market-statistics-selection", JSON.stringify([...selected]));
  }, [compact, selected]);

  useEffect(() => {
    if (compact) return;
    sessionStorage.setItem("market-statistics-filters", JSON.stringify({ search, inactiveDays, hasDebt, ordering }));
  }, [compact, search, inactiveDays, hasDebt, ordering]);

  async function load(qs = null) {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page_size", "10000");
      if (search.trim()) params.set("search", search.trim());
      if (inactiveDays) params.set("inactive_days", String(Number(inactiveDays) || 0));
      if (hasDebt || compact) params.set("has_debt", "true");
      if (ordering && !compact) params.set("ordering", ordering);

      const [raw, summary] = await Promise.all([
        api.analyticsActivity(`?${params.toString()}`),
        api.analyticsSummary(),
      ]);

      let list = Array.isArray(raw.results) ? raw.results : raw.results || [];
      if (compact) {
        const debtRows = await Promise.all(
          list.map(async (market) => {
            try {
              const debtData = await api.marketDebts(market.id, "?page_size=200");
              const debtOrders = Array.isArray(debtData) ? debtData : (debtData.results || []);
              const debtTotal = Number(market.total_debt || 0);
              if (!debtOrders.length || debtTotal <= 0) return null;
              const dates = debtOrders
                .map((item) => item.created_at || item.payment_date || item.updated_at)
                .filter(Boolean)
                .map((value) => new Date(value))
                .filter((date) => !Number.isNaN(date.getTime()));
              const oldestDate = dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : null;
              return {
                id: market.id,
                name: market.name,
                debt_total: debtTotal,
                debt_date: oldestDate ? oldestDate.toISOString() : null,
              };
            } catch {
              return null;
            }
          })
        );
        list = debtRows.filter(Boolean).sort((a, b) => {
          const left = a.debt_date ? new Date(a.debt_date).getTime() : Number.MAX_SAFE_INTEGER;
          const right = b.debt_date ? new Date(b.debt_date).getTime() : Number.MAX_SAFE_INTEGER;
          return left - right;
        });
        setRows(list);
        setTotals({ market_count: list.length, markets_with_debt: list.length, total_debt: list.reduce((sum, row) => sum + Number(row.debt_total || 0), 0) });
        return;
      }

      const nextRows = list.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status || r.status_display || r.status_code,
        status_code: r.status_code || r.status,
        status_color: r.status_color || r.status_color_code || marketStatusColor(r.status_code || r.status, r.status_display || r.status),
        status_display: r.status_display || r.status || (r.status_code ? statusMeta(r.status_code, r.status).label : ""),
        days_since_last_order: r.days_since_last_order != null ? r.days_since_last_order : null,
        avg_days_between_orders: r.avg_days_between_orders != null ? Number(r.avg_days_between_orders) : null,
        total_debt: Number(r.total_debt || 0),
      }));
      setRows(nextRows);

      setTotals({
        market_count: Number(summary.market_count || 0),
        markets_with_debt: Number(summary.markets_with_debt || 0),
        total_debt: Number(summary.total_debt || 0),
      });

      const validIds = new Set(nextRows.map((r) => r.id));
      setSelected((prev) => new Set([...prev].filter((id) => validIds.has(id))));
      setSelectAll(false);
    } catch (e) {
      setError(e.message || String(e));
      setRows([]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, [compact]);

  function toggleOne(id) {
    if (compact) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
    setSelectAll(next.size > 0 && next.size === rows.length);
  }

  function toggleAll() {
    if (compact) return;
    if (selectAll) {
      setSelected(new Set());
      setSelectAll(false);
    } else {
      const all = new Set(rows.map((r) => r.id));
      setSelected(all);
      setSelectAll(true);
    }
  }

  async function bulkUpdateStatus() {
    if (compact) return;
    if (!selected.size) {
      setError("Iltimos kamida bitta do'kon tanlang");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.bulkMarketStatus({ market_ids: Array.from(selected), status: statusChoice });
      setSelected(new Set());
      setSelectAll(false);
      await load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  if (compact) {
    return (
      <div>
        <ScreenHeader title="Qarzli do'konlar" backTo="#/markets" go={go} />
        <ErrorText error={error} />
        <div className="muted" style={{ margin: '8px 4px 10px', fontSize: 12 }}>
          {rows.length} ta do'kon
        </div>
        {rows.length ? rows.map((m) => (
          <div
            key={m.id}
            className="card"
            onClick={() => {
              rememberBack('#/markets/statistics');
              go(`#/markets/${m.id}`);
            }}
            style={{ marginBottom: 8, padding: 12, cursor: 'pointer' }}
          >
            <div className="row" style={{ alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, lineHeight: 1.3 }}>{m.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {m.debt_date ? new Date(m.debt_date).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontWeight: 700 }}>{money(m.debt_total)}</div>
            </div>
          </div>
        )) : (!busy && <div className="empty">Qarzli do'konlar yo'q</div>)}
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="Do'konlar statistikasi" backTo="#/markets" go={go} />

      <div className="card" style={{ marginBottom: 10, padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <div style={{ background: '#f8fafc', borderRadius: 14, padding: '10px 12px' }}>
            <div className="muted" style={{ fontSize: 11 }}>Do'konlar</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{totals.market_count}</div>
          </div>
          <div style={{ background: '#fff7ed', borderRadius: 14, padding: '10px 12px' }}>
            <div className="muted" style={{ fontSize: 11 }}>Qarzli</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{totals.markets_with_debt}</div>
          </div>
          <div style={{ background: '#ecfdf5', borderRadius: 14, padding: '10px 12px' }}>
            <div className="muted" style={{ fontSize: 11 }}>Jami qarz</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{money(totals.total_debt)}</div>
          </div>
        </div>
      </div>

      <div className="card stack" style={{ marginBottom: 10, padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(120px, 0.7fr)', gap: 8 }}>
          <input placeholder="Do'kon qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <input placeholder="Inaktiv kun" value={inactiveDays} onChange={(e) => setInactiveDays(e.target.value)} inputMode="numeric" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 30 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#334155', margin: 0 }}>
              <input type="checkbox" checked={hasDebt} onChange={(e) => setHasDebt(e.target.checked)} />
              <span>Qarz bor do'konlar</span>
            </label>
          </div>
          <select value={ordering} onChange={(e) => setOrdering(e.target.value)} style={{ width: '100%' }}>
            <option value="-days_since_last_order">Eng eskilar birinchi</option>
            <option value="avg_days_between_orders">O'rtacha oralik (kichikdan katta)</option>
            <option value="-avg_days_between_orders">O'rtacha oralik (katadan kichik)</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn secondary" onClick={() => load()} disabled={busy} style={{ flex: '1 1 120px', minWidth: 110, padding: '10px 12px', fontSize: 13 }}>{busy ? 'Yuklanmoqda...' : 'Filtrlash'}</button>
          <button className="btn ghost" onClick={() => { setSearch(''); setInactiveDays(''); setHasDebt(false); setOrdering('-days_since_last_order'); sessionStorage.removeItem('market-statistics-filters'); load(); }} style={{ flex: '0 0 auto', minWidth: 92, padding: '10px 12px', fontSize: 13 }}>Tozalash</button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingTop: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#334155' }}>
            <input type="checkbox" checked={selectAll} onChange={toggleAll} />
            Hammasini tanlash
          </label>
          <select value={statusChoice} onChange={(e) => setStatusChoice(e.target.value)} style={{ flex: '1 1 180px', minWidth: 150 }}>
            <option value="AVAILABLE">Mahsulotlar mavjud</option>
            <option value="POSSIBLE">Mahsulot kerak bo'lishi mumkin</option>
            <option value="NOT_NEEDED">Mahsulot kerak bo'lmasligi mumkin</option>
          </select>
          <button className="btn" onClick={bulkUpdateStatus} disabled={busy || selected.size===0} style={{ flex: '1 1 180px', minWidth: 150, padding: '10px 12px', fontSize: 13 }}>Tanlanganlarni yangilash</button>
          <button className="btn ghost" onClick={() => setSelected(new Set())} disabled={busy || selected.size===0} style={{ flex: '0 0 auto', minWidth: 110, padding: '10px 12px', fontSize: 13 }}>Tanlovni tozalash</button>
        </div>
      </div>

      <ErrorText error={error} />

      <div className="muted" style={{ margin: '0 4px 8px', fontSize: 12 }}>
        Ko'rsatilgan: {rows.length} do'kon
      </div>

      <div>
        {rows.length ? rows.map((m) => {
          const statusColor = marketStatusColor(m.status_code || m.status, m.status_display || m.status);
          return (
            <div key={m.id} className="card" style={{ marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center', padding: 10 }}>
              <div style={{ width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleOne(m.id)} />
              </div>
              <div
                style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
                onClick={(e) => {
                  if (e.target.closest('input')) return;
                  rememberBack('#/markets/statistics');
                  go(`#/markets/${m.id}`);
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span className="dot" style={{ background: statusColor, width: 12, height: 12 }} />
                      <div style={{ fontWeight: 800, lineHeight: 1.3 }}>{m.name}</div>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>{m.status_display}</div>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div className="muted" style={{ fontSize: 12 }}>Oxirgi: {m.days_since_last_order != null ? `${m.days_since_last_order} kun` : '—'}</div>
                    <div className="muted" style={{ fontSize: 12 }}>O'rta: {m.avg_days_between_orders != null ? `${m.avg_days_between_orders.toFixed(1)} kun` : '—'}</div>
                  </div>
                </div>
              </div>
              <div style={{ width: 110, textAlign: 'right', whiteSpace: 'nowrap', fontSize: 13 }}>
                <div className="muted">Qarz:</div>
                <div style={{ fontWeight: 700 }}>{money(m.total_debt)}</div>
              </div>
            </div>
          );
        }) : (!busy && <div className="empty">Natija topilmadi</div>)}
      </div>
    </div>
  );
}


function ProductsScreen({ go }) {
  const [categories, setCategories] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryName, setCategoryName] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    unit: "UNIT",
    value: "",
    category: "",
    picture: null,
  });

  async function load() {
    setBusy(true);
    try {
      const data = await api.products();
      const rows = Array.isArray(data) ? data : (data.results || data.items || []);
      setCategories(rows);
      if (!editingProduct && !productOpen && rows.length && !productForm.category) {
        setProductForm((prev) => ({ ...prev, category: String(rows[0].id) }));
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

  function resetProductForm() {
    setEditingProduct(null);
    setProductForm({
      name: "",
      description: "",
      price: "",
      unit: "UNIT",
      value: "",
      category: categories[0]?.id ? String(categories[0].id) : "",
      picture: null,
    });
  }

  function openCategoryModal(cat = null) {
    setEditingCategory(cat);
    setCategoryName(cat ? (cat.name || "") : "");
    setCategoryOpen(true);
  }

  function closeCategoryModal() {
    setCategoryOpen(false);
    setEditingCategory(null);
    setCategoryName("");
  }

  function openProductModal(product = null) {
    setEditingProduct(product);
    if (product) {
      setProductForm({
        name: product.name || "",
        description: product.description || "",
        price: String(product.price ?? ""),
        unit: product.unit || "UNIT",
        value: String(product.value ?? ""),
        category: product.category ? String(product.category) : (categories[0]?.id ? String(categories[0].id) : ""),
        picture: null,
      });
    } else {
      resetProductForm();
    }
    setProductOpen(true);
  }

  function closeProductModal() {
    setProductOpen(false);
    setEditingProduct(null);
    resetProductForm();
  }

  async function submitCategory(e) {
    e.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, { name });
      } else {
        await api.createCategory({ name });
      }
      closeCategoryModal();
      await load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(id) {
    setBusy(true);
    setError("");
    try {
      await api.deleteCategory(id);
      await load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitProduct(e) {
    e.preventDefault();
    const payload = {
      name: productForm.name.trim(),
      description: productForm.description.trim(),
      price: productForm.price,
      unit: productForm.unit,
      value: productForm.value,
      category: productForm.category,
    };
    if (!payload.name || !payload.price || !payload.category) {
      setError("Nomi, narxi va kategoriya majburiy");
      return;
    }
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) formData.append(key, value);
    });
    if (productForm.picture) formData.append("picture", productForm.picture);
    setBusy(true);
    setError("");
    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, formData);
      } else {
        await api.createProduct(formData);
      }
      closeProductModal();
      await load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(id) {
    setBusy(true);
    setError("");
    try {
      await api.deleteProduct(id);
      await load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "0 12px 8px" }}>
        <div style={{ flex: 1 }}><ScreenHeader title="Mahsulotlar" backTo="#/" go={go} /></div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn secondary" onClick={() => openCategoryModal()} style={{ minWidth: 110, padding: "7px 10px", fontSize: 13 }}>Kategoriya</button>
          <button type="button" className="btn" onClick={() => openProductModal()} style={{ minWidth: 110, padding: "7px 10px", fontSize: 13 }}>Mahsulot</button>
        </div>
      </div>

      <ErrorText error={error} />

      {categories.length ? categories.map((category) => (
        <div className="card" key={category.id} style={{ marginBottom: 12, padding: 12 }}>
          <div className="row" style={{ alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{category.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>{(category.products || []).length} ta mahsulot</div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn secondary" onClick={() => openCategoryModal(category)} style={{ minWidth: 78, padding: "7px 10px", fontSize: 12 }}>Tahrirlash</button>
              <button type="button" className="btn danger" onClick={() => deleteCategory(category.id)} style={{ minWidth: 78, padding: "7px 10px", fontSize: 12 }}>O'chirish</button>
            </div>
          </div>

          {(category.products || []).length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginTop: 12 }}>
              {(category.products || []).map((product) => (
                <div key={product.id} style={{ border: "1px solid rgba(148,163,184,0.25)", borderRadius: 12, padding: 10, background: "rgba(255,255,255,0.6)" }}>
                  <div className="row" style={{ alignItems: "center", gap: 8 }}>
                    {product.picture ? (
                      <img src={product.picture} alt={product.name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛍️</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{product.name}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{product.unit_display || product.unit || "dona"}</div>
                    </div>
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 8, minHeight: 28 }}>{product.description || "Tavsif yo'q"}</div>
                  <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
                    <span className="muted" style={{ fontSize: 11 }}>Narx</span>
                    <b style={{ fontSize: 13 }}>{money(product.price)}</b>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted" style={{ fontSize: 11 }}>Miqdor</span>
                    <b style={{ fontSize: 13 }}>{product.value} {unitLabel(product.unit)}</b>
                  </div>
                  <div className="row" style={{ gap: 6, justifyContent: "flex-end", marginTop: 8 }}>
                    <button type="button" className="btn secondary" onClick={() => openProductModal(product)} style={{ minWidth: 72, padding: "6px 8px", fontSize: 11 }}>Tahrirlash</button>
                    <button type="button" className="btn danger" onClick={() => deleteProduct(product.id)} style={{ minWidth: 72, padding: "6px 8px", fontSize: 11 }}>O'chirish</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty" style={{ marginTop: 12 }}>Bu kategoriyada mahsulot yo'q</div>
          )}
        </div>
      )) : (
        !busy && <div className="empty">Mahsulotlar yo'q</div>
      )}

      {categoryOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.38)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 }}>
          <div className="card" style={{ width: "100%", maxWidth: 420, borderRadius: 18, padding: 16 }}>
            <div className="row" style={{ alignItems: "center", marginBottom: 12 }}>
              <b style={{ flex: 1 }}>{editingCategory ? "Kategoriya tahrirlash" : "Yangi kategoriya"}</b>
              <button type="button" className="btn secondary" onClick={closeCategoryModal} style={{ minWidth: 84, padding: "7px 10px", fontSize: 13 }}>Yopish</button>
            </div>
            <form onSubmit={submitCategory} className="stack" style={{ gap: 8 }}>
              <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Kategoriya nomi" style={{ width: "100%" }} />
              <ErrorText error={error} />
              <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                <button type="submit" className="btn" disabled={busy} style={{ minWidth: 100, padding: "7px 10px", fontSize: 13 }}>{busy ? "Saqlanmoqda..." : "Saqlash"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {productOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.38)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 }}>
          <div className="card" style={{ width: "100%", maxWidth: 540, maxHeight: "88vh", overflow: "auto", borderRadius: 18, padding: 16 }}>
            <div className="row" style={{ alignItems: "center", marginBottom: 12 }}>
              <b style={{ flex: 1 }}>{editingProduct ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}</b>
              <button type="button" className="btn secondary" onClick={closeProductModal} style={{ minWidth: 84, padding: "7px 10px", fontSize: 13 }}>Yopish</button>
            </div>
            <form onSubmit={submitProduct} className="stack" style={{ gap: 8 }}>
              <select value={productForm.category} onChange={(e) => setProductForm((p) => ({ ...p, category: e.target.value }))} style={{ width: "100%" }}>
                <option value="">Kategoriya tanlang</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
              <input value={productForm.name} onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))} placeholder="Mahsulot nomi" style={{ width: "100%" }} />
              <textarea value={productForm.description} onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))} placeholder="Tavsif" rows={3} style={{ width: "100%", resize: "vertical" }} />
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <input type="number" min="0" step="0.001" value={productForm.price} onChange={(e) => setProductForm((p) => ({ ...p, price: e.target.value }))} placeholder="Narx" style={{ width: "100%" }} />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <input type="number" min="0" step="0.01" value={productForm.value} onChange={(e) => setProductForm((p) => ({ ...p, value: e.target.value }))} placeholder="Miqdor" style={{ width: "100%" }} />
                </div>
              </div>
              <select value={productForm.unit} onChange={(e) => setProductForm((p) => ({ ...p, unit: e.target.value }))} style={{ width: "100%" }}>
                <option value="UNIT">Dona</option>
                <option value="KG">Kg</option>
                <option value="GR">Gr</option>
              </select>
              <input type="file" accept="image/*" onChange={(e) => setProductForm((p) => ({ ...p, picture: e.target.files?.[0] || null }))} style={{ width: "100%" }} />
              <ErrorText error={error} />
              <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                <button type="submit" className="btn" disabled={busy} style={{ minWidth: 100, padding: "7px 10px", fontSize: 13 }}>{busy ? "Saqlanmoqda..." : "Saqlash"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkerManagementScreen({ go }) {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsStart, setStatsStart] = useState("");
  const [statsEnd, setStatsEnd] = useState("");
  const [statsRows, setStatsRows] = useState([]);
  const [statsBusy, setStatsBusy] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [statsToday, setStatsToday] = useState(true);
  const [statsTotals, setStatsTotals] = useState({ total_orders: 0, total_orders_money: 0, total_transactions_money: 0 });
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
    role_type: "DELIVERER",
    password: "",
  });

  async function load() {
    setBusy(true);
    setError("");
    try {
      const data = await api.users();
      const workers = (Array.isArray(data) ? data : data.results || []).filter(
        (u) => u && u.role_type && u.role_type !== "CUSTOMER"
      );
      setRows(workers);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

  function applyPhone(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.startsWith("998")) return "+" + digits;
    if (digits.length === 9) return "+998" + digits;
    return raw || "";
  }

  function onChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      first_name: "",
      last_name: "",
      phone_number: "",
      role_type: "DELIVERER",
      password: "",
    });
  }

  async function loadWorkerStats() {
    // Use backend worker-stats API to avoid client-side aggregation errors
    let start = statsStart;
    let end = statsEnd;
    if (statsToday) {
      const todayIso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const display = formatDisplayDate(todayIso);
      start = display;
      end = display;
      setStatsStart(display);
      setStatsEnd(display);
    }

    const startValue = parseDisplayDate(start);
    const endValue = parseDisplayDate(end);
    if (!startValue || !endValue) {
      setStatsError("Boshlang'ich va tugash sanasi kerak. Format: dd/mm/yyyy");
      return;
    }

    const startDate = new Date(`${startValue.split('/')[2]}-${startValue.split('/')[1]}-${startValue.split('/')[0]}`);
    const endDate = new Date(`${endValue.split('/')[2]}-${endValue.split('/')[1]}-${endValue.split('/')[0]}`);
    if (startDate > endDate) {
      setStatsError("Boshlang'ich sana tugash sanadan keyin bo'lishi mumkin emas");
      return;
    }

    setStatsBusy(true);
    setStatsError("");
    try {
      const qs = `?start_date=${encodeURIComponent(startValue)}&end_date=${encodeURIComponent(endValue)}`;
      const data = await api.workerStats(qs);
      const rows = Array.isArray(data.results) ? data.results : data.results || [];
      setStatsRows(rows.map((r) => ({
        ...r,
        // ensure numbers
        order_count: Number(r.order_count || 0),
        order_money: Number(r.order_money || 0),
        payment_money: Number(r.payment_money || 0),
      })));

      // totals from backend (if provided)
      setStatsTotals({
        total_orders: Number(data.total_orders || 0),
        total_orders_money: Number(data.total_orders_money || 0),
        total_transactions_money: Number(data.total_transactions_money || 0),
      });

      setStatsError("");
    } catch (e) {
      setStatsError(e.message || String(e));
      setStatsRows([]);
    } finally {
      setStatsBusy(false);
    }
  }

  function openCreate() {
    resetForm();
    setModalOpen(true);
  }

  function openEdit(user) {
    setEditingId(user.id);
    setForm({
      first_name: "",
      last_name: "",
      phone_number: "",
      role_type: user.role_type || "DELIVERER",
      password: "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.phone_number.trim()) {
      setError("Telefon raqami kerak");
      return;
    }
    if (!editingId && !form.password.trim()) {
      setError("Yangi xodim uchun parol kerak");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone_number: applyPhone(form.phone_number),
        role_type: form.role_type,
        ...(form.password ? { password: form.password } : {}),
      };
      if (editingId) {
        await api.updateUser(editingId, payload);
      } else {
        await api.createUser(payload);
      }
      closeModal();
      await load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("Bu xodimni o'chirishni xohlaysizmi?")) return;
    setBusy(true);
    setError("");
    try {
      await api.deleteUser(id);
      closeModal();
      await load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const visible = rows.filter((u) => filter === "all" ? u.role_type !== "CUSTOMER" : u.role_type === filter);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 12px 8px", gap: 8 }}>
        <div style={{ flex: 1 }}><ScreenHeader title="Xodimlar" backTo="#/" go={go} /></div>
        <button type="button" className="btn secondary" onClick={() => { const todayIso = new Date().toISOString().slice(0,10); const todayDisplay = formatDisplayDate(todayIso); setStatsStart(todayDisplay); setStatsEnd(todayDisplay); setStatsToday(true); setStatsOpen(true); setTimeout(loadWorkerStats, 0); }} style={{ minWidth: 92, padding: "7px 10px", fontSize: 13 }}>Statistika</button>
        <button type="button" className="btn" onClick={openCreate} aria-label="Yangi xodim qo'shish" style={{ minWidth: 46, fontSize: 22, lineHeight: 1, padding: "6px 10px" }}>＋</button>
      </div>

      <div className="card" style={{ marginBottom: 10 }}>
        <div className="chips">
          {[
            ["all", "Hammasi"],
            ["DELIVERER", "Yetkazuvchilar"],
            ["AGENT", "Agentlar"],
            ["ADMIN", "Adminlar"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`chip-btn ${filter === key ? "on" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ErrorText error={error} />

      {visible.map((user) => (
        <div className="card" key={user.id} style={{ marginBottom: 10 }}>
          <div className="row" style={{ alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div className="row">
                <b>{user.first_name || "Noma'lum"} {user.last_name || ""}</b>
                <span className="badge" style={{ background: user.role_type === "ADMIN" ? "#7c3aed" : user.role_type === "AGENT" ? "#0ea5e9" : "#22c55e" }}>
                  {user.role_type === "ADMIN" ? "Admin" : user.role_type === "AGENT" ? "Agent" : "Yetkazuvchi"}
                </span>
              </div>
              <div className="muted">{user.phone_number || "Telefon yo'q"}</div>
            </div>
            <button type="button" className="btn secondary" onClick={() => openEdit(user)}>{busy ? "..." : "Tahrirlash"}</button>
          </div>
        </div>
      ))}
      {!visible.length && !busy && <div className="empty">Bu toifadagi xodim yo'q</div>}

      {statsOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 }}>
          <div className="card" style={{ width: "100%", maxWidth: 560, maxHeight: "88vh", overflow: "auto", borderRadius: 18, padding: 14 }}>
            <div className="row" style={{ alignItems: "center", marginBottom: 10 }}>
              <b style={{ flex: 1, fontSize: 16 }}>Xodimlar statistikasi</b>
              <button type="button" className="btn secondary" onClick={() => setStatsOpen(false)} style={{ minWidth: 84, padding: "7px 10px", fontSize: 13 }}>Yopish</button>
            </div>
                    <div className="stack" style={{ gap: 8 }}>
                  <div className="row" style={{ gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button type="button" className={`chip-btn ${statsToday ? 'on' : ''}`} onClick={() => setStatsToday(true)}>Bugun</button>
                      <button type="button" className={`chip-btn ${!statsToday ? 'on' : ''}`} onClick={() => setStatsToday(false)}>Oraliq</button>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                      <button type="button" className="btn" onClick={loadWorkerStats} disabled={statsBusy} style={{ minWidth: 110, padding: "7px 10px", fontSize: 13 }}>
                        {statsBusy ? "Yuklanmoqda..." : "Hisoblash"}
                      </button>
                    </div>
                  </div>

                  {!statsToday && (
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <DateField label="Boshlanish" value={statsStart} onChange={setStatsStart} />
                      <DateField label="Tugash" value={statsEnd} onChange={setStatsEnd} />
                    </div>
                  )}

                  <ErrorText error={statsError} />
                </div>
            <div style={{ marginTop: 12 }}>
              {/* Totals summary */}
              <div className="card" style={{ marginBottom: 12, padding: 10, borderRadius: 12 }}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div className="muted" style={{ fontSize: 12 }}>Jami buyurtmalar (tanlangan davr)</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{statsTotals.total_orders}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="muted" style={{ fontSize: 12 }}>Buyurtmalar summasi</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{money(statsTotals.total_orders_money)}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="muted" style={{ fontSize: 12 }}>Tranzaksiyalar summasi</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{money(statsTotals.total_transactions_money)}</div>
                  </div>
                </div>
              </div>

              {statsRows.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {statsRows.map((item) => (
                    <div key={item.id} className="card" style={{ padding: 12, borderRadius: 14 }}>
                      <div className="row" style={{ alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{item.name}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {item.role_type === "ADMIN" ? "Admin" : item.role_type === "AGENT" ? "Agent" : "Yetkazuvchi"}
                          </div>
                        </div>
                        <span className="badge" style={{ background: item.role_type === "ADMIN" ? "#7c3aed" : item.role_type === "AGENT" ? "#0ea5e9" : "#22c55e", fontSize: 10 }}>
                          {item.order_count} ta
                        </span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                        <div style={{ background: "rgba(59,130,246,0.08)", borderRadius: 10, padding: 8, textAlign: "center" }}>
                          <div className="muted" style={{ fontSize: 11 }}>Buyurtmalar</div>
                          <div style={{ fontSize: 18, fontWeight: 700 }}>{item.order_count}</div>
                        </div>
                        <div style={{ background: "rgba(34,197,94,0.08)", borderRadius: 10, padding: 8, textAlign: "center" }}>
                          <div className="muted" style={{ fontSize: 11 }}>Jami summa</div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{money(item.order_money)}</div>
                        </div>
                        <div style={{ background: "rgba(168,85,247,0.08)", borderRadius: 10, padding: 8, textAlign: "center" }}>
                          <div className="muted" style={{ fontSize: 11 }}>Tranzaksiya</div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{money(item.payment_money)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (!statsBusy && !statsError && <div className="empty">Bu davr uchun statistikalar yo'q</div>)}
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 }}>
          <div className="card" style={{ width: "100%", maxWidth: 400, maxHeight: "88vh", overflow: "auto", borderRadius: 18, padding: 14 }}>
            <div className="row" style={{ alignItems: "center", marginBottom: 10 }}>
              <b style={{ flex: 1, fontSize: 16 }}>{editingId ? "Xodimni tahrirlash" : "Yangi xodim qo'shish"}</b>
              <button type="button" className="btn secondary" onClick={closeModal} style={{ minWidth: 84, padding: "7px 10px", fontSize: 13 }}>Yopish</button>
            </div>
            <form className="stack" onSubmit={submit}>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <input value={form.first_name} onChange={(e) => onChange("first_name", e.target.value)} placeholder="Ism" style={{ width: "100%" }} />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <input value={form.last_name} onChange={(e) => onChange("last_name", e.target.value)} placeholder="Familiya" style={{ width: "100%" }} />
                </div>
              </div>
              <input value={form.phone_number} onChange={(e) => onChange("phone_number", e.target.value)} placeholder="+998901234567" inputMode="tel" style={{ width: "100%" }} />
              <select value={form.role_type} onChange={(e) => onChange("role_type", e.target.value)} style={{ width: "100%" }}>
                <option value="DELIVERER">Yetkazuvchi</option>
                <option value="AGENT">Agent</option>
                <option value="ADMIN">Admin</option>
              </select>
              <input type="text" value={form.password} onChange={(e) => onChange("password", e.target.value)} placeholder={editingId ? "Yangi parol (ixtiyoriy)" : "Parol"} style={{ width: "100%" }} />
              <ErrorText error={error} />
              <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                <button type="submit" className="btn" disabled={busy} style={{ minWidth: 96, padding: "7px 10px", fontSize: 13 }}>{busy ? "Saqlanmoqda..." : (editingId ? "Saqlash" : "Qo'shish")}</button>
                {editingId && <button type="button" className="btn danger" onClick={() => remove(editingId)} disabled={busy} style={{ minWidth: 96, padding: "7px 10px", fontSize: 13 }}>O'chirish</button>}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function DelivererApp({ user, path, parts, go, logout, admin = false }) {
  let screen = <TodayScreen go={go} />;
  if (path === "/near") screen = <NearWaysScreen go={go} />;
  else if (path === "/markets/statistics") screen = <MarketStatisticsScreen go={go} compact={!admin} />;
  else   if (path === "/markets") screen = <MarketsScreen go={go} user={user} />;
  else if (path === "/markets/new") screen = <NewMarket go={go} backTo="#/markets" />;
  else if (parts[0] === "markets" && parts[2] === "edit") {
    screen = <OrderFlow marketId={parts[1]} editOrderId={parts[3]} user={user} go={go} backTo={`#/markets/${parts[1]}`} />;
  } else if (parts[0] === "markets" && parts[2] === "order") {
    screen = <OrderFlow marketId={parts[1]} user={user} go={go} backTo={`#/markets/${parts[1]}`} />;
  } else if (parts[0] === "markets" && parts[2] === "orders") {
    screen = <MarketOrdersScreen marketId={parts[1]} go={go} />;
  } else if (parts[0] === "markets" && parts[2] === "payments") {
    screen = <MarketPaymentsScreen marketId={parts[1]} go={go} />;
  } else if (parts[0] === "markets" && parts[2] === "debts") {
    screen = <MarketDebtOrdersScreen marketId={parts[1]} go={go} />;
  } else if (parts[0] === "markets" && parts[1]) {
    screen = <MarketHub marketId={parts[1]} go={go} />;
  } else if (path === "/map") screen = <MapScreen go={go} />;
  else if (path === "/pending") screen = <PendingScreen go={go} />;
  else if (path === "/history") screen = <HistoryScreen go={go} admin={admin} />;
  else if (path === "/transactions") screen = <TransactionsScreen go={go} admin={admin} />;
  else if (path === "/products" && admin) screen = <ProductsScreen go={go} />;
  else if (path === "/users" && admin) screen = <WorkerManagementScreen go={go} />;
  else if (parts[0] === "orders" && parts[1]) {
    screen = <OrderView id={parts[1]} user={user} go={go} backTo={lastBack("#/")} />;
  } else if (path === "/profile") {
    screen = (
      <div>
        <ScreenHeader title="Profil" backTo="#/" go={go} />
        <ProfileScreen user={user} onLogout={logout} />
      </div>
    );
  }

  const nested = path === "/near"
    || path === "/markets/new"
    || path === "/markets/statistics"
    || path === "/profile"
    || path === "/transactions"
    || path === "/products"
    || path === "/users"
    || (parts[0] === "markets" && parts[1])
    || (parts[0] === "orders" && parts[1]);

  const titles = {
    "/": "Bugun",
    "/markets": "Do'konlar",
    "/markets/statistics": "Statistika",
    "/map": "Xarita",
    "/pending": "Tasdiqlash",
    "/history": "Tarix",
    "/transactions": "Tranzaksiyalar",
    "/products": "Mahsulotlar",
    "/users": "Xodimlar",
  };
  const tabs = admin ? ADMIN_TABS : TABS;

  return (
    <div className="app">
      {!nested && (
        <TopBar title={titles[path] || "Safos"} subtitle={user.first_name || "Yetkazuvchi"} go={go} />
      )}
      {screen}
      <nav className="tabs">
        {tabs.map(([href, label, icon]) => {
          const active = href === "/"
            ? path === "/" || path === "/near"
            : href === "/markets"
              ? path === "/markets" || (path.startsWith("/markets") && path !== "/markets/statistics")
              : href === "/pending"
                ? path === "/pending" || (path.startsWith("/orders") && lastBack("#/") === "#/pending")
                : href === "/history"
                  ? path === "/history" || (path.startsWith("/orders") && lastBack("#/") === "#/history")
                  : href === "/transactions"
                    ? path === "/transactions"
                    : href === "/products"
                      ? path === "/products"
                      : href === "/users"
                        ? path === "/users"
                        : path === href;
          return (
            <a key={href} className={`tab ${active ? "active" : ""}`} href={`#${href}`}>
              <i>{icon}</i>{label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}

export function AdminApp(props) {
  return <DelivererApp {...props} admin={true} />;
}
