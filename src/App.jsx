import React, { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend, ResponsiveContainer } from "recharts";

// =============================
// Curiata CargoOps — Single-file React SPA
// Theme: white (#FFFFFF) with blue accents (#0057B7) and hover/light (#2B8CED)
// Font: Inter/SF Pro (loaded via inline <link>)
// Routing: hash-based. Pages: /login, /dashboard, /receipt, /dispatch, /inventory, /transport, /users
// Roles: Admin, Supervisor, Viewer
// Seeded dummy data stored in localStorage. CSV export on tables. PDF snapshot (print) on dashboard.
// Inventory auto-refresh every 30s. Transport trip cron every minute.
// =============================

// ---- Utilities ----
const ACCENT = "#0057B7";
const ACCENT_LIGHT = "#2B8CED";
const ZEBRA_A = "#FFFFFF";
const ZEBRA_B = "#F5F6F7";

const enumBadge = {
  Bonded: "bg-blue-100 text-blue-700",
  FAK: "bg-orange-100 text-orange-700",
  "On Site": "bg-green-100 text-green-700",
  "In Transit": "bg-gray-200 text-gray-700",
  Dispatched: "bg-gray-100 text-gray-500",
};

const tripBadge = {
  Idle: "bg-gray-100 text-gray-700",
  Active: "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
};

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const choice = (arr) => arr[rand(0, arr.length - 1)];

const formatDate = (d) => new Date(d).toLocaleString();
const formatDay = (d) => new Date(d).toLocaleDateString();

const csvEscape = (v) => {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
};

