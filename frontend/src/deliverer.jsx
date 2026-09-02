import { useEffect, useRef, useState } from "react";
import { api, lastBack, money, rememberBack, unitLabel } from "./api";
import { toast } from "./toast";
import {
  ErrorText,
  MapScreen,
  MarketsScreen,
  NewMarket,
  loadLeaflet,
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
  formatDate,
  formatDateTime,
  formatUzPhone,
  parseAnyDate,
  toISODate,
  DatePicker,
  PhoneInput,
  statusMeta,
  takenByLabel,
  deliveredByLabel,
  userIcon,
  ApproveToggle,
  CardListSkeleton,
  DetailSkeleton,
  MarketListSkeleton,
  OrderListSkeleton,
  Skel,
  TodaySkeleton,
} from "./shared";

const TABS = [
  ["/", "Bugun", "📦"],
  ["/markets", "Do'konlar", "🏪"],
  ["/map", "Xarita", "🗺️"],
  ["/pending", "Tasdiq", "⏳"],
  ["/history", "Tarix", "📋"],
  ["/transactions", "Tranzaksiyalar", "💰"],
];

const ADMIN_PRIMARY_TABS = [
  ["/", "Bugun", "📦"],
  ["/markets", "Do'konlar", "🏪"],
  ["/pending", "Tasdiq", "⏳"],
  ["/history", "Tarix", "📋"],
];

const ADMIN_MORE_ITEMS = [
  ["/map", "Xarita", "🗺️"],
  ["/transactions", "Tranzaksiyalar", "💰"],
  ["/products", "Mahsulotlar", "🛒"],
  ["/users", "Xodimlar", "👥"],
];

function toOrderBackendDate(value) {
  return toISODate(value);
}

function toPaymentBackendDate(value) {
  return formatDate(value);
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.todayCount().then((c) => { if (alive) setCounts(c); }),
      api.orders("?status=APPROVED&page_size=200").then((o) => {
        if (alive) {
          setOrders(o.results || o);
          setError("");
        }
      }),
    ])
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const products = counts?.counts_of_each_product || [];

  if (loading && !counts && !orders.length) {
    return (
      <div>
        <ErrorText error={error} />
        <TodaySkeleton />
      </div>
    );
  }

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
            className="card feed-card"
            key={o.id}
            onClick={() => { rememberBack("#/" ); go(`#/orders/${o.id}`); }}
            style={{ cursor: "pointer" }}
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
      {!orders.length && <div className="empty">Bugun tasdiqlangan buyurtma yo'q</div>}
    </div>
  );
}

function NearWaysScreen({ go }) {
  const [rows, setRows] = useState([]);
  const [ordered, setOrdered] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
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
        ? `<img src="${esc(m.image)}" alt="${esc(m.name)}" decoding="async" loading="lazy" />`
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
      const [data, markets] = await Promise.all([
        api.todayMarkets({ fresh: true }),
        api.markets("", { fresh: true }),
      ]);
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
    } finally {
      setLoading(false);
    }
  }

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

    rememberBack("#/near");
    loadAndPlan();
    const timer = setInterval(loadAndPlan, 15000);

    loadLeaflet().then(() => {
      if (cancelled) return;
      const el = document.getElementById("near-map");
      if (!el || !window.L) return;
      const map = window.L.map(el, { zoomControl: false }).setView([41.31, 69.24], 12);
      window.L.control.zoom({ position: "bottomleft" }).addTo(map);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      mapRef.current = map;
      layerRef.current = window.L.layerGroup().addTo(map);

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

      window.addEventListener("deviceorientationabsolute", onOrient);
      window.addEventListener("deviceorientation", onOrient);
      if (rowsRef.current.length) planRef.current(rowsRef.current);
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("deviceorientationabsolute", onOrient);
      window.removeEventListener("deviceorientation", onOrient);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (mapRef.current) mapRef.current.remove();
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
        {loading && <div className="skel-block skel-map-cover" />}
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
        {loading && !ordered.length ? (
          [0, 1, 2, 3].map((i) => (
            <div className="list-item" key={i}>
              <div className="row">
                <Skel w={`${52 + i * 6}%`} h={14} />
                <Skel w={40} h={10} />
              </div>
              <Skel w="42%" h={10} style={{ marginTop: 8 }} />
            </div>
          ))
        ) : (
          !ordered.length && <div className="muted">Xaritada ko'rsatiladigan do'kon yo'q</div>
        )}
      </div>
    </div>
  );
}

