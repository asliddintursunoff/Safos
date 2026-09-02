import { useEffect, useState } from "react";
import { api, clearSession, getRefresh, getStoredUser, saveSession } from "./api";
import { AdminApp, DelivererApp } from "./deliverer";
import {
  Login,
  MapScreen,
  MarketsScreen,
  MoneyScreen,
  MyOrdersScreen,
  NewMarket,
  OrderFlow,
  OrderView,
  ProfileScreen,
  useRoute,
} from "./shared";

const AGENT_TABS = [
  ["/", "Do'konlar", "🏪"],
  ["/map", "Xarita", "🗺️"],
  ["/orders", "Buyurtma", "🧾"],
  ["/money", "Pulim", "💰"],
  ["/profile", "Profil", "👤"],
];

function AgentApp({ user, path, parts, go, logout, onUserUpdate }) {
  let screen = <MarketsScreen go={go} user={user} />;
  if (path === "/map") screen = <MapScreen go={go} />;
  else if (path === "/markets/new") screen = <NewMarket go={go} />;
  else if (parts[0] === "markets" && parts[2] === "edit") screen = <OrderFlow marketId={parts[1]} editOrderId={parts[3]} user={user} go={go} />;
  else if (parts[0] === "markets" && parts[1]) screen = <OrderFlow marketId={parts[1]} user={user} go={go} />;
  else if (parts[0] === "orders" && parts[1]) screen = <OrderView id={parts[1]} user={user} go={go} />;
  else if (path === "/orders") screen = <MyOrdersScreen go={go} />;
  else if (path === "/money") screen = <MoneyScreen />;
  else if (path === "/profile") screen = <ProfileScreen user={user} onLogout={logout} onUserUpdate={onUserUpdate} />;

  const nested = path === "/markets/new" || (parts[0] === "markets" && parts[1]) || (parts[0] === "orders" && parts[1]);
  const titles = { "/": "Do'konlar", "/map": "Xarita", "/orders": "Buyurtmalarim", "/money": "Pulim", "/profile": "Profil" };

  return (
    <div className="app">
      {!nested && (
        <div className="top">
          <div>
            <div className="brand">{titles[path] || "Safos"}</div>
            <div className="muted">{user.first_name || "Agent"}</div>
          </div>
        </div>
      )}
      {screen}
      <nav className="tabs">
        {AGENT_TABS.map(([href, label, icon]) => {
          const active = href === "/"
            ? path === "/" || path.startsWith("/markets")
            : href === "/orders"
              ? path.startsWith("/orders")
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

export default function App() {
  const { path, parts, go } = useRoute();
  const storedUser = getStoredUser();
  const [user, setUser] = useState(storedUser);
  const [boot, setBoot] = useState(!storedUser && !!getRefresh());

  useEffect(() => {
    if (!getRefresh()) {
      setBoot(false);
      return;
    }
    let alive = true;
    api.me().then((u) => {
      if (!alive) return;
      saveSession({ user: u });
      setUser((prev) => {
        if (
          prev
          && prev.id === u.id
          && prev.role_type === u.role_type
          && prev.first_name === u.first_name
          && prev.last_name === u.last_name
          && prev.phone_number === u.phone_number
          && prev.photo === u.photo
        ) {
          return prev;
        }
        return u;
      });
    })
      .catch(() => { if (alive) { clearSession(); setUser(null); } })
      .finally(() => { if (alive) setBoot(false); });
    return () => { alive = false; };
  }, []);

  async function logout() {
    try { if (getRefresh()) await api.logout(getRefresh()); } catch { /* ignore */ }
    clearSession();
    setUser(null);
    go("#/login");
  }

  function onUserUpdate(next) {
    saveSession({ user: next });
    setUser(next);
  }

  if (boot) return <div className="app"><div className="card">Yuklanmoqda...</div></div>;
  if (!user) {
    return (
      <Login
        onLogin={(data) => {
          saveSession(data);
          setUser(data.user);
          go("#/");
        }}
      />
    );
  }

  if (user.role_type === "ADMIN") {
    return <AdminApp user={user} path={path} parts={parts} go={go} logout={logout} onUserUpdate={onUserUpdate} />;
  }

  if (user.role_type === "DELIVERER") {
    return <DelivererApp user={user} path={path} parts={parts} go={go} logout={logout} onUserUpdate={onUserUpdate} />;
  }

  if (user.role_type !== "AGENT") {
    return (
      <div className="app">
        <div className="card">
          <h2 className="h2">Bu rol uchun kabinet hali tayyor emas</h2>
          <p className="muted">Siz {user.role_label || user.role_type} sifatida kirdingiz. Agent va yetkazuvchi sahifalari tayyor.</p>
          <button className="btn" onClick={logout}>Chiqish</button>
        </div>
      </div>
    );
  }

  return <AgentApp user={user} path={path} parts={parts} go={go} logout={logout} onUserUpdate={onUserUpdate} />;
}