function exportCSV(filename, rows) {
  if (!rows || !rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => csvEscape(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function numberBetween(min, max, decimals = 0) {
  const n = Math.random() * (max - min) + min;
  return parseFloat(n.toFixed(decimals));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// Simple notification/toast
function useToasts() {
  const [toasts, setToasts] = useState([]);
  function push(msg) {
    const id = uid("toast");
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2500);
  }
  const node = (
    <div className="fixed top-4 right-4 space-y-2 z-[100]">
      {toasts.map((t) => (
        <div key={t.id} className="px-4 py-2 rounded-xl shadow bg-black/80 text-white text-sm">{t.msg}</div>
      ))}
    </div>
  );
  return { push, node };
}

// ---- Auth / Roles ----
const ROLES = ["Admin", "Supervisor", "Viewer"];

function getAuth() {
  try {
    return JSON.parse(localStorage.getItem("cc_auth") || "null");
  } catch {
    return null;
  }
}
function setAuth(a) {
  localStorage.setItem("cc_auth", JSON.stringify(a));
}

function signOut() {
  localStorage.removeItem("cc_auth");
  location.hash = "#/login";
}

// ---- Seed Data ----
const STORAGE_KEY = "cc_seed_v1";

function seedIfNeeded() {
  if (localStorage.getItem(STORAGE_KEY)) return;

  const now = new Date();
  const start = addDays(now, -14);

  const drivers = ["S. Dlamini", "K. Naidoo", "P. Mkhize", "J. Smith", "M. Botha", "A. Patel", "R. Mthembu"]; 
  const marks = ["MNK/2025/01", "JHB/PK/77", "KZN/WH/88", "DBN/FG/12", "CPT/RT/55"]; 
  const vehicles = Array.from({ length: 10 }).map((_, i) => ({
    id: uid("veh"),
    vehicle_reg: `ND ${rand(1000, 9999)}`,
    driver_name: choice(drivers),
  }));

  // 50 receipts
  const warehouse_receipts = Array.from({ length: 50 }).map((_, i) => {
    const date_in = addDays(start, rand(0, 14));
    const quantity = rand(1, 200);
    const weight_kg = numberBetween(quantity * 5, quantity * 10, 1);
    const cargo_id = `CG-${rand(100, 999)}`; // implicit cargo id via indent_number for link
    const rec = {
      id: uid("rcpt"),
      cargo_id,
      date_in,
      indent_number: `${rand(10000, 99999)}`,
      quantity,
      marks_numbers: choice(marks),
      weight_kg,
      total_qty: quantity,
      vehicle_reg: choice(vehicles).vehicle_reg,
      driver_name: choice(drivers),
      expiry_date: addDays(date_in, rand(10, 60)),
      inspection_date: addDays(date_in, rand(0, 3)),
      comments: Math.random() < 0.2 ? "Damaged pallet corners" : "",
      label_printed: Math.random() < 0.6,
    };
    return rec;
  });

  // 20 dispatches (linked loosely by cargo id)
  const dispatches = Array.from({ length: 20 }).map((_, i) => {
    const date_packed = addDays(start, rand(0, 14));
    const date_dispatched = addDays(date_packed, rand(0, 2));
    const qty = rand(1, 150);
    const cargo_id = choice(warehouse_receipts).cargo_id;
    return {
      id: uid("dsp"),
      cargo_id,
      container_no: `MSCU${rand(1000000, 9999999)}`,
      seal_no_1: `${rand(100000, 999999)}`,
      seal_no_2: `${rand(100000, 999999)}`,
      date_packed,
      date_dispatched,
      truck_reg: `ND ${rand(1000, 9999)}`,
      driver_name: choice(drivers),
      qty_packed: qty,
      marks_numbers_packed: choice(marks),
      total_weight_kg: numberBetween(qty * 5, qty * 10, 1),
      inspections_completed: Math.random() < 0.8,
    };
  });

  // inventory snapshot from receipts - dispatches by cargo
  const byCargo = {};
  warehouse_receipts.forEach((r) => {
    if (!byCargo[r.cargo_id]) byCargo[r.cargo_id] = { quantity: 0, weight_kg: 0, last_movement: r.date_in };
    byCargo[r.cargo_id].quantity += r.quantity;
    byCargo[r.cargo_id].weight_kg += r.weight_kg;
    byCargo[r.cargo_id].last_movement = r.date_in;
  });
  dispatches.forEach((d) => {
    if (!byCargo[d.cargo_id]) byCargo[d.cargo_id] = { quantity: 0, weight_kg: 0, last_movement: d.date_dispatched };
    byCargo[d.cargo_id].quantity -= d.qty_packed;
    byCargo[d.cargo_id].weight_kg -= d.total_weight_kg;
    byCargo[d.cargo_id].last_movement = d.date_dispatched;
  });

  const invStatuses = ["Bonded", "FAK", "On Site", "In Transit"]; // enum
  const inventory_snapshot = Object.entries(byCargo).map(([cargo_id, v]) => ({
    id: uid("inv"),
    cargo_id,
    status: v.quantity <= 0 ? "Dispatched" : choice(invStatuses),
    quantity: Math.max(0, Math.floor(v.quantity)),
    weight_kg: Math.max(0, numberBetween(Math.max(0, v.weight_kg - 50), Math.max(0, v.weight_kg + 50), 1)),
    last_movement: v.last_movement,
  }));

  // 30 transport trips
  const transport_trips = Array.from({ length: 30 }).map((_, i) => {
    const start_time = addDays(start, rand(0, 14));
    const durationH = rand(1, 8);
    const end_time = addDays(start_time, 0); // clone then add hours
    const end = new Date(end_time);
    end.setHours(new Date(start_time).getHours() + durationH);
    return {
      id: uid("trip"),
      vehicle_reg: choice(vehicles).vehicle_reg,
      start_time,
      end_time: end.toISOString(),
      distance_km: numberBetween(10, 600, 1),
      fuel_used_l: numberBetween(2, 120, 1),
      container_no: `MSCU${rand(1000000, 9999999)}`,
      driver_name: choice(drivers),
      trip_status: choice(["Idle", "Active", "Completed"]),
    };
  });

  const users = [
    { id: uid("usr"), email: "admin@curiata.dev", role: "Admin", name: "Admin User", tempPassword: null },
    { id: uid("usr"), email: "supervisor@curiata.dev", role: "Supervisor", name: "Ops Supervisor", tempPassword: null },
    { id: uid("usr"), email: "viewer@curiata.dev", role: "Viewer", name: "Read Only", tempPassword: null },
  ];

  const passwords = {
    "admin@curiata.dev": "admin123",
    "supervisor@curiata.dev": "super123",
    "viewer@curiata.dev": "view123",
  };

  const db = { warehouse_receipts, dispatches, inventory_snapshot, transport_trips, vehicles, users, passwords };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function getDB() {
  seedIfNeeded();
  return JSON.parse(localStorage.getItem(STORAGE_KEY));
}
function setDB(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// PWA manifest injection
function ensureManifest() {
  const link = document.querySelector('link[rel="manifest"]');
  if (link) return;
  const manifest = {
    name: "Curiata CargoOps",
    short_name: "CargoOps",
    start_url: "./index.html#\\/login",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: ACCENT,
    icons: [],
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const l = document.createElement("link");
  l.rel = "manifest"; l.href = url; document.head.appendChild(l);
}

// Hash Router
function useHashRoute() {
  const [route, setRoute] = useState(location.hash.slice(1) || "/login");
  useEffect(() => {
    const h = () => setRoute(location.hash.slice(1) || "/login");
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  return [route, (r) => (location.hash = `#${r}`)];
}

// Role guards
function Guard({ allow, children }) {
  const auth = getAuth();
  if (!auth) {
    location.hash = "#/login";
    return null;
  }
  if (!allow.includes(auth.role)) {
    return (
      <div className="p-8 text-center text-red-700">Access denied for role <b>{auth.role}</b>.</div>
    );
  }
  return children;
}

// Layout components
function Sidebar({ routeTo }) {
  const [route] = useHashRoute();
  const items = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/receipt", label: "Stock Receipt" },
    { to: "/dispatch", label: "Stock Dispatch" },
    { to: "/inventory", label: "Inventory" },
    { to: "/transport", label: "Transport Log" },
    { to: "/users", label: "Users", adminOnly: true },
  ];
  const auth = getAuth();
  return (
    <aside className="w-64 border-r border-gray-200 h-screen sticky top-0 hidden md:flex flex-col">
      <div className="h-16 flex items-center gap-2 px-4" style={{ borderBottom: "1px solid #eee" }}>
        <div className="w-6 h-6 rounded bg-[var(--accent)]" />
        <div className="font-semibold">Curiata CargoOps</div>
      </div>
      <nav className="flex-1 p-2">
        {items.map((it) => {
          if (it.adminOnly && auth?.role !== "Admin") return null;
          const active = route === it.to;
          return (
            <button key={it.to} onClick={() => routeTo(it.to)}
              className={`w-full text-left px-3 py-2 rounded-lg mb-1 hover:bg-[var(--accent-light)]/10 ${active ? "bg-[var(--accent)]/10 border-l-4 border-[var(--accent)]" : ""}`}>{it.label}</button>
          );
        })}
      </nav>
      <div className="p-3 text-xs text-gray-500">v0.1 demo</div>
    </aside>
  );
}

function HeaderBar() {
  const auth = getAuth();
  return (
    <header className="h-16 w-full flex items-center justify-between px-4 border-b border-gray-200 sticky top-0 bg-white z-40">
      <div className="md:hidden flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-[var(--accent)]" />
        <div className="font-semibold">CargoOps</div>
      </div>
      <div className="flex-1"></div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">{auth?.email} · {auth?.role}</span>
        <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] font-bold">{auth?.email?.[0]?.toUpperCase()}</div>
        <button onClick={signOut} className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm">Sign out</button>
      </div>
    </header>
  );
}

function Shell({ children, routeTo }) {
  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ ['--accent']: ACCENT, ['--accent-light']: ACCENT_LIGHT }}>
      {/* Font link */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div className="flex" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "SF Pro", Segoe UI, Roboto' }}>
        <Sidebar routeTo={routeTo} />
        <main className="flex-1 min-h-screen">
          <HeaderBar />
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

// Reusable Table
function DataTable({ rows, columns, title, filename, onAdd, actions }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: columns[0]?.key, dir: "asc" });

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    let r = rows.filter((row) => !q || Object.values(row).some((v) => String(v).toLowerCase().includes(q)));
    if (sort.key) {
      r = r.sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * (sort.dir === "asc" ? 1 : -1);
      });
    }
    return r;
  }, [rows, query, sort]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between p-4">
        <div className="font-semibold">{title}</div>
        <div className="flex gap-2">
          <input className="px-3 py-1.5 border rounded-lg text-sm" placeholder="Filter..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <button onClick={() => exportCSV(filename || title, filtered)} className="px-3 py-1.5 rounded-lg text-sm bg-[var(--accent)] text-white hover:bg-[var(--accent-light)]">Export CSV</button>
          {onAdd && (
            <button onClick={onAdd} className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200">New</button>
          )}
        </div>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {columns.map((c) => (
                <th key={c.key} className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => setSort((s) => ({ key: c.key, dir: s.dir === "asc" ? "desc" : "asc" }))}>
                  <div className="flex items-center gap-1">
                    <span>{c.header}</span>
                    {sort.key === c.key && <span className="text-gray-400">{sort.dir === "asc" ? "▲" : "▼"}</span>}
                  </div>
                </th>
              ))}
              {actions && <th className="px-3 py-2"/>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, idx) => (
              <tr key={row.id || idx} className={idx % 2 === 0 ? "bg-[var(--zebra-a)]" : "bg-[var(--zebra-b)]"} style={{ ['--zebra-a']: ZEBRA_A, ['--zebra-b']: ZEBRA_B }}>
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-2 whitespace-nowrap">{c.render ? c.render(row[c.key], row) : String(row[c.key])}</td>
                ))}
                {actions && <td className="px-3 py-2">{actions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----- Pages -----
function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const { push, node } = useToasts();

  function doLogin(e) {
    e.preventDefault();
    const db = getDB();
    const ok = db.passwords[email] && db.passwords[email] === password;
    const user = db.users.find((u) => u.email === email);
    if (ok && user) {
      setAuth({ email, role: user.role, name: user.name });
      location.hash = "#/dashboard";
    } else if (user && user.tempPassword === password) {
      // consume temp password
      user.tempPassword = null;
      db.passwords[email] = password; // set password to temp as permanent
      setDB(db);
      setAuth({ email, role: user.role, name: user.name });
      location.hash = "#/dashboard";
    } else {
      setErr("Invalid credentials");
    }
  }

  function forgot() {
    const db = getDB();
    const user = db.users.find((u) => u.email === email);
    if (!user) { setErr("Email not found"); return; }
    const temp = `Temp${rand(10000,99999)}!`;
    user.tempPassword = temp;
    setDB(db);
    push(`Temporary password issued: ${temp}`);
  }

  useEffect(() => { ensureManifest(); }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white" style={{ ['--accent']: ACCENT, ['--accent-light']: ACCENT_LIGHT }}>
      {node}
      <div className="w-full max-w-sm border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="text-center mb-4">
          <div className="w-10 h-10 mx-auto rounded bg-[var(--accent)]" />
          <h1 className="mt-2 text-lg font-semibold">Sign in</h1>
        </div>
        <form onSubmit={doLogin} className="space-y-3">
          <input type="email" placeholder="Email" className="w-full px-3 py-2 border rounded-lg" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" className="w-full px-3 py-2 border rounded-lg" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {err && <div className="text-sm text-red-600">{err}</div>}
          <button className="w-full py-2 rounded-lg text-white" style={{ background: ACCENT }}>Sign in</button>
        </form>
        <div className="mt-3 text-right text-sm">
          <button className="text-[var(--accent)] hover:text-[var(--accent-light)]" onClick={forgot}>Forgot password?</button>
        </div>
        <div className="mt-4 text-xs text-gray-500">
          Demo users:<br/>
          admin@curiata.dev / admin123<br/>
          supervisor@curiata.dev / super123<br/>
          viewer@curiata.dev / view123
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  const db = getDB();
  const { inventory_snapshot, warehouse_receipts, dispatches, transport_trips } = db;

  const totals = React.useMemo(() => {
    const today = new Date().toDateString();
    const receiptsToday = warehouse_receipts.filter(r => new Date(r.date_in).toDateString() === today).length;
    const dispatchesToday = dispatches.filter(d => new Date(d.date_dispatched).toDateString() === today).length;
    const onSite = inventory_snapshot.filter(i => i.status === "On Site").reduce((a, b) => a + (b.quantity || 0), 0);
    return { receiptsToday, dispatchesToday, onSite };
  }, [db]);

  const doughnutData = React.useMemo(() => {
    const counts = {};
    ["Bonded","FAK","On Site","In Transit","Dispatched"].forEach(k=>counts[k]=0);
    db.inventory_snapshot.forEach(i => counts[i.status] = (counts[i.status]||0) + i.quantity);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [db]);

  const dailyMovement = React.useMemo(() => {
    const map = {};
    db.warehouse_receipts.forEach(r => { const d = new Date(r.date_in).toDateString(); map[d] = (map[d]||0) + r.quantity; });
    db.dispatches.forEach(d => { const day = new Date(d.date_dispatched).toDateString(); map[day] = (map[day]||0) - d.qty_packed; });
    return Object.entries(map).sort((a,b)=> new Date(a[0]) - new Date(b[0])).map(([date, qty]) => ({ date, qty }));
  }, [db]);

  const fuelByVehicle = React.useMemo(() => {
    const m = {};
    db.transport_trips.forEach(t => { m[t.vehicle_reg] = (m[t.vehicle_reg]||0) + Number(t.fuel_used_l||0); });
    return Object.entries(m).map(([vehicle, fuel]) => ({ vehicle, fuel }));
  }, [db]);

  function printPDF() {
    window.print();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Executive Dashboard</h2>
        <button onClick={printPDF} className="px-3 py-2 rounded-lg text-white" style={{ background: ACCENT }}>Download PDF Snapshot</button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <KPI title="Total On-Site" value={totals.onSite} />
        <KPI title="Today's Receipts" value={totals.receiptsToday} />
        <KPI title="Today's Dispatches" value={totals.dispatchesToday} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="font-semibold mb-2">Bonded vs FAK vs Other</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={doughnutData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}>
                  {doughnutData.map((_, i) => <Cell key={i} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="font-semibold mb-2">Daily Movement</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyMovement}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="qty" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="font-semibold mb-2">Fuel by Vehicle</div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fuelByVehicle}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="vehicle" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="fuel" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <VehicleStatusCards />
    </div>
  );
}

function KPI({ title, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function VehicleStatusCards() {
  const db = getDB();
  const vehicles = Array.from(new Set(db.transport_trips.map(t => t.vehicle_reg)));
  const latestByVehicle = vehicles.map(v => {
    const t = db.transport_trips.filter(x => x.vehicle_reg === v).sort((a,b)=> new Date(b.start_time)-new Date(a.start_time))[0];
    return { vehicle_reg: v, status: t?.trip_status || "Idle", driver: t?.driver_name || "-" };
  });
  return (
    <div className="grid md:grid-cols-4 gap-4">
      {latestByVehicle.map((v) => (
        <div key={v.vehicle_reg} className="rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2" style={{ background: ACCENT, color: 'white' }}>{v.vehicle_reg}</div>
          <div className="p-4 text-sm flex justify-between">
            <div>
              <div className="text-gray-500">Driver</div>
              <div className="font-medium">{v.driver}</div>
            </div>
            <div className={`px-2 h-fit rounded ${tripBadge[v.status]}`}>{v.status}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReceiptPage() {
  const [db, setDbState] = useState(getDB());
  const [show, setShow] = useState(false);
  const { push, node } = useToasts();
  const auth = getAuth();

  function save(newRec) {
    const next = { ...db };
    next.warehouse_receipts = [newRec, ...next.warehouse_receipts];
    // upsert inventory snapshot
    let inv = next.inventory_snapshot.find(i => i.cargo_id === newRec.cargo_id);
    if (!inv) {
      inv = { id: uid("inv"), cargo_id: newRec.cargo_id, status: "On Site", quantity: 0, weight_kg: 0, last_movement: newRec.date_in };
      next.inventory_snapshot.push(inv);
    }
    inv.quantity += Number(newRec.quantity);
    inv.weight_kg += Number(newRec.weight_kg);
    inv.status = "On Site";
    inv.last_movement = newRec.date_in;
    setDB(next);
    setDbState(next);
    setShow(false);
    push("Label queued to Honeywell (mock)");
  }

  const cols = [
    { key: 'date_in', header: 'Date In', render: (v)=> formatDate(v)},
    { key: 'cargo_id', header: 'Cargo ID' },
    { key: 'indent_number', header: 'Indent #' },
    { key: 'quantity', header: 'Qty' },
    { key: 'weight_kg', header: 'Weight (kg)' },
    { key: 'vehicle_reg', header: 'Vehicle' },
    { key: 'driver_name', header: 'Driver' },
    { key: 'expiry_date', header: 'Expiry', render: (v)=> formatDay(v)},
    { key: 'inspection_date', header: 'Inspection', render: (v)=> formatDay(v)},
    { key: 'label_printed', header: 'Label', render: (v)=> v? 'Yes':'No' },
  ];

  return (
    <Guard allow={["Admin","Supervisor"]}>
      <div>
        {node}
        <DataTable title="Warehouse Receipts" filename="warehouse_receipts" rows={db.warehouse_receipts} columns={cols} onAdd={() => setShow(true)} />
        {show && <ReceiptDrawer onClose={()=>setShow(false)} onSave={save} />}
      </div>
    </Guard>
  );
}

function ReceiptDrawer({ onClose, onSave }) {
  const [form, setForm] = useState({
    id: uid("rcpt"),
    cargo_id: `CG-${rand(100,999)}`,
    date_in: new Date().toISOString(),
    indent_number: `${rand(10000, 99999)}`,
    quantity: 10,
    marks_numbers: "",
    weight_kg: 100,
    total_qty: 10,
    vehicle_reg: `ND ${rand(1000,9999)}`,
    driver_name: "",
    expiry_date: addDays(new Date(), 30),
    inspection_date: new Date().toISOString(),
    comments: "",
    label_printed: false,
  });

  function submit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
      <div className="w-full max-w-md bg-white h-full p-4 overflow-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">New Receipt</div>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          {Object.entries({
            cargo_id: "Cargo ID", indent_number: "Indent #", quantity: "Quantity", marks_numbers: "Marks/Numbers", weight_kg: "Weight (kg)", total_qty: "Total Qty", vehicle_reg: "Vehicle Reg", driver_name: "Driver Name", comments: "Comments"
          }).map(([key, label]) => (
            <div key={key} className="col-span-2">
              <label className="text-xs text-gray-600">{label}</label>
              <input className="w-full px-3 py-2 border rounded-lg" value={form[key]} onChange={(e)=> setForm(f=>({...f,[key]: e.target.value}))} required={['comments','marks_numbers'].includes(key)?false:true} />
            </div>
          ))}
          <div>
            <label className="text-xs text-gray-600">Date In</label>
            <input type="datetime-local" className="w-full px-3 py-2 border rounded-lg" value={new Date(form.date_in).toISOString().slice(0,16)} onChange={(e)=> setForm(f=>({...f,date_in: new Date(e.target.value).toISOString()}))} />
          </div>
          <div>
            <label className="text-xs text-gray-600">Inspection Date</label>
            <input type="date" className="w-full px-3 py-2 border rounded-lg" value={new Date(form.inspection_date).toISOString().slice(0,10)} onChange={(e)=> setForm(f=>({...f,inspection_date: new Date(e.target.value).toISOString()}))} />
          </div>
          <div>
            <label className="text-xs text-gray-600">Expiry Date</label>
            <input type="date" className="w-full px-3 py-2 border rounded-lg" value={new Date(form.expiry_date).toISOString().slice(0,10)} onChange={(e)=> setForm(f=>({...f,expiry_date: new Date(e.target.value).toISOString()}))} />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" checked={form.label_printed} onChange={(e)=> setForm(f=>({...f,label_printed: e.target.checked}))} />
            <span className="text-sm">Label printed</span>
          </div>
          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg bg-gray-100">Cancel</button>
            <button className="px-3 py-2 rounded-lg text-white" style={{ background: ACCENT }}>Save & Print Label</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DispatchPage() {
  const [db, setDbState] = useState(getDB());
  const [show, setShow] = useState(false);

  function save(newD) {
    const next = { ...db };
    next.dispatches = [newD, ...next.dispatches];
    // deduct from inventory
    const inv = next.inventory_snapshot.find(i => i.cargo_id === newD.cargo_id);
    if (inv) {
      inv.quantity = Math.max(0, inv.quantity - Number(newD.qty_packed));
      inv.weight_kg = Math.max(0, inv.weight_kg - Number(newD.total_weight_kg));
      if (inv.quantity === 0) inv.status = "Dispatched";
      inv.last_movement = newD.date_dispatched;
    }
    setDB(next);
    setDbState(next);
    setShow(false);
  }

  const cols = [
    { key: 'date_packed', header: 'Date Packed', render: (v)=> formatDate(v)},
    { key: 'date_dispatched', header: 'Date Dispatched', render: (v)=> formatDate(v)},
    { key: 'cargo_id', header: 'Cargo ID' },
    { key: 'container_no', header: 'Container #' },
    { key: 'qty_packed', header: 'Qty' },
    { key: 'total_weight_kg', header: 'Weight (kg)' },
    { key: 'truck_reg', header: 'Truck' },
    { key: 'driver_name', header: 'Driver' },
    { key: 'inspections_completed', header: 'Inspections', render: (v)=> v? '✅':'—' },
  ];

  return (
    <Guard allow={["Admin","Supervisor"]}>
      <div>
        <DataTable title="Dispatches" filename="dispatches" rows={db.dispatches} columns={cols} onAdd={() => setShow(true)} />
        {show && <DispatchDrawer onClose={()=>setShow(false)} onSave={save} />}
      </div>
    </Guard>
  );
}

function DispatchDrawer({ onClose, onSave }) {
  const [form, setForm] = useState({
    id: uid("dsp"),
    cargo_id: `CG-${rand(100,999)}`,
    container_no: `MSCU${rand(1000000, 9999999)}`,
    seal_no_1: `${rand(100000,999999)}`,
    seal_no_2: `${rand(100000,999999)}`,
    date_packed: new Date().toISOString(),
    date_dispatched: new Date().toISOString(),
    truck_reg: `ND ${rand(1000,9999)}`,
    driver_name: "",
    qty_packed: 10,
    marks_numbers_packed: "",
    total_weight_kg: 100,
    inspections_completed: true,
  });

  function submit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
      <div className="w_full max-w-md bg-white h-full p-4 overflow-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">New Dispatch</div>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          {Object.entries({
            cargo_id: "Cargo ID", container_no: "Container #", seal_no_1: "Seal #1", seal_no_2: "Seal #2", truck_reg: "Truck Reg", driver_name: "Driver Name", qty_packed: "Quantity", marks_numbers_packed: "Marks/Numbers", total_weight_kg: "Weight (kg)"
          }).map(([key, label]) => (
            <div key={key} className="col-span-2">
              <label className="text-xs text-gray-600">{label}</label>
              <input className="w-full px-3 py-2 border rounded-lg" value={form[key]} onChange={(e)=> setForm(f=>({...f,[key]: e.target.value}))} required={['marks_numbers_packed'].includes(key)?false:true} />
            </div>
          ))}
          <div>
            <label className="text-xs text-gray-600">Date Packed</label>
            <input type="datetime-local" className="w-full px-3 py-2 border rounded-lg" value={new Date(form.date_packed).toISOString().slice(0,16)} onChange={(e)=> setForm(f=>({...f,date_packed: new Date(e.target.value).toISOString()}))} />
          </div>
          <div>
            <label className="text-xs text-gray-600">Date Dispatched</label>
            <input type="datetime-local" className="w-full px-3 py-2 border rounded-lg" value={new Date(form.date_dispatched).toISOString().slice(0,16)} onChange={(e)=> setForm(f=>({...f,date_dispatched: new Date(e.target.value).toISOString()}))} />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" checked={form.inspections_completed} onChange={(e)=> setForm(f=>({...f,inspections_completed: e.target.checked}))} />
            <span className="text-sm">Inspections completed</span>
          </div>
          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg bg-gray-100">Cancel</button>
            <button className="px-3 py-2 rounded-lg text-white" style={{ background: ACCENT }}>Save Dispatch</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InventoryPage() {
  const [db, setDbState] = useState(getDB());
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);

  // Auto-refresh every 30s
  useEffect(() => {
    const h = setInterval(() => setDbState(getDB()), 30000);
    return () => clearInterval(h);
  }, []);

  const rows = db.inventory_snapshot.filter(i => filter === "All" || i.status === filter);
  const cols = [
    { key: 'cargo_id', header: 'Cargo ID' },
    { key: 'status', header: 'Status', render: (v) => <span className={`px-2 py-1 rounded ${enumBadge[v]}`}>{v}</span> },
    { key: 'quantity', header: 'Qty' },
    { key: 'weight_kg', header: 'Weight (kg)' },
    { key: 'last_movement', header: 'Last Movement', render: (v)=> formatDate(v)},
  ];

  return (
    <Guard allow={["Admin","Supervisor","Viewer"]}>
      <div className="space-y-3">
        <div className="flex gap-2">
          {['All','Bonded','FAK','On Site','In Transit','Dispatched'].map(s => (
            <button key={s} onClick={()=> setFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm border ${filter===s? 'bg-[var(--accent)] text-white border-[var(--accent)]':'bg-white hover:bg-gray-50'}`}>{s}</button>
          ))}
        </div>
        <DataTable title="Inventory" filename="inventory" rows={rows} columns={cols} actions={(row)=> (
          <button onClick={()=> setSelected(row)} className="text-[var(--accent)] hover:text-[var(--accent-light)]">View</button>
        )} />
        {selected && <MovementDrawer cargo={selected} onClose={()=> setSelected(null)} />}
      </div>
    </Guard>
  );
}

function MovementDrawer({ cargo, onClose }) {
  const db = getDB();
  const receipts = db.warehouse_receipts.filter(r => r.cargo_id === cargo.cargo_id).map(r => ({ type: 'Receipt', date: r.date_in, qty: r.quantity, details: r.indent_number }));
  const dispatches = db.dispatches.filter(d => d.cargo_id === cargo.cargo_id).map(d => ({ type: 'Dispatch', date: d.date_dispatched, qty: -d.qty_packed, details: d.container_no }));
  const rows = [...receipts, ...dispatches].sort((a,b)=> new Date(a.date) - new Date(b.date));
  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
      <div className="w-full max-w-lg bg-white h-full p-4 overflow-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Movement History – {cargo.cargo_id}</div>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50"><th className="text-left px-3 py-2">Type</th><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Qty</th><th className="text-left px-3 py-2">Details</th></tr></thead>
          <tbody>
            {rows.map((r,i)=> (
              <tr key={i} className={i%2===0? 'bg-white':'bg-gray-50'}>
                <td className="px-3 py-2">{r.type}</td>
                <td className="px-3 py-2">{formatDate(r.date)}</td>
                <td className="px-3 py-2">{r.qty}</td>
                <td className="px-3 py-2">{r.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransportPage() {
  const [db, setDbState] = useState(getDB());
  const [modalVeh, setModalVeh] = useState(null);

  // Cron: every minute add & update random trips
  useEffect(() => {
    const t = setInterval(() => {
      const next = getDB();
      // randomly create or update a trip
      if (Math.random() < 0.6) {
        const start = new Date();
        start.setMinutes(start.getMinutes() - rand(10, 120));
        next.transport_trips.unshift({
          id: uid("trip"),
          vehicle_reg: `ND ${rand(1000,9999)}`,
          start_time: start.toISOString(),
          end_time: new Date().toISOString(),
          distance_km: numberBetween(5, 200, 1),
          fuel_used_l: numberBetween(1, 40, 1),
          container_no: `MSCU${rand(1000000, 9999999)}`,
          driver_name: choice(["S. Dlamini","K. Naidoo","P. Mkhize","J. Smith","M. Botha","A. Patel","R. Mthembu"]),
          trip_status: choice(["Idle","Active","Completed"]) ,
        });
      } else if (next.transport_trips.length) {
        const i = rand(0, Math.min(10, next.transport_trips.length-1));
        next.transport_trips[i].trip_status = choice(["Idle","Active","Completed"]);
      }
      setDB(next);
      setDbState(next);
    }, 60000);
    return () => clearInterval(t);
  }, []);

  const vehicles = Array.from(new Set(db.transport_trips.map(t => t.vehicle_reg)));

  function generateDummyTrip() {
    const next = getDB();
    next.transport_trips.unshift({
      id: uid("trip"),
      vehicle_reg: `ND ${rand(1000,9999)}`,
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      distance_km: numberBetween(10, 500, 1),
      fuel_used_l: numberBetween(2, 100, 1),
      container_no: `MSCU${rand(1000000, 9999999)}`,
      driver_name: choice(["S. Dlamini","K. Naidoo","P. Mkhize","J. Smith","M. Botha","A. Patel","R. Mthembu"]),
      trip_status: choice(["Idle","Active","Completed"]) ,
    });
    setDB(next); setDbState(next);
  }

  return (
    <Guard allow={["Admin","Supervisor","Viewer"]}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Transport Log</h3>
          <button onClick={generateDummyTrip} className="px-3 py-2 rounded-lg text-white" style={{ background: ACCENT }}>Generate Dummy Trip</button>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {vehicles.map(v => {
            const latest = db.transport_trips.filter(t=> t.vehicle_reg===v).sort((a,b)=> new Date(b.start_time)-new Date(a.start_time))[0];
            return (
              <div key={v} className="rounded-2xl border border-gray-200 overflow-hidden cursor-pointer" onClick={()=> setModalVeh(v)}>
                <div className="px-4 py-2" style={{ background: ACCENT, color: 'white' }}>{v}</div>
                <div className="p-4 text-sm flex justify-between">
                  <div>
                    <div className="text-gray-500">Driver</div>
                    <div className="font-medium">{latest?.driver_name || '-'}</div>
                  </div>
                  <div className={`px-2 h-fit rounded ${tripBadge[latest?.trip_status || 'Idle']}`}>{latest?.trip_status || 'Idle'}</div>
                </div>
              </div>
            );
          })}
        </div>
        {modalVeh && <TripHistoryModal vehicle={modalVeh} onClose={()=> setModalVeh(null)} />}
      </div>
    </Guard>
  );
}

function TripHistoryModal({ vehicle, onClose }) {
  const db = getDB();
  const rows = db.transport_trips.filter(t => t.vehicle_reg === vehicle).sort((a,b)=> new Date(b.start_time)-new Date(a.start_time));
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="w-full max-w-3xl max-h-[80vh] overflow-auto bg-white rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Trip History – {vehicle}</div>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>
        <DataTable title="" filename={`trips_${vehicle}`} rows={rows} columns={[
          { key:'start_time', header:'Start', render:(v)=> formatDate(v) },
          { key:'end_time', header:'End', render:(v)=> formatDate(v) },
          { key:'distance_km', header:'Distance (km)' },
          { key:'fuel_used_l', header:'Fuel (L)' },
          { key:'container_no', header:'Container #' },
          { key:'driver_name', header:'Driver' },
          { key:'trip_status', header:'Status' },
        ]} />
      </div>
    </div>
  );
}

function UsersPage() {
  const [db, setDbState] = useState(getDB());
  const [show, setShow] = useState(false);

  const cols = [
    { key: 'email', header: 'Email' },
    { key: 'name', header: 'Name' },
    { key: 'role', header: 'Role' },
    { key: 'tempPassword', header: 'Temp Password', render:(v)=> v||'—' },
  ];

  function invite(user) {
    const next = { ...db };
    next.users.push(user);
    next.passwords[user.email] = user.tempPassword; // set temp as password until first login
    setDB(next); setDbState(next); setShow(false);
  }

  return (
    <Guard allow={["Admin"]}>
      <div>
        <DataTable title="Users" filename="users" rows={db.users} columns={cols} onAdd={()=> setShow(true)} />
        {show && <InviteUserDrawer onClose={()=> setShow(false)} onInvite={invite} />}
      </div>
    </Guard>
  );
}

function InviteUserDrawer({ onClose, onInvite }) {
  const [form, setForm] = useState({ id: uid("usr"), email: "", name: "", role: "Viewer", tempPassword: `Temp${rand(10000,99999)}!` });
  function submit(e) { e.preventDefault(); onInvite(form); }
  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
      <div className="w-full max-w-md bg-white h-full p-4 overflow-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Invite User</div>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-600">Email</label>
            <input type="email" className="w-full px-3 py-2 border rounded-lg" value={form.email} onChange={(e)=> setForm(f=>({...f,email: e.target.value}))} required />
          </div>
          <div>
            <label className="text-xs text-gray-600">Name</label>
            <input className="w-full px-3 py-2 border rounded-lg" value={form.name} onChange={(e)=> setForm(f=>({...f,name: e.target.value}))} required />
          </div>
          <div>
            <label className="text-xs text-gray-600">Role</label>
            <select className="w-full px-3 py-2 border rounded-lg" value={form.role} onChange={(e)=> setForm(f=>({...f,role: e.target.value}))}>
              {ROLES.map(r=> <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Temporary Password</label>
            <input className="w-full px-3 py-2 border rounded-lg" value={form.tempPassword} onChange={(e)=> setForm(f=>({...f,tempPassword: e.target.value}))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg bg-gray-100">Cancel</button>
            <button className="px-3 py-2 rounded-lg text-white" style={{ background: ACCENT }}>Send Invite</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Root app with router
export default function App() {
  const [route, routeTo] = useHashRoute();

  useEffect(() => {
    seedIfNeeded();
    ensureManifest();
  }, []);

  const auth = getAuth();
  const publicOnly = route === "/login";

  if (!auth && route !== "/login") {
    location.hash = "#/login";
    return null;
  }

  return (
    <div>
      {publicOnly ? (
        <LoginPage />
      ) : (
        <Shell routeTo={routeTo}>
          {route === "/dashboard" && <DashboardPage />}
          {route === "/receipt" && <ReceiptPage />}
          {route === "/dispatch" && <DispatchPage />}
          {route === "/inventory" && <InventoryPage />}
          {route === "/transport" && <TransportPage />}
          {route === "/users" && <UsersPage />}
          {!["/dashboard","/receipt","/dispatch","/inventory","/transport","/users"].includes(route) && <div>Not Found</div>}
        </Shell>
      )}
      <style>{`
        :root { --accent: ${ACCENT}; --accent-light: ${ACCENT_LIGHT}; }
        body { background: #fff; }
        table tbody tr:nth-child(odd) { background: ${ZEBRA_A}; }
        table tbody tr:nth-child(even) { background: ${ZEBRA_B}; }
        @media print {
          aside, header, .no-print { display: none !important; }
          main { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