function MarketHub({ marketId, go, user }) {
  const [market, setMarket] = useState(null);
  const [stats, setStats] = useState(null);
  const [debts, setDebts] = useState([]);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusDraft, setStatusDraft] = useState("AVAILABLE");

  const loadId = useRef(0);

  async function load() {
    const id = ++loadId.current;
    try {
      const [m, s, d] = await Promise.all([
        api.market(marketId),
        api.analyticsDetail(marketId).catch(() => null),
        api.marketDebts(marketId).catch(() => []),
      ]);
      if (id !== loadId.current) return;
      setMarket(m);
      setStatusDraft((m?.status_code || m?.status || "AVAILABLE").toUpperCase());
      setStats(s);
      const rows = Array.isArray(d) ? d : d.results || [];
      setDebts(rows);
      setError("");
    } catch (e) {
      if (id !== loadId.current) return;
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    return () => { loadId.current += 1; };
  }, [marketId]);

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
      toast.ok(`To'lov qabul qilindi: ${money(value)}`);
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
      toast.ok("Do'kon holati yangilandi");
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

  async function removeMarket() {
    if (!window.confirm("Bu do'kon va uning buyurtmalari o'chiriladi. Davom etasizmi?")) return;
    setBusy(true);
    setError("");
    try {
      await api.deleteMarket(marketId);
      toast.ok("Do'kon o'chirildi");
      go("#/markets");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!market) {
    return (
      <div>
        <ScreenHeader title="Do'kon" backTo={lastBack("#/markets")} go={go} />
        {error ? <div className="card">{error}</div> : <DetailSkeleton />}
      </div>
    );
  }
  const meta = statusMeta(market.status_code, market.status);
  const credit = stats?.credit_amount ?? market.credit_amount ?? 0;
  const debtTotal = stats?.total_debt != null
    ? stats.total_debt
    : debts.reduce((sum, o) => sum + Number(o.remaining_debt || 0), 0);
  const currentStatus = (market.status_code || market.status || "AVAILABLE").toUpperCase();
  const isAdmin = user?.role_type === "ADMIN";
  const marketStatusOptions = [
    { value: "AVAILABLE", label: "Mahsulotlar mavjud" },
    { value: "POSSIBLE", label: "Mahsulot kerak bo'lishi mumkin" },
    { value: "NOT_NEEDED", label: "Mahsulot kerak bo'lmasligi mumkin" },
  ];

  return (
    <div>
      <ScreenHeader title={market.name} backTo={lastBack("#/markets")} go={go} />
      {market.image && <img className="market-hero" src={market.image} alt={market.name} decoding="async" />}
      {isAdmin && (
        <div className="grid2" style={{ marginBottom: 12 }}>
          <button type="button" className="btn secondary" onClick={() => go(`#/markets/${marketId}/info`)}>Tahrirlash</button>
          <button type="button" className="btn danger" disabled={busy} onClick={removeMarket}>O'chirish</button>
        </div>
      )}
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
  const [busy, setBusy] = useState(true);
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
    let alive = true;
    Promise.all([
      api.market(marketId).catch(() => null),
      load(1),
    ]).then(([m]) => {
      if (alive && m) setMarket(m);
    }).catch(() => {});
    return () => { alive = false; };
  }, [marketId]);

  return (
    <div>
      <ScreenHeader title={market?.name || "To'lovlar"} backTo={`#/markets/${marketId}`} go={go} />
      <ErrorText error={error} />
      {busy && !rows.length && <CardListSkeleton count={4} />}
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.market(marketId).catch(() => null),
      api.marketDebts(marketId),
    ])
      .then(([m, d]) => {
        if (!alive) return;
        if (m) setMarket(m);
        const rows = Array.isArray(d) ? d : d.results || [];
        setItems(rows);
      })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [marketId]);

  return (
    <div>
      <ScreenHeader title={market?.name || "Qarzdagi buyurtmalar"} backTo={`#/markets/${marketId}`} go={go} />
      <ErrorText error={error} />
      {loading && !items.length && <CardListSkeleton count={4} />}
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
              <b>{formatDateTime(o.created_at)}</b>
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
      {!loading && !items.length && !error && <div className="empty">Qarzdor buyurtma yo'q</div>}
    </div>
  );
}

function MarketOrdersScreen({ marketId, go }) {
  const [items, setItems] = useState([]);
  const [market, setMarket] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.market(marketId).catch(() => null),
      api.orders(`?market_id=${marketId}&page_size=200`),
    ])
      .then(([m, d]) => {
        if (!alive) return;
        if (m) setMarket(m);
        const rows = d.results || d;
        setItems(rows.filter((o) => String(o.market_id) === String(marketId)));
      })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
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
        loading={loading}
      />
    </div>
  );
}

function PendingScreen({ go }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const data = await api.orders("?status=PENDING&status=APPROVED&page_size=200");
      const rows = data.results || data || [];
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
    } finally {
      setLoading(false);
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
      toast.ok(next === "APPROVED" ? "Buyurtma tasdiqlandi" : "Tasdiq bekor qilindi");
      setItems((prev) => prev.map((row) => (
        row.id === o.id
          ? { ...row, status_code: next, status: orderStatusMeta(next, next).label }
          : row
      )));
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
                <div className="muted">{formatDateTime(o.created_at)} · {money(o.total_price_with_discount)}</div>
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
      {loading && !items.length && <OrderListSkeleton count={5} cards />}
      {!loading && !visible.length && <div className="empty">Bu bo‘limda buyurtma yo'q</div>}
    </div>
  );
}

function HistoryScreen({ go }) {
  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
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
        <DatePicker value={dateQuery} onChange={setDateQuery} />
        <button type="submit" className="btn secondary" disabled={busy}>{busy ? "Qidirilmoqda..." : "Qidirish"}</button>
      </form>
      <ErrorText error={error} />
      <OrderListCard items={items} go={go} from="#/history" empty="Buyurtmalar tarixi bo'sh" loading={busy} />
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
  const [busy, setBusy] = useState(true);
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
          <b>{busy && !rows.length ? <Skel w={88} h={16} /> : money(todayTotal)}</b>
        </div>
        <div className="muted">Bugun qabul qilingan: {busy && !rows.length ? <Skel w={120} h={12} style={{ display: "inline-block" }} /> : money(todayTotal)}</div>
      </div>
      <form className="card stack" style={{ marginBottom: 10 }} onSubmit={runSearch}>
        <input
          placeholder="Do'kon nomi bo'yicha qidirish"
          value={marketQuery}
          onChange={(e) => setMarketQuery(e.target.value)}
        />
        <DatePicker value={dateQuery} onChange={setDateQuery} />
        <button type="submit" className="btn secondary" disabled={busy}>{busy ? "Qidirilmoqda..." : "Qidirish"}</button>
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
                <div className="muted">
                  {tx.taken_by ? `${personName(tx.taken_by)} · ` : ""}
                  {formatDateTime(tx.payment_date)}
                </div>
              </div>
            ))}
          </div>
        );
      }) : (busy ? <CardListSkeleton count={4} /> : <div className="empty">Hech qanday tranzaksiya topilmadi</div>)}
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
  const [busy, setBusy] = useState(true);
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

      const activityPromise = api.analyticsActivity(`?${params.toString()}`);
      const summaryPromise = compact ? Promise.resolve(null) : api.analyticsSummary();
      const [raw, summary] = await Promise.all([activityPromise, summaryPromise]);

      const list = Array.isArray(raw.results) ? raw.results : (Array.isArray(raw) ? raw : []);
      if (compact) {
        const debtRows = list
          .filter((market) => Number(market.total_debt || 0) > 0)
          .map((market) => ({
            id: market.id,
            name: market.name,
            debt_total: Number(market.total_debt || 0),
            debt_date: market.last_order_at || market.first_order_at || market.oldest_unpaid_order_at || null,
          }))
          .sort((a, b) => {
            const left = a.debt_date ? new Date(a.debt_date).getTime() : Number.MAX_SAFE_INTEGER;
            const right = b.debt_date ? new Date(b.debt_date).getTime() : Number.MAX_SAFE_INTEGER;
            return left - right;
          });
        setRows(debtRows);
        setTotals({
          market_count: debtRows.length,
          markets_with_debt: debtRows.length,
          total_debt: debtRows.reduce((sum, row) => sum + Number(row.debt_total || 0), 0),
        });
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
        avg_days_between_orders: r.avg_days_between_orders != null ? Math.round(Number(r.avg_days_between_orders)) : null,
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
      toast.ok(`${selected.size} ta do'kon holati yangilandi`);
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
                  {m.debt_date ? formatDate(m.debt_date) : '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontWeight: 700 }}>{money(m.debt_total)}</div>
            </div>
          </div>
        )) : (busy ? <CardListSkeleton count={5} /> : <div className="empty">Qarzli do'konlar yo'q</div>)}
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
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{busy && !rows.length ? <Skel w={48} h={22} /> : totals.market_count}</div>
          </div>
          <div style={{ background: '#fff7ed', borderRadius: 14, padding: '10px 12px' }}>
            <div className="muted" style={{ fontSize: 11 }}>Qarzli</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{busy && !rows.length ? <Skel w={48} h={22} /> : totals.markets_with_debt}</div>
          </div>
          <div style={{ background: '#ecfdf5', borderRadius: 14, padding: '10px 12px' }}>
            <div className="muted" style={{ fontSize: 11 }}>Jami qarz</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{busy && !rows.length ? <Skel w={72} h={20} /> : money(totals.total_debt)}</div>
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
          <button className="btn secondary small" onClick={() => load()} disabled={busy} style={{ flex: 1 }}>{busy ? 'Yuklanmoqda...' : 'Filtrlash'}</button>
          <button className="btn ghost small" onClick={() => { setSearch(''); setInactiveDays(''); setHasDebt(false); setOrdering('-days_since_last_order'); sessionStorage.removeItem('market-statistics-filters'); load(); }}>Tozalash</button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingTop: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#334155' }}>
            <input type="checkbox" checked={selectAll} onChange={toggleAll} />
            Hammasini tanlash
          </label>
          <select value={statusChoice} onChange={(e) => setStatusChoice(e.target.value)} style={{ flex: '1 1 140px', minWidth: 0 }}>
            <option value="AVAILABLE">Mahsulotlar mavjud</option>
            <option value="POSSIBLE">Mahsulot kerak bo'lishi mumkin</option>
            <option value="NOT_NEEDED">Mahsulot kerak bo'lmasligi mumkin</option>
          </select>
          <button className="btn small" onClick={bulkUpdateStatus} disabled={busy || selected.size===0} style={{ flex: 1 }}>Tanlanganlarni yangilash</button>
          <button className="btn ghost small" onClick={() => setSelected(new Set())} disabled={busy || selected.size===0}>Tanlovni tozalash</button>
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
                    <div className="muted" style={{ fontSize: 12 }}>O'rta: {m.avg_days_between_orders != null ? `${Math.round(m.avg_days_between_orders)} kun` : '—'}</div>
                  </div>
                </div>
              </div>
              <div style={{ width: 110, textAlign: 'right', whiteSpace: 'nowrap', fontSize: 13 }}>
                <div className="muted">Qarz:</div>
                <div style={{ fontWeight: 700 }}>{money(m.total_debt)}</div>
              </div>
            </div>
          );
        }) : (busy ? <MarketListSkeleton count={6} /> : <div className="empty">Natija topilmadi</div>)}
      </div>
    </div>
  );
}


function ProductsScreen({ go }) {
  const [categories, setCategories] = useState([]);
  const [busy, setBusy] = useState(true);
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
      toast.ok(editingCategory ? "Kategoriya yangilandi" : "Kategoriya qo'shildi");
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
      toast.ok("Kategoriya o'chirildi");
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
      toast.ok(editingProduct ? "Mahsulot yangilandi" : "Mahsulot qo'shildi");
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
      toast.ok("Mahsulot o'chirildi");
      await load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-actions">
        <ScreenHeader title="Mahsulotlar" backTo="#/" go={go} />
        <button type="button" className="btn secondary small" onClick={() => openCategoryModal()}>Kategoriya</button>
        <button type="button" className="btn small" onClick={() => openProductModal()}>Mahsulot</button>
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
              <button type="button" className="btn secondary small" onClick={() => openCategoryModal(category)}>Tahrirlash</button>
              <button type="button" className="btn danger small" onClick={() => deleteCategory(category.id)}>O'chirish</button>
            </div>
          </div>

          {(category.products || []).length ? (
            <div className="product-grid">
              {(category.products || []).map((product) => (
                <div key={product.id} style={{ border: "1px solid rgba(148,163,184,0.25)", borderRadius: 12, padding: 10, background: "rgba(255,255,255,0.6)" }}>
                  <div className="row" style={{ alignItems: "center", gap: 8 }}>
                    {product.picture ? (
                      <img src={product.picture} alt={product.name} decoding="async" loading="lazy" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }} />
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
                    <button type="button" className="btn secondary small" onClick={() => openProductModal(product)}>Tahrirlash</button>
                    <button type="button" className="btn danger small" onClick={() => deleteProduct(product.id)}>O'chirish</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty" style={{ marginTop: 12 }}>Bu kategoriyada mahsulot yo'q</div>
          )}
        </div>
      )) : (
        busy ? <CardListSkeleton count={3} /> : <div className="empty">Mahsulotlar yo'q</div>
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
  const [busy, setBusy] = useState(true);
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
    phone_number: "+998",
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

  function onChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      first_name: "",
      last_name: "",
      phone_number: "+998",
      role_type: "DELIVERER",
      password: "",
    });
  }

  async function loadWorkerStats() {
    let start = statsStart;
    let end = statsEnd;
    if (statsToday) {
      const display = formatDate(new Date());
      start = display;
      end = display;
      setStatsStart(display);
      setStatsEnd(display);
    }

    const startValue = formatDate(start);
    const endValue = formatDate(end);
    if (!startValue || !endValue) {
      setStatsError("Boshlang'ich va tugash sanasi kerak. Format: dd/mm/yyyy");
      return;
    }

    const startDate = parseAnyDate(startValue);
    const endDate = parseAnyDate(endValue);
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
    setError("");
    setEditingId(user.id);
    setForm({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      phone_number: formatUzPhone(user.phone_number),
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
    if (formatUzPhone(form.phone_number).length !== 13) {
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
        phone_number: formatUzPhone(form.phone_number),
        role_type: form.role_type,
        ...(form.password ? { password: form.password } : {}),
      };
      if (editingId) {
        await api.updateUser(editingId, payload);
      } else {
        await api.createUser(payload);
      }
      closeModal();
      toast.ok(editingId ? "Xodim yangilandi" : "Yangi xodim qo'shildi");
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
      toast.ok("Xodim o'chirildi");
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
      <div className="page-actions">
        <ScreenHeader title="Xodimlar" backTo="#/" go={go} />
        <button type="button" className="btn secondary small" onClick={() => { const todayDisplay = formatDate(new Date()); setStatsStart(todayDisplay); setStatsEnd(todayDisplay); setStatsToday(true); setStatsOpen(true); setTimeout(loadWorkerStats, 0); }}>Statistika</button>
        <button type="button" className="btn small" onClick={openCreate} aria-label="Yangi xodim qo'shish">＋</button>
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
            <button type="button" className="btn secondary small" onClick={() => openEdit(user)}>{busy ? "..." : "Tahrirlash"}</button>
          </div>
        </div>
      ))}
      {busy && !visible.length && <CardListSkeleton count={5} />}
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
                      <DatePicker label="Boshlanish" value={statsStart} onChange={setStatsStart} />
                      <DatePicker label="Tugash" value={statsEnd} onChange={setStatsEnd} />
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
              ) : (statsBusy ? <CardListSkeleton count={3} /> : (!statsError && <div className="empty">Bu davr uchun statistikalar yo'q</div>))}
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
              <PhoneInput value={form.phone_number} onChange={(v) => onChange("phone_number", v)} />
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

function tabIsActive(href, path) {
  if (href === "/") return path === "/" || path === "/near";
  if (href === "/markets") return path === "/markets" || (path.startsWith("/markets") && path !== "/markets/statistics");
  if (href === "/pending") return path === "/pending" || (path.startsWith("/orders") && lastBack("#/") === "#/pending");
  if (href === "/history") return path === "/history" || (path.startsWith("/orders") && lastBack("#/") === "#/history");
  if (href === "/transactions") return path === "/transactions";
  if (href === "/products") return path === "/products";
  if (href === "/users") return path === "/users";
  return path === href;
}

function MoreSheet({ open, items, path, go, onClose }) {
  if (!open) return null;
  return (
    <>
      <button type="button" className="more-backdrop" aria-label="Yopish" onClick={onClose} />
      <div className="more-sheet" role="menu">
        {items.map(([href, label, icon]) => (
          <button
            key={href}
            type="button"
            role="menuitem"
            className={`more-item ${tabIsActive(href, path) ? "active" : ""}`}
            onClick={() => { go(`#${href}`); onClose(); }}
          >
            <i>{icon}</i>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export function DelivererApp({ user, path, parts, go, logout, onUserUpdate, admin = false }) {
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { setMoreOpen(false); }, [path]);

  let screen = <TodayScreen go={go} />;
  if (path === "/near") screen = <NearWaysScreen go={go} />;
  else if (path === "/markets/statistics") screen = <MarketStatisticsScreen go={go} compact={!admin} />;
  else   if (path === "/markets") screen = <MarketsScreen go={go} user={user} />;
  else if (path === "/markets/new") screen = <NewMarket go={go} backTo="#/markets" />;
  else if (admin && parts[0] === "markets" && parts[2] === "info") {
    screen = <NewMarket go={go} backTo={`#/markets/${parts[1]}`} marketId={parts[1]} />;
  } else if (parts[0] === "markets" && parts[2] === "edit") {
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
    screen = <MarketHub marketId={parts[1]} go={go} user={user} />;
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
        <ProfileScreen user={user} onLogout={logout} onUserUpdate={onUserUpdate} />
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
  const tabs = admin ? ADMIN_PRIMARY_TABS : TABS;
  const moreActive = admin && ADMIN_MORE_ITEMS.some(([href]) => tabIsActive(href, path));

  return (
    <div className={`app ${admin ? "admin-app" : ""}`}>
      {!nested && (
        <TopBar title={titles[path] || "Safos"} subtitle={user.first_name || "Yetkazuvchi"} go={go} />
      )}
      {screen}
      {admin && (
        <MoreSheet
          open={moreOpen}
          items={ADMIN_MORE_ITEMS}
          path={path}
          go={go}
          onClose={() => setMoreOpen(false)}
        />
      )}
      <nav className="tabs">
        {tabs.map(([href, label, icon]) => (
          <a key={href} className={`tab ${tabIsActive(href, path) ? "active" : ""}`} href={`#${href}`}>
            <i>{icon}</i>{label}
          </a>
        ))}
        {admin && (
          <button
            type="button"
            className={`tab more-tab ${moreActive || moreOpen ? "active" : ""}`}
            aria-label="Yana"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <i className="hamburger" aria-hidden="true"><span /><span /><span /></i>
            Yana
          </button>
        )}
      </nav>
    </div>
  );
}

export function AdminApp(props) {
  return <DelivererApp {...props} admin={true} />;
}
