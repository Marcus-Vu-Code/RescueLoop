"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  LayoutDashboard,
  PackageOpen,
  GitCompareArrows,
  Users,
  ChartNoAxesCombined,
  Leaf,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  MapPin,
  Clock,
  Download,
  Upload,
  Sparkles,
  Check,
  CheckCheck,
  X,
  SlidersHorizontal,
  ShieldCheck,
  Info,
  Settings,
  HelpCircle,
  CalendarDays,
  ArrowUp,
  Utensils,
  Scale,
  Truck,
  RefreshCw,
  Menu,
  AlertTriangle,
  FileText,
  CheckCircle2,
  LoaderCircle,
  Sprout,
  Navigation,
  ExternalLink,
} from "lucide-react";
import {
  seedState,
  generateMatches,
  approveMatch,
  collectFood,
  impact,
  usedCapacity,
  timeLabel,
  formatKg,
  validateFood,
  validatePartner,
  parseNote,
  parseInventoryCSV,
  parsePartnersCSV,
  csvExport,
  isStoredState,
  DEMO_DATE,
  DEMO_TIME,
  CATEGORIES,
  STORAGES,
  SAMPLE_NOTE,
  INVENTORY_CSV,
  PARTNERS_CSV,
  type Food,
  type Partner,
  type State,
  type Match,
  type Category,
  type Storage,
} from "../lib/rescue";

type View =
  | "Overview"
  | "Food listings"
  | "Pickup matches"
  | "Partners"
  | "Impact report";
type Popup =
  "add" | "partner" | "guide" | "settings" | "activity" | "methodology" | null;
const NAV = [
  { label: "Overview" as View, icon: LayoutDashboard },
  { label: "Food listings" as View, icon: PackageOpen },
  { label: "Pickup matches" as View, icon: GitCompareArrows },
  { label: "Partners" as View, icon: Users },
  { label: "Impact report" as View, icon: ChartNoAxesCombined },
];
const STORAGE_KEY = "rescueloop.workspace.v1";
const STATUS_LABEL = {
  available: "Available",
  review: "Needs review",
  reserved: "Pickup approved",
  collected: "Collected",
};
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={"brand " + (small ? "small" : "")}>
      <span className="brand-mark">
        <RefreshCw size={24} />
        <Leaf size={12} className="brand-leaf" />
      </span>
      {!small && (
        <span>
          rescue<span className="brand-light">loop</span>
          <span className="brand-dot">.</span>
        </span>
      )}
    </span>
  );
}
export function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
export function Modal({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={"modal " + (wide ? "wide" : "")}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-heading">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        <button
          className="icon-btn"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function FoodArt({ food }: { food: Pick<Food, "name" | "category"> }) {
  const bakery = food.category === "Bakery",
    produce = food.category === "Produce",
    sandwich = food.name.toLowerCase().includes("sandwich"),
    soup = food.name.toLowerCase().includes("soup");
  return (
    <span
      className={`food-art ${bakery ? "bakery" : produce ? "produce" : soup ? "soup" : "meal"}`}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true">
        {bakery ? (
          <>
            <path
              d="M13 43c-8-16 2-28 18-29 21-2 28 13 20 29-8 9-29 11-38 0"
              fill="#b67d43"
            />
            <path
              d="M14 36c-3-12 5-20 17-21 17-1 23 9 20 20-10 8-25 11-37 1"
              fill="#dfb477"
            />
            {[22, 32, 42].map((x) => (
              <path
                key={x}
                d={`M${x} 22l-5 10`}
                stroke="#f4d6aa"
                strokeWidth="4"
                strokeLinecap="round"
              />
            ))}
          </>
        ) : produce ? (
          <>
            <path d="M11 41l13-25 6 4-13 27z" fill="#e59a55" />
            <path
              d="M24 19l-1-10m3 11 8-9"
              stroke="#658b46"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx="41" cy="37" r="13" fill="#76994e" />
            <path d="M38 25c-3-8 4-12 9-12-1 8-4 10-9 12" fill="#3e7144" />
            <circle cx="29" cy="45" r="10" fill="#c45f49" />
            <path d="M26 35l4 5 4-6" fill="#487249" />
          </>
        ) : sandwich ? (
          <>
            <path d="M8 43L30 14l26 29z" fill="#c89352" />
            <path d="M11 39l19-24 22 24z" fill="#f4deb4" />
            <path d="M12 41l39 1-6 7-27-1z" fill="#739052" />
            <path d="M17 44l31 1-4 6-24-1z" fill="#d18c66" />
            <path d="M13 48l34 2-6 6-24-1z" fill="#ead19e" />
          </>
        ) : (
          <>
            <ellipse cx="32" cy="38" rx="24" ry="16" fill="#eae7db" />
            <ellipse cx="32" cy="35" rx="23" ry="15" fill="#fcfbf4" />
            <ellipse
              cx="32"
              cy="34"
              rx="18"
              ry="11"
              fill={soup ? "#c96940" : "#decda0"}
            />
            {!soup &&
              [
                [-10, -2],
                [4, -6],
                [9, 3],
                [-5, 5],
              ].map(([x, y], i) => (
                <g key={i}>
                  <ellipse
                    cx={32 + x}
                    cy={34 + y}
                    rx="5"
                    ry="3"
                    transform={`rotate(-20 ${32 + x} ${34 + y})`}
                    fill={i % 2 ? "#6a904f" : "#e29d56"}
                  />
                  <circle cx={34 + x} cy={30 + y} r="2" fill="#8ca957" />
                </g>
              ))}
            {soup && (
              <>
                <path
                  d="M22 31c9 8 13-8 20 0"
                  stroke="#f6dba2"
                  fill="none"
                  strokeWidth="2"
                />
                <path d="M31 28c-1-6 3-7 6-7 0 5-1 7-6 7" fill="#6b8d45" />
              </>
            )}
          </>
        )}
      </svg>
    </span>
  );
}
function CampusMap({ onMatches }: { onMatches: () => void }) {
  return (
    <div className="campus-map">
      <svg
        viewBox="0 0 530 244"
        role="img"
        aria-label="Illustrative campus map showing dining locations connected to community partners"
      >
        <defs>
          <pattern
            id="mapgrid"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M22 0H0V22"
              fill="none"
              stroke="#dce3d7"
              strokeWidth=".6"
            />
          </pattern>
          <filter id="pinshadow">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity=".12" />
          </filter>
        </defs>
        <rect width="530" height="244" fill="#ecf0e5" />
        <rect width="530" height="244" fill="url(#mapgrid)" />
        <path
          d="M-20 191L178-5M152 254L421-8M354 261L540 73M-10 26L525 202M-18 113L394 250M208-6L538 103"
          stroke="#d7ddd1"
          strokeWidth="18"
        />
        <path
          d="M-20 191L178-5M152 254L421-8M354 261L540 73M-10 26L525 202M-18 113L394 250M208-6L538 103"
          stroke="#fafbf5"
          strokeWidth="12"
        />
        <g fill="#d4dfc7" stroke="#c8d7ba">
          <rect
            x="190"
            y="77"
            width="91"
            height="78"
            rx="20"
            transform="rotate(18 235 116)"
          />
          <ellipse
            cx="451"
            cy="43"
            rx="56"
            ry="34"
            transform="rotate(20 451 43)"
          />
          <path d="M22 207l68-24 41 40-48 20H22z" />
        </g>
        <g fill="#d9dfd3" stroke="#cdd5c7" strokeWidth="1">
          <rect
            x="90"
            y="30"
            width="41"
            height="23"
            rx="3"
            transform="rotate(18 110 40)"
          />
          <rect
            x="145"
            y="47"
            width="23"
            height="47"
            rx="3"
            transform="rotate(18 155 70)"
          />
          <rect
            x="312"
            y="97"
            width="35"
            height="25"
            rx="3"
            transform="rotate(18 330 110)"
          />
          <rect
            x="356"
            y="125"
            width="45"
            height="30"
            rx="3"
            transform="rotate(18 380 140)"
          />
          <rect
            x="419"
            y="157"
            width="40"
            height="25"
            rx="3"
            transform="rotate(18 440 170)"
          />
          <rect
            x="145"
            y="173"
            width="40"
            height="23"
            rx="3"
            transform="rotate(18 165 185)"
          />
          <rect
            x="298"
            y="176"
            width="30"
            height="38"
            rx="3"
            transform="rotate(18 313 195)"
          />
        </g>
        <g fill="#a5bc8c">
          <circle cx="204" cy="99" r="8" />
          <circle cx="229" cy="91" r="7" />
          <circle cx="262" cy="115" r="10" />
          <circle cx="216" cy="139" r="8" />
          <circle cx="467" cy="36" r="9" />
          <circle cx="438" cy="51" r="7" />
        </g>
        <path
          d="M112 107L175 129 219 163 297 104 372 71"
          fill="none"
          stroke="#4f7d60"
          strokeWidth="2.4"
          strokeDasharray="5 5"
        />
        <path
          d="M219 163l37 32 114-80 27-6"
          fill="none"
          stroke="#b98953"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
        <text x="217" y="122" fontSize="8" fill="#7d8d71" letterSpacing="1.5">
          CAMPUS
        </text>
        <g filter="url(#pinshadow)">
          <circle cx="112" cy="107" r="15" fill="#fdfcf7" />
          <circle cx="112" cy="107" r="11" fill="#bd8650" />
          <path
            d="M107 103h10v8h-10zM109 100v4m6-4v4"
            stroke="white"
            fill="none"
            strokeWidth="1.5"
          />
          <circle cx="219" cy="163" r="17" fill="#fcfdf7" />
          <circle cx="219" cy="163" r="13" fill="#365e45" />
          <path
            d="M213 165l6-7 6 7v6h-12z"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
          />
          <circle cx="372" cy="71" r="15" fill="#fffdf6" />
          <circle cx="372" cy="71" r="11" fill="#365e45" />
          <path
            d="M366 73l6-7 6 7v5h-12z"
            fill="none"
            stroke="white"
            strokeWidth="1.3"
          />
          <circle
            cx="397"
            cy="109"
            r="11"
            fill="#bd8650"
            stroke="#fffdf8"
            strokeWidth="4"
          />
        </g>
        <g fontFamily="Arial,sans-serif" fontSize="9" fill="#485446">
          <rect x="64" y="125" width="100" height="21" rx="5" fill="#fffefa" />
          <text x="75" y="139">
            Dining Commons
          </text>
          <rect x="236" y="155" width="119" height="21" rx="5" fill="#fffefa" />
          <text x="245" y="169">
            Spartan Community Pantry
          </text>
          <rect x="310" y="36" width="101" height="21" rx="5" fill="#fffefa" />
          <text x="320" y="50">
            Community Table
          </text>
        </g>
      </svg>
      <div className="map-top">
        <span>
          <span className="live-dot" /> Campus rescue network
        </span>
        <span className="map-compass">
          <Navigation size={12} /> N
        </span>
      </div>
      <div className="map-bottom">
        <span>
          <i className="map-key donor" /> Food source <i className="map-key" />{" "}
          Partner
        </span>
        <button onClick={onMatches}>
          Explore matches <ArrowUpRight size={13} />
        </button>
      </div>
    </div>
  );
}
function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <PackageOpen size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export default function RescueApp() {
  const [state, setState] = useState<State>(seedState);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("Overview");
  const [popup, setPopup] = useState<Popup>(null);
  const [editing, setEditing] = useState<Food | null>(null);
  const [partnerEditing, setPartnerEditing] = useState<Partner | null>(null);
  const [entryTab, setEntryTab] = useState("notes");
  const [partnerTab, setPartnerTab] = useState("details");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [matchTab, setMatchTab] = useState("suggested");
  const [toast, setToast] = useState("");
  const [mobile, setMobile] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [provider, setProvider] = useState(false);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 600px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isStoredState(parsed)) setState(parsed);
        else
          setToast("Saved data could not be read. Sample workspace restored.");
      }
    } catch {
      setStorageError(true);
    }
    setLoaded(true);
    fetch("/api/extract")
      .then((r) => r.json() as Promise<{ configured?: boolean }>)
      .then((d) => setProvider(d.configured === true))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (loaded)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        setStorageError(true);
      }
  }, [state, loaded]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const today = state.foods.filter((f) => f.date === DEMO_DATE);
  const ready = today.filter((f) => f.status === "available");
  const review = today.filter((f) => f.status === "review");
  const reserved = today.filter((f) => f.status === "reserved");
  const active = state.partners.filter((p) => p.active);
  const totals = impact(state.foods);
  const matching = useMemo(
    () => generateMatches(state.foods, state.partners),
    [state.foods, state.partners],
  );
  const filtered = today.filter(
    (f) =>
      (filter === "all" || f.status === filter) &&
      (category === "all" || f.category === category) &&
      `${f.name} ${f.location} ${f.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const notify = (text: string) => setToast(text);
  function navigate(next: View) {
    setView(next);
    setSearch("");
    setFilter("all");
    setCategory("all");
    setMobile(false);
  }
  function runMatching() {
    navigate("Pickup matches");
    setMatchTab("suggested");
    notify(
      `${matching.matches.length} eligible pickup matches found. Review each suggestion before approval.`,
    );
  }
  function approve(match: Match) {
    try {
      setState(approveMatch(state, match));
      notify("Pickup approved. Capacity reserved for this partner.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function collect(id: string) {
    try {
      setState(collectFood(state, id));
      notify("Collection confirmed. Your impact report has been updated.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function cancelPickup(id: string) {
    const f = state.foods.find((x) => x.id === id);
    if (!f || f.status !== "reserved") return;
    setState({
      ...state,
      foods: state.foods.map((x) =>
        x.id === id ? { ...x, status: "available", partnerId: undefined } : x,
      ),
      activity: [
        {
          id: crypto.randomUUID(),
          text: `Pickup cancelled for ${f.name}; capacity released`,
          time: "Just now",
          kind: "review" as const,
        },
        ...state.activity,
      ].slice(0, 60),
    });
    notify("Pickup cancelled. Listing available for a new match.");
  }
  function exportReport() {
    const rows: (string | number)[][] = [
      ["RescueLoop sample workspace — collection report"],
      ["Demo date", DEMO_DATE],
      [
        "Food",
        "Weight (kg)",
        "Estimated meal equivalents (0.5 kg)",
        "Partner",
        "Listing date",
        "Collected at",
      ],
    ];
    for (const f of state.foods.filter((f) => f.status === "collected"))
      rows.push([
        f.name,
        f.kg,
        Math.floor(f.kg / 0.5),
        state.partners.find((p) => p.id === f.partnerId)?.name ||
          "Unknown partner",
        f.date,
        f.collectedAt || "",
      ]);
    rows.push(
      ["Total", totals.kg, totals.meals],
      [
        "Estimates are illustrative. Sample data; no real-world impact claimed.",
      ],
    );
    download("rescueloop-impact.csv", csvExport(rows));
    notify("Impact report downloaded.");
  }
  function saveFood(raw: Partial<Food>) {
    const errors = validateFood(raw);
    if (errors.length) throw new Error(errors.join(" "));
    const food = {
      ...raw,
      id: editing?.id || crypto.randomUUID(),
      date: DEMO_DATE,
      status: raw.verified ? "available" : "review",
    } as Food;
    setState({
      ...state,
      foods: editing
        ? state.foods.map((f) => (f.id === editing.id ? food : f))
        : [food, ...state.foods],
      activity: [
        {
          id: crypto.randomUUID(),
          text: `${editing ? "Reviewed" : "Added"} ${food.name} (${formatKg(food.kg)} kg)`,
          time: "Just now",
          kind: food.verified ? ("listing" as const) : ("review" as const),
        },
        ...state.activity,
      ].slice(0, 60),
    });
    setEditing(null);
    setPopup(null);
    notify(
      food.verified
        ? "Listing verified and available for matching."
        : "Listing saved to the human review queue.",
    );
  }
  function importFoods(text: string) {
    const foods = parseInventoryCSV(text);
    if (state.foods.length + foods.length > 1000)
      throw new Error("Workspace limit: 1,000 food records.");
    setState({ ...state, foods: [...foods, ...state.foods] });
    setPopup(null);
    navigate("Food listings");
    setFilter("review");
    notify(
      `${foods.length} listings imported. Verify handling and allergens before matching.`,
    );
  }
  function savePartner(raw: Partner) {
    const errors = validatePartner(raw);
    if (raw.capacity < usedCapacity(raw.id, state.foods))
      errors.push(
        "Capacity cannot be below already reserved or collected food.",
      );
    if (errors.length) throw new Error(errors.join(" "));
    setState({
      ...state,
      partners: partnerEditing
        ? state.partners.map((p) => (p.id === raw.id ? raw : p))
        : [...state.partners, raw],
    });
    setPopup(null);
    setPartnerEditing(null);
    notify("Partner capacity and receiving preferences saved.");
  }
  const pendingSearch =
    search && view !== "Food listings" && view !== "Partners";
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside
        className={"sidebar " + (mobile ? "mobile-open" : "")}
        inert={narrow && !mobile}
      >
        <div className="sidebar-brand">
          <Logo />
          <button
            className="icon-btn mobile-close"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <button
          className="workspace-picker"
          onClick={() => setPopup("settings")}
        >
          <span className="workspace-icon">
            <Sprout size={19} />
          </span>
          <span>
            <strong>Spartan campus</strong>
            <small>Community workspace</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {NAV.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={"nav-item " + (view === label ? "active" : "")}
              onClick={() => navigate(label)}
              aria-current={view === label ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === "Food listings" && (
                <span className="nav-count">
                  {
                    today.filter((f) =>
                      ["available", "review"].includes(f.status),
                    ).length
                  }
                </span>
              )}
              {label === "Pickup matches" && reserved.length > 0 && (
                <span className="nav-count">{reserved.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mission-card">
            <span className="mission-sprout">
              <Sprout size={30} />
            </span>
            <p>
              A little less waste.
              <br />A lot more possibility.
            </p>
            <span>Every rescue starts with you.</span>
            <div className="mission-art">
              <i />
              <i />
              <i />
            </div>
          </div>
          <button className="sidebar-link" onClick={() => setPopup("guide")}>
            <HelpCircle size={18} />
            How RescueLoop works
            <ArrowUpRight size={14} />
          </button>
          <button className="sidebar-link" onClick={() => setPopup("settings")}>
            <Settings size={18} />
            Workspace settings
          </button>
          <div className="sidebar-signoff">
            <span className="live-dot" />
            Built for a better tomorrow
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell" inert={narrow && mobile}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn menu-toggle"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{view}</strong>
          </div>
          <div className="topbar-right">
            <label className="global-search">
              <Search size={16} />
              <input
                ref={searchRef}
                placeholder="Search your workspace..."
                aria-label="Search your workspace"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>⌘ K</kbd>
            </label>
            <button className="demo-pill" onClick={() => setPopup("settings")}>
              <span className="live-dot" />
              Demo workspace
            </button>
            <button
              className="icon-btn notification"
              aria-label="View recent activity"
              onClick={() => setPopup("activity")}
            >
              <Bell size={19} />
              <span />
            </button>
            <button
              className="avatar"
              aria-label="Open coordinator workspace settings"
              onClick={() => setPopup("settings")}
            >
              SC
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {view === "Overview"
                  ? "SMALL ACTIONS. SHARED IMPACT."
                  : "SPARTAN CAMPUS · DEMO WORKSPACE"}
              </p>
              <h1>
                {view === "Overview" ? (
                  <>
                    Good food. <span>Greater impact.</span>
                  </>
                ) : (
                  view
                )}
              </h1>
              <p className="page-subtitle">
                {view === "Overview"
                  ? "A little coordination. A lot of good. Here’s your campus rescue snapshot."
                  : view === "Food listings"
                    ? "Give surplus food its next chapter. Review, verify, and get it moving."
                    : view === "Pickup matches"
                      ? "The right food, the right partner, and a clear reason for every match."
                      : view === "Partners"
                        ? "Meet the community turning campus surplus into shared possibility."
                        : "Every confirmed pickup adds up. See the difference your campus is making."}
              </p>
            </div>
            <div className="heading-actions">
              {view === "Impact report" ? (
                <button className="btn primary" onClick={exportReport}>
                  <Download size={16} />
                  Export report
                </button>
              ) : view === "Partners" ? (
                <>
                  <button
                    className="btn"
                    onClick={() => {
                      setPartnerTab("csv");
                      setPartnerEditing(null);
                      setPopup("partner");
                    }}
                  >
                    <Upload size={16} />
                    Import capacity
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => {
                      setPartnerTab("details");
                      setPartnerEditing(null);
                      setPopup("partner");
                    }}
                  >
                    <Plus size={17} />
                    Add partner
                  </button>
                </>
              ) : (
                <>
                  <button className="btn" onClick={runMatching}>
                    <Sparkles size={16} />
                    Find matches
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => {
                      setEntryTab("notes");
                      setEditing(null);
                      setPopup("add");
                    }}
                  >
                    <Plus size={18} />
                    Add surplus
                  </button>
                </>
              )}
            </div>
          </div>
          {storageError && (
            <div className="notice warning">
              <AlertTriangle size={17} />
              Browser storage is unavailable. Changes will last for this session
              only.
            </div>
          )}
          {pendingSearch && (
            <section className="search-results panel">
              <div className="section-heading">
                <h2>Search results</h2>
                <button className="text-btn" onClick={() => setSearch("")}>
                  Clear search <X size={14} />
                </button>
              </div>
              {state.foods
                .filter((f) =>
                  `${f.name} ${f.location}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .slice(0, 8)
                .map((f) => (
                  <button
                    className="search-result"
                    key={f.id}
                    onClick={() => {
                      if (f.date !== DEMO_DATE) {
                        navigate("Impact report");
                      } else {
                        navigate("Food listings");
                        setSearch(f.name);
                      }
                    }}
                  >
                    <FoodArt food={f} />
                    <span>
                      <strong>{f.name}</strong>
                      <small>
                        {f.location} · {formatKg(f.kg)} kg
                      </small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ))}
              {!state.foods.some((f) =>
                `${f.name} ${f.location}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              ) && (
                <p className="muted">
                  No food listings match “{search}”. Try a food name or pickup
                  location.
                </p>
              )}
            </section>
          )}
          {view === "Overview" && (
            <>
              <div className="overview-meta">
                <span>
                  <span className="live-dot" /> Your community at a glance
                </span>
                <span>
                  <CalendarDays size={14} />
                  Friday, October 23, 2026 <span className="meta-divider" />
                  Demo day · {timeLabel(DEMO_TIME)}
                </span>
              </div>
              <section
                className="stats-grid"
                aria-label="Impact and availability"
              >
                <Stat
                  icon={<Scale size={19} />}
                  label="Food rescued"
                  value={formatKg(totals.kg)}
                  unit="kg"
                  note="From confirmed collections"
                  color="green"
                  spark="M0 28L10 24 20 26 30 17 40 19 50 10 60 13 70 3"
                />
                <Stat
                  icon={<Utensils size={19} />}
                  label="Meals made possible"
                  value={String(totals.meals)}
                  note="Estimated meal equivalents"
                  color="orange"
                  spark="M0 27L10 27 20 21 30 23 40 15 50 17 60 9 70 3"
                />
                <Stat
                  icon={<PackageOpen size={19} />}
                  label="Available to rescue"
                  value={formatKg(ready.reduce((n, f) => n + f.kg, 0))}
                  unit="kg"
                  note={`${ready.length} verified listings ready to match`}
                  color="yellow"
                />
                <Stat
                  icon={<Users size={19} />}
                  label="Community partners"
                  value={String(active.length).padStart(2, "0")}
                  note={`${formatKg(active.reduce((n, p) => n + Math.max(0, p.capacity - usedCapacity(p.id, state.foods)), 0))} kg receiving capacity available`}
                  color="purple"
                />
              </section>
              <section className="hero-grid">
                <div className="rescue-hero">
                  <div className="hero-content">
                    <span className="hero-kicker">
                      <span className="live-dot" />
                      GOOD FOOD SHOULDN’T GO TO WASTE
                    </span>
                    <h2>
                      Surplus today.
                      <br />
                      <em>Someone’s meal tomorrow.</em>
                    </h2>
                    <p>
                      {ready.length} food listings are ready for their next
                      stop.
                      <br />
                      Let’s connect them with your community.
                    </p>
                    <button className="btn light" onClick={runMatching}>
                      Find pickup matches
                      <ArrowUpRight size={17} />
                    </button>
                    <span className="hero-footnote">
                      <ShieldCheck size={14} />
                      Transparent suggestions. You make the call.
                    </span>
                  </div>
                  <div className="hero-illustration" aria-hidden="true">
                    <svg viewBox="0 0 260 260">
                      <circle
                        cx="140"
                        cy="129"
                        r="101"
                        fill="#477156"
                        opacity=".4"
                      />
                      <circle
                        cx="140"
                        cy="129"
                        r="76"
                        fill="none"
                        stroke="#83a773"
                        strokeDasharray="4 7"
                        opacity=".55"
                      />
                      <path
                        d="M55 162L72 94h140l-16 88-87 16z"
                        fill="#c09862"
                      />
                      <path d="M72 94l48 21 92-21-47-20z" fill="#dfbc86" />
                      <path d="M120 115l-11 83 87-16 16-88z" fill="#d1ac78" />
                      <path
                        d="M72 94l-25 21 44 22 29-22m0 0 20 20 91-25-19-16"
                        fill="#e8cc9f"
                      />
                      <path
                        d="M109 91c-15-16-25-38-14-48 14 3 21 27 14 48"
                        fill="#92ac68"
                      />
                      <path
                        d="M110 90c8-26 24-35 34-28-1 15-18 26-34 28"
                        fill="#c1ce8d"
                      />
                      <path
                        d="M96 87c-7-20-20-27-27-17 1 15 17 20 27 17"
                        fill="#74965e"
                      />
                      <path
                        d="M162 91c-1-29 10-43 24-38 9 14-5 33-24 38"
                        fill="#d7a96b"
                      />
                      <path
                        d="M169 78l12-12m-15 5 11-12"
                        stroke="#ebcd9e"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                      <circle cx="140" cy="91" r="20" fill="#df8d57" />
                      <path
                        d="M139 73c-3-15 8-23 16-20-1 12-6 18-16 20"
                        fill="#a4b77c"
                      />
                      <path
                        d="M155 146c13-11 25 3 12 13l-13 10-12-12c-10-12 3-23 13-11"
                        fill="#f2e6c9"
                      />
                      <path
                        d="M40 53c-6-5-5-12 0-15 8 0 10 11 0 15m177 128c-6-5-5-12 0-15 8 0 10 11 0 15"
                        fill="#b1c88d"
                      />
                      <path
                        d="M41 41l7-6m168 140 10-5"
                        stroke="#b1c88d"
                        strokeWidth="2"
                      />
                      <path
                        d="M53 197c18 10 29 10 42 6m89-153c-14-8-22-8-32-5"
                        stroke="#99b981"
                        fill="none"
                        strokeWidth="2"
                      />
                      <path
                        d="M87 198l9 5-6 8m70-173-9 7 9 4"
                        stroke="#99b981"
                        fill="none"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                </div>
                <CampusMap onMatches={runMatching} />
              </section>
              <div className="dashboard-columns">
                <section className="panel listings-panel">
                  <div className="section-heading">
                    <div className="section-title">
                      <h2>Ready for a second helping</h2>
                      <span className="count-pill">{ready.length}</span>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => navigate("Food listings")}
                    >
                      View all listings
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="section-description">
                    Fresh opportunities to make a difference.
                  </div>
                  <div className="food-list">
                    {ready.slice(0, 3).map((f) => (
                      <FoodRow
                        key={f.id}
                        food={f}
                        action={() => {
                          navigate("Pickup matches");
                          setMatchTab("suggested");
                        }}
                      />
                    ))}
                    {!ready.length && (
                      <Empty
                        title="Every listing has a next step"
                        text="Add surplus to start another rescue."
                        action={
                          <button
                            className="btn"
                            onClick={() => setPopup("add")}
                          >
                            Add surplus
                          </button>
                        }
                      />
                    )}
                  </div>
                  <div className="panel-foot">
                    <span className="mini-icon">
                      <Clock size={14} />
                    </span>
                    <span>
                      Food with the earliest pickup deadline gets priority.
                    </span>
                  </div>
                </section>
                <section className="panel action-panel">
                  <div className="section-heading">
                    <h2>A little attention goes a long way</h2>
                    <span className="small-icon peach">
                      <Sparkles size={16} />
                    </span>
                  </div>
                  <button
                    className="attention-item"
                    onClick={() => {
                      navigate("Food listings");
                      setFilter("review");
                    }}
                  >
                    <span className="attention-icon amber">
                      <AlertTriangle size={19} />
                    </span>
                    <span>
                      <strong>
                        {review.length} listing{review.length !== 1 ? "s" : ""}{" "}
                        need{review.length === 1 ? "s" : ""} a human check
                      </strong>
                      <small>Verify details before it can be matched.</small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                  <button className="attention-item" onClick={runMatching}>
                    <span className="attention-icon sage">
                      <GitCompareArrows size={20} />
                    </span>
                    <span>
                      <strong>
                        {matching.matches.length} pickup matches to explore
                      </strong>
                      <small>
                        Good fits, with the reasons to back them up.
                      </small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                  <div className="trust-note">
                    <ShieldCheck size={17} />
                    <p>
                      <strong>AI assists. People decide.</strong>
                      <span>
                        People verify listings. Coordinators approve every
                        pickup.
                      </span>
                    </p>
                    <button
                      className="icon-btn"
                      aria-label="Read our responsible AI approach"
                      onClick={() => setPopup("methodology")}
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                </section>
              </div>
              <div className="dashboard-columns lower">
                <section className="panel partner-preview">
                  <div className="section-heading">
                    <h2>Your community in the loop</h2>
                    <button
                      className="text-btn"
                      onClick={() => navigate("Partners")}
                    >
                      All partners
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="partner-mini-grid">
                    {state.partners.slice(0, 3).map((p) => (
                      <button
                        key={p.id}
                        className="partner-mini"
                        onClick={() => {
                          setPartnerEditing(p);
                          setPopup("partner");
                        }}
                      >
                        <span className={"partner-avatar " + p.color}>
                          {p.initials}
                        </span>
                        <strong>{p.name}</strong>
                        <small>
                          <span
                            className={
                              "live-dot " + (!p.active ? "paused" : "")
                            }
                          />
                          {p.active
                            ? `${formatKg(Math.max(0, p.capacity - usedCapacity(p.id, state.foods)))} kg available`
                            : "Receiving paused"}
                        </small>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="panel activity-preview">
                  <div className="section-heading">
                    <h2>Little wins, lately</h2>
                    <button
                      className="text-btn"
                      onClick={() => setPopup("activity")}
                    >
                      Activity
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  {state.activity.slice(0, 2).map((a) => (
                    <div className="activity-item" key={a.id}>
                      <span className={"activity-dot " + a.kind} />
                      <p>
                        {a.text}
                        <small>
                          {a.time === "Just now" ? a.time : timeLabel(a.time)}
                        </small>
                      </p>
                    </div>
                  ))}
                </section>
              </div>
            </>
          )}
          {view === "Food listings" && (
            <>
              <div className="list-toolbar">
                <div
                  className="tabs"
                  role="group"
                  aria-label="Filter food listings"
                >
                  {[
                    ["all", "All listings"],
                    ["available", "Available"],
                    ["review", "Needs review"],
                    ["reserved", "Approved"],
                    ["collected", "Collected"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      className={filter === key ? "selected" : ""}
                      onClick={() => setFilter(key)}
                    >
                      {label}
                      <span>
                        {key === "all"
                          ? today.length
                          : today.filter((f) => f.status === key).length}
                      </span>
                    </button>
                  ))}
                </div>
                <label className="filter-select">
                  <SlidersHorizontal size={15} />
                  <select
                    aria-label="Filter by food category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="all">All categories</option>
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="notice">
                <Info size={17} />
                <span>
                  Demo day: October 23 · {timeLabel(DEMO_TIME)}. All locations
                  and inventory are illustrative. Imported food starts in the
                  review queue.
                </span>
                <button
                  onClick={() => {
                    setEntryTab("csv");
                    setEditing(null);
                    setPopup("add");
                  }}
                >
                  Import CSV
                  <Upload size={14} />
                </button>
              </div>
              <section className="panel full-list">
                <div className="section-heading">
                  <h2>
                    {filter === "all"
                      ? "Campus surplus"
                      : filter === "review"
                        ? "Human review queue"
                        : `${filter === "reserved" ? "Approved pickup" : STATUS_LABEL[filter as keyof typeof STATUS_LABEL]} listings`}
                  </h2>
                  <span className="muted small">
                    {filtered.length} listing{filtered.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="table-header">
                  <span>FOOD & PICKUP LOCATION</span>
                  <span>QUANTITY</span>
                  <span>PICKUP WINDOW</span>
                  <span>STATUS</span>
                  <span />
                </div>
                {filtered.map((f) => (
                  <FoodRow
                    key={f.id}
                    food={f}
                    expanded
                    action={() => {
                      if (f.status === "reserved") {
                        navigate("Pickup matches");
                        setMatchTab("approved");
                      } else if (f.status === "collected") {
                        navigate("Impact report");
                      } else {
                        setEditing(f);
                        setPopup("add");
                      }
                    }}
                  />
                ))}
                {!filtered.length && (
                  <Empty
                    title="No listings here yet"
                    text="Try another filter or add surplus food to your campus workspace."
                    action={
                      <button
                        className="btn primary"
                        onClick={() => setPopup("add")}
                      >
                        <Plus size={15} />
                        Add surplus
                      </button>
                    }
                  />
                )}
              </section>
            </>
          )}
          {view === "Pickup matches" && (
            <>
              <div className="matching-banner">
                <span className="matching-icon">
                  <GitCompareArrows size={25} />
                </span>
                <div>
                  <h3>Thoughtful matches. Clear reasons.</h3>
                  <p>
                    Earliest deadline first, then the closest eligible partner.
                    Capacity, storage, diets, and pickup windows are always
                    checked.
                  </p>
                </div>
                <button
                  className="text-btn"
                  onClick={() => setPopup("methodology")}
                >
                  See the rules
                  <ArrowUpRight size={15} />
                </button>
              </div>
              <div className="list-toolbar">
                <div className="tabs">
                  <button
                    className={matchTab === "suggested" ? "selected" : ""}
                    onClick={() => setMatchTab("suggested")}
                  >
                    Suggested matches<span>{matching.matches.length}</span>
                  </button>
                  <button
                    className={matchTab === "approved" ? "selected" : ""}
                    onClick={() => setMatchTab("approved")}
                  >
                    Approved pickups<span>{reserved.length}</span>
                  </button>
                  <button
                    className={matchTab === "unmatched" ? "selected" : ""}
                    onClick={() => setMatchTab("unmatched")}
                  >
                    Needs attention<span>{matching.unmatched.length}</span>
                  </button>
                </div>
                <span className="small muted">
                  <ShieldCheck size={14} />
                  Human approval required
                </span>
              </div>
              {matchTab === "suggested" && (
                <div className="match-grid">
                  {matching.matches.map((m, i) => {
                    const f = state.foods.find((f) => f.id === m.foodId)!;
                    const p = state.partners.find((p) => p.id === m.partnerId)!;
                    return (
                      <article className="panel match-card" key={m.foodId}>
                        <div className="match-card-top">
                          <Badge tone={i === 0 ? "orange" : "green"}>
                            {i === 0 ? "Earliest pickup" : "Eligible match"}
                          </Badge>
                          <span className="small muted">
                            {formatKg(m.distance)} km · illustrative
                          </span>
                        </div>
                        <div className="match-food">
                          <FoodArt food={f} />
                          <div>
                            <h3>{f.name}</h3>
                            <span>
                              {formatKg(f.kg)} kg · {f.location}
                            </span>
                          </div>
                        </div>
                        <div className="match-connection">
                          <span />
                          <ArrowRight size={16} />
                          <span />
                        </div>
                        <div className="match-partner">
                          <span className={"partner-avatar " + p.color}>
                            {p.initials}
                          </span>
                          <div>
                            <h3>{p.name}</h3>
                            <span>{p.description}</span>
                          </div>
                        </div>
                        <div className="match-reasons">
                          <p>WHY THIS MATCH WORKS</p>
                          {m.reasons.map((r) => (
                            <span key={r}>
                              <Check size={14} />
                              {r}
                            </span>
                          ))}
                        </div>
                        <div className="match-actions">
                          <span>
                            <Clock size={15} />
                            {timeLabel(f.start)}–{timeLabel(f.end)}
                          </span>
                          <button
                            className="btn primary"
                            onClick={() => approve(m)}
                          >
                            Approve pickup
                            <Check size={15} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                  {!matching.matches.length && (
                    <Empty
                      title="You’re all caught up"
                      text="Add or verify a listing, or check partner availability to find more matches."
                      action={
                        <button
                          className="btn"
                          onClick={() => navigate("Food listings")}
                        >
                          Review food listings
                          <ArrowRight size={15} />
                        </button>
                      }
                    />
                  )}
                </div>
              )}
              {matchTab === "approved" && (
                <section className="panel">
                  <div className="section-heading">
                    <h2>Ready to get moving</h2>
                    <span className="muted small">
                      Capacity is reserved until collection or cancellation
                    </span>
                  </div>
                  {reserved.map((f) => (
                    <div className="pickup-row" key={f.id}>
                      <FoodArt food={f} />
                      <div>
                        <h3>
                          {f.name}
                          <span className="muted"> · {formatKg(f.kg)} kg</span>
                        </h3>
                        <p>
                          {f.location}
                          <ArrowRight size={13} />
                          {
                            state.partners.find((p) => p.id === f.partnerId)
                              ?.name
                          }
                        </p>
                        <small>
                          <Clock size={13} />
                          {timeLabel(f.start)}–{timeLabel(f.end)} · {f.storage}{" "}
                          · allergens: {f.allergens}
                        </small>
                      </div>
                      <div className="pickup-actions">
                        <button
                          className="btn primary"
                          onClick={() => collect(f.id)}
                        >
                          <CheckCheck size={16} />
                          Confirm collection
                        </button>
                        <button
                          className="text-btn muted"
                          onClick={() => cancelPickup(f.id)}
                        >
                          Cancel pickup
                        </button>
                      </div>
                    </div>
                  ))}
                  {!reserved.length && (
                    <Empty
                      title="No approved pickups yet"
                      text="Review a suggested match to reserve a partner’s receiving capacity."
                      action={
                        <button
                          className="btn"
                          onClick={() => setMatchTab("suggested")}
                        >
                          Explore suggestions
                        </button>
                      }
                    />
                  )}
                </section>
              )}
              {matchTab === "unmatched" && (
                <section className="panel">
                  <div className="section-heading">
                    <h2>A little coordination needed</h2>
                  </div>
                  {matching.unmatched.map((u) => {
                    const f = state.foods.find((f) => f.id === u.foodId)!;
                    return (
                      <div className="unmatched-row" key={u.foodId}>
                        <FoodArt food={f} />
                        <div>
                          <h3>{f.name}</h3>
                          <p>{u.reasons.join(" · ")}</p>
                        </div>
                        <button
                          className="btn"
                          onClick={() => {
                            setEditing(f);
                            setPopup("add");
                          }}
                        >
                          Review listing
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    );
                  })}
                  {!matching.unmatched.length && (
                    <Empty
                      title="Everything has a next step"
                      text="All current listings can be matched or have already been approved."
                    />
                  )}
                </section>
              )}
            </>
          )}
          {view === "Partners" && (
            <>
              <div className="notice">
                <Users size={17} />
                <span>
                  Sample community network. Capacity is reserved on approval and
                  stays used after collection for this demo day.
                </span>
              </div>
              <div className="partner-grid">
                {state.partners
                  .filter((p) =>
                    `${p.name} ${p.description}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((p) => {
                    const used = usedCapacity(p.id, state.foods);
                    return (
                      <article className="panel partner-card" key={p.id}>
                        <div className="partner-top">
                          <span className={"partner-avatar large " + p.color}>
                            {p.initials}
                          </span>
                          <Badge tone={p.active ? "green" : "gray"}>
                            {p.active ? "Receiving today" : "Paused"}
                          </Badge>
                        </div>
                        <h2>{p.name}</h2>
                        <p>{p.description}</p>
                        <div className="capacity-label">
                          <span>Receiving capacity</span>
                          <strong>
                            {formatKg(Math.max(0, p.capacity - used))}
                            <small>
                              {" "}
                              / {formatKg(p.capacity)} kg available
                            </small>
                          </strong>
                        </div>
                        <div className="capacity-track">
                          <span
                            style={{
                              width: `${Math.min(100, (used / p.capacity) * 100)}%`,
                            }}
                          />
                        </div>
                        <div className="partner-details">
                          <span>
                            <Clock size={15} />
                            {timeLabel(p.start)}–{timeLabel(p.end)}
                          </span>
                          <span>
                            <MapPin size={15} />
                            {formatKg(p.distance)} km from campus · sample
                          </span>
                          <span>
                            <PackageOpen size={15} />
                            {p.storage.join(", ")} storage
                          </span>
                        </div>
                        <div className="tags">
                          {p.categories.map((c) => (
                            <span key={c}>{c}</span>
                          ))}
                          {p.requiredDiet && (
                            <span className="diet">
                              {p.requiredDiet} required
                            </span>
                          )}
                        </div>
                        <p className="allergen-note">
                          Restricted allergens:{" "}
                          {p.excludedAllergens.join(", ") || "none specified"}
                        </p>
                        <button
                          className="btn full"
                          onClick={() => {
                            setPartnerEditing(p);
                            setPopup("partner");
                          }}
                        >
                          Manage partner
                          <ArrowUpRight size={16} />
                        </button>
                      </article>
                    );
                  })}
              </div>
            </>
          )}
          {view === "Impact report" && (
            <>
              <div className="impact-banner">
                <span className="impact-leaf">
                  <Leaf size={37} />
                </span>
                <div>
                  <p className="eyebrow">GOOD THINGS ADD UP</p>
                  <h2>{formatKg(totals.kg)} kg with a better destination.</h2>
                  <p>
                    Confirmed collections from your sample campus workspace,
                    October 19–23.
                  </p>
                </div>
                <button className="btn" onClick={() => setPopup("methodology")}>
                  <Info size={16} />
                  How we measure
                </button>
              </div>
              <section className="stats-grid impact-stats">
                <Stat
                  icon={<Scale size={19} />}
                  label="Food diverted"
                  value={formatKg(totals.kg)}
                  unit="kg"
                  note="Confirmed collected weight"
                  color="green"
                />
                <Stat
                  icon={<Utensils size={19} />}
                  label="Meal equivalents"
                  value={String(totals.meals)}
                  note="Estimate · 0.5 kg per meal"
                  color="orange"
                />
                <Stat
                  icon={<Truck size={19} />}
                  label="Completed rescues"
                  value={String(totals.pickups).padStart(2, "0")}
                  note="Every pickup confirmed by a person"
                  color="yellow"
                />
                <Stat
                  icon={<Leaf size={19} />}
                  label="Rescued on demo day"
                  value={formatKg(totals.today)}
                  unit="kg"
                  note="October 23 confirmed collections"
                  color="purple"
                />
              </section>
              <div className="impact-columns">
                <section className="panel chart-panel">
                  <div className="section-heading">
                    <h2>A week of second chances</h2>
                    <span className="chart-legend">
                      <i />
                      Food rescued (kg)
                    </span>
                  </div>
                  <div className="bar-chart">
                    {[19, 20, 21, 22, 23].map((day) => {
                      const kg = state.foods
                        .filter(
                          (f) =>
                            f.status === "collected" &&
                            f.date === `2026-10-${day}`,
                        )
                        .reduce((n, f) => n + f.kg, 0);
                      const max = Math.max(
                        50,
                        ...[19, 20, 21, 22, 23].map((d) =>
                          state.foods
                            .filter(
                              (f) =>
                                f.status === "collected" &&
                                f.date === `2026-10-${d}`,
                            )
                            .reduce((n, f) => n + f.kg, 0),
                        ),
                      );
                      return (
                        <div
                          className={
                            "bar-column " + (day === 23 ? "current" : "")
                          }
                          key={day}
                        >
                          <strong>
                            {formatKg(kg)}
                            <small> kg</small>
                          </strong>
                          <div className="bar-area">
                            <div
                              style={{
                                height: `${Math.max(2, (kg / max) * 100)}%`,
                              }}
                            />
                          </div>
                          <span>Oct {day}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
                <section className="panel methodology-card">
                  <span className="small-icon sage">
                    <ShieldCheck size={21} />
                  </span>
                  <h2>Impact you can trace.</h2>
                  <p>
                    Only collected food counts toward rescue totals. Suggestions
                    and approvals stay out of the calculation until collection
                    is confirmed.
                  </p>
                  <div className="formula">
                    <strong>Collected kg ÷ 0.5</strong>
                    <span>= estimated meal equivalents</span>
                  </div>
                  <p className="small">
                    The 0.5 kg serving assumption is illustrative and
                    configurable in a production version. No carbon savings are
                    claimed.
                  </p>
                  <button
                    className="text-btn"
                    onClick={() => setPopup("methodology")}
                  >
                    Read measurement notes
                    <ArrowUpRight size={15} />
                  </button>
                </section>
              </div>
              <section className="panel collection-log">
                <div className="section-heading">
                  <h2>The rescue record</h2>
                  <button className="text-btn" onClick={exportReport}>
                    <Download size={15} />
                    Download CSV
                  </button>
                </div>
                <div className="log-table">
                  <table>
                    <thead>
                      <tr>
                        <th>FOOD RESCUED</th>
                        <th>PARTNER</th>
                        <th>DATE</th>
                        <th>WEIGHT</th>
                        <th>EST. MEALS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.foods
                        .filter((f) => f.status === "collected")
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((f) => (
                          <tr key={f.id}>
                            <td>
                              <CheckCircle2 size={15} />
                              {f.name}
                            </td>
                            <td>
                              {
                                state.partners.find((p) => p.id === f.partnerId)
                                  ?.name
                              }
                            </td>
                            <td>Oct {Number(f.date.slice(-2))}</td>
                            <td>
                              <strong>{formatKg(f.kg)} kg</strong>
                            </td>
                            <td>{Math.floor(f.kg / 0.5)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          <footer className="page-footer">
            <span>
              <Leaf size={13} />
              Good food belongs in the community.
            </span>
            <span>
              Illustrative data · Stored in this browser{" "}
              <span className="footer-dot">·</span>
              <button onClick={() => setPopup("methodology")}>
                Responsible by design
                <ArrowUpRight size={12} />
              </button>
            </span>
          </footer>
        </main>
      </div>
      {(popup === "add" || editing) && (
        <Modal
          title={
            editing ? "Review surplus listing" : "A second chance for good food"
          }
          eyebrow={editing ? "HUMAN VERIFICATION" : "ADD CAMPUS SURPLUS"}
          onClose={() => {
            setPopup(null);
            setEditing(null);
          }}
          wide
        >
          <FoodEditor
            existing={editing}
            provider={provider}
            initialTab={entryTab}
            onSave={saveFood}
            onImport={importFoods}
          />
        </Modal>
      )}
      {popup === "partner" && (
        <Modal
          title={
            partnerEditing
              ? "Keep your partner in the loop"
              : "Grow your rescue network"
          }
          eyebrow="PARTNER CAPACITY"
          onClose={() => {
            setPopup(null);
            setPartnerEditing(null);
          }}
          wide
        >
          <PartnerEditor
            existing={partnerEditing}
            initialTab={partnerTab}
            onSave={savePartner}
            onImport={(text) => {
              const partners = parsePartnersCSV(text);
              if (state.partners.length + partners.length > 200)
                throw new Error("Workspace limit: 200 partners.");
              setState({
                ...state,
                partners: [...state.partners, ...partners],
              });
              setPopup(null);
              notify(`${partners.length} partners imported.`);
            }}
          />
        </Modal>
      )}
      {popup === "activity" && (
        <Modal
          title="Little wins, lately"
          eyebrow="WORKSPACE ACTIVITY"
          onClose={() => setPopup(null)}
        >
          <div className="activity-modal">
            {state.activity.map((a) => (
              <div className="activity-item" key={a.id}>
                <span className={"activity-dot " + a.kind} />
                <p>
                  {a.text}
                  <small>
                    {a.time === "Just now" ? a.time : timeLabel(a.time)}
                  </small>
                </p>
              </div>
            ))}
          </div>
          <p className="modal-note">
            Activity is local to this browser’s sample workspace.
          </p>
        </Modal>
      )}
      {popup === "guide" && (
        <Modal
          title="From surplus to shared possibility"
          eyebrow="HOW RESCUELOOP WORKS"
          onClose={() => setPopup(null)}
        >
          <div className="guide-steps">
            {[
              {
                title: "Share what’s left",
                text: "Paste a dining note, enter a listing, or upload a CSV. AI drafts structured details when watsonx.ai is connected.",
                icon: PackageOpen,
              },
              {
                title: "Give it a human check",
                text: "Verify the actual food, storage, quantity, dietary claims, allergens, and pickup window with the donor.",
                icon: ShieldCheck,
              },
              {
                title: "Make a thoughtful connection",
                text: "Review eligible partners and the reasons for each match. Approve a pickup to reserve receiving capacity.",
                icon: GitCompareArrows,
              },
              {
                title: "Close the loop",
                text: "Confirm collection when the handoff actually happens. Rescued weight and estimated meals update together.",
                icon: CheckCheck,
              },
            ].map((s, i) => (
              <div className="guide-step" key={s.title}>
                <span>{i + 1}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
                <s.icon size={21} />
              </div>
            ))}
          </div>
          <button
            className="btn primary full"
            onClick={() => {
              setPopup("add");
              setEditing(null);
            }}
          >
            Start a rescue
            <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {popup === "methodology" && (
        <Modal
          title="Responsible, from the first step"
          eyebrow="TRANSPARENCY & MEASUREMENT"
          onClose={() => setPopup(null)}
          wide
        >
          <div className="methodology-grid">
            <div>
              <ShieldCheck size={24} />
              <h3>Human verification comes first</h3>
              <p>
                AI extracts facts from a note. It never certifies food safety or
                decides who deserves food. Unknown allergens and unverified
                handling block matching. The donor and coordinator verify
                details against their organization’s food handling policies.
              </p>
            </div>
            <div>
              <GitCompareArrows size={24} />
              <h3>Rules you can inspect</h3>
              <p>
                We process verified batches by earliest pickup deadline, then
                choose the nearest eligible partner. A match requires at least
                15 minutes of overlap, enough remaining capacity, compatible
                storage, accepted food categories, and matching declared dietary
                and allergen constraints. Batches are kept whole.
              </p>
            </div>
            <div>
              <Scale size={24} />
              <h3>Measured after collection</h3>
              <p>
                Rescued weight is the sum of confirmed collected batches. Meal
                equivalents = total collected kg ÷ 0.5, rounded down. This is an
                illustrative portion assumption. We do not estimate emissions
                without a validated methodology.
              </p>
            </div>
            <div>
              <Sparkles size={24} />
              <h3>Know what’s running</h3>
              <p>
                {provider
                  ? "IBM watsonx.ai extraction is configured. Notes are sent to the configured IBM model for a structured draft."
                  : "This workspace uses an offline rule-based note parser. No live model inference is claimed. IBM watsonx.ai can be enabled with server environment variables."}{" "}
                All drafts require review; model output is treated as untrusted.
              </p>
            </div>
          </div>
          <div className="notice">
            <Info size={18} />
            <span>
              Prototype limits: sample partners and distances; fixed demo clock
              at 2:30 PM on October 23, 2026; browser-local records; no dispatch
              messages or shared multi-user reservations. Every displayed rescue
              is illustrative.
            </span>
          </div>
          <p className="modal-note">
            Built for the{" "}
            <a
              href="https://sparthillhack2026.vercel.app/about"
              target="_blank"
              rel="noreferrer"
            >
              SpartHill Hacks IBM AI Challenge
              <ExternalLink size={12} />
            </a>
            . Records stay in this browser; only notes submitted to live
            extraction are sent to IBM.
          </p>
        </Modal>
      )}
      {popup === "settings" && (
        <Modal
          title="Your campus, connected"
          eyebrow="WORKSPACE SETTINGS"
          onClose={() => setPopup(null)}
        >
          <div className="workspace-profile">
            <span className="workspace-icon">
              <Sprout size={28} />
            </span>
            <div>
              <h3>Spartan campus</h3>
              <p>Sample community workspace</p>
            </div>
            <Badge>Demo</Badge>
          </div>
          <dl className="settings-list">
            <div>
              <dt>Coordinator</dt>
              <dd>Sample coordinator</dd>
            </div>
            <div>
              <dt>Demo day & clock</dt>
              <dd>Oct 23, 2026 · 2:30 PM Pacific</dd>
            </div>
            <div>
              <dt>Records</dt>
              <dd>This browser only</dd>
            </div>
            <div>
              <dt>Note extraction</dt>
              <dd>
                {provider
                  ? "IBM watsonx.ai configured"
                  : "Offline rule-based parser"}
              </dd>
            </div>
            <div>
              <dt>Meal estimate</dt>
              <dd>0.5 kg per meal equivalent</dd>
            </div>
          </dl>
          <div className="notice">
            <Info size={17} />
            <span>
              This prototype uses fictional inventory and community partners. No
              real pickups or messages are sent.
            </span>
          </div>
          <button className="btn full" onClick={exportReport}>
            <Download size={16} />
            Export collected-food report
          </button>
          <ResetWorkspace
            onReset={() => {
              setState(seedState());
              setSearch("");
              setPopup(null);
              navigate("Overview");
              notify("Sample workspace restored. Ready for a fresh demo.");
            }}
          />
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          <span>{toast}</span>
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export function Stat({
  icon,
  label,
  value,
  unit,
  note,
  color,
  spark,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  note: string;
  color: string;
  spark?: string;
}) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={"small-icon " + color}>{icon}</span>
      </div>
      <div className="stat-value">
        {value}
        <small>{unit}</small>
        {spark && (
          <svg
            className={"sparkline " + color}
            viewBox="0 0 72 34"
            aria-hidden="true"
          >
            <path
              d={spark}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <p>
        {spark && <ArrowUp size={12} />} {note}
      </p>
    </article>
  );
}
function FoodRow({
  food: f,
  action,
  expanded = false,
}: {
  food: Food;
  action: () => void;
  expanded?: boolean;
}) {
  return (
    <div className={"food-row " + (expanded ? "expanded" : "")}>
      <div className="food-main">
        <FoodArt food={f} />
        <div>
          <h3>{f.name}</h3>
          <span>
            <MapPin size={12} />
            {f.location}
            {!expanded && (
              <>
                <i /> {formatKg(f.kg)} kg
              </>
            )}
          </span>
          {expanded && (
            <div className="food-detail-tags">
              <span>{f.storage}</span>
              {f.diet.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      {expanded && (
        <strong className="food-quantity">
          {formatKg(f.kg)}
          <small> kg</small>
        </strong>
      )}
      <div className="food-window">
        <span>
          <Clock size={13} />
          {timeLabel(f.start)}–{timeLabel(f.end)}
        </span>
        {!expanded && (
          <Badge
            tone={
              f.status === "review"
                ? "orange"
                : f.status === "reserved"
                  ? "purple"
                  : f.status === "collected"
                    ? "gray"
                    : "green"
            }
          >
            {STATUS_LABEL[f.status]}
          </Badge>
        )}
      </div>
      {expanded && (
        <Badge
          tone={
            f.status === "review"
              ? "orange"
              : f.status === "reserved"
                ? "purple"
                : f.status === "collected"
                  ? "gray"
                  : "green"
          }
        >
          {STATUS_LABEL[f.status]}
        </Badge>
      )}
      <button
        className={expanded ? "btn compact" : "row-arrow"}
        aria-label={`${f.status === "review" ? "Review" : f.status === "available" ? "View" : "Open"} ${f.name}`}
        onClick={action}
      >
        {expanded ? (
          f.status === "review" ? (
            "Review"
          ) : f.status === "available" ? (
            "View details"
          ) : f.status === "reserved" ? (
            "View pickup"
          ) : (
            "View impact"
          )
        ) : (
          <ArrowUpRight size={19} />
        )}
      </button>
    </div>
  );
}
function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function FoodEditor({
  existing,
  provider,
  initialTab,
  onSave,
  onImport,
}: {
  existing: Food | null;
  provider: boolean;
  initialTab: string;
  onSave: (f: Partial<Food>) => void;
  onImport: (text: string) => void;
}) {
  const [tab, setTab] = useState(existing ? "manual" : initialTab);
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<Partial<Food>>(
    existing || {
      name: "",
      kg: undefined,
      category: "Prepared meals",
      location: "",
      start: "15:00",
      end: "17:00",
      storage: "Chilled",
      diet: [],
      allergens: "unknown",
      verified: false,
    },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [extracted, setExtracted] = useState("");
  const [csv, setCsv] = useState("");
  function change<K extends keyof Food>(key: K, value: Food[K]) {
    setDraft((d) => ({
      ...d,
      [key]: value,
      ...(key !== "verified" ? { verified: false } : {}),
    }));
    setError("");
  }
  async function extract() {
    if (!note.trim()) {
      setError("Paste a food note to structure first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      let result: Partial<Food>;
      if (provider) {
        const response = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        });
        const data = (await response.json()) as {
          draft: Partial<Food>;
          error?: string;
        };
        if (!response.ok)
          throw new Error(
            data.error || "Extraction unavailable. Try the manual entry tab.",
          );
        result = data.draft;
        setExtracted(
          "Draft extracted by IBM watsonx.ai. Confirm every field against the original note.",
        );
      } else {
        result = parseNote(note);
        setExtracted(
          "Draft structured by the offline rule-based parser. Fill missing fields and verify against the note.",
        );
      }
      setDraft({ ...result, verified: false });
      setTab("manual");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function save(e: FormEvent) {
    e.preventDefault();
    try {
      onSave(draft);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="editor">
      <p className="editor-intro">
        {existing
          ? "Check the source details with the donor. A verified listing becomes eligible for pickup matching."
          : "Turn a quick dining note into a reviewed listing. Keep good food in the loop."}
      </p>
      {!existing && (
        <div className="tabs editor-tabs">
          <button
            className={tab === "notes" ? "selected" : ""}
            onClick={() => {
              setTab("notes");
              setError("");
            }}
          >
            <Sparkles size={15} />
            From a note
          </button>
          <button
            className={tab === "manual" ? "selected" : ""}
            onClick={() => {
              setTab("manual");
              setError("");
            }}
          >
            <FileText size={15} />
            Enter details
          </button>
          <button
            className={tab === "csv" ? "selected" : ""}
            onClick={() => {
              setTab("csv");
              setError("");
            }}
          >
            <Upload size={15} />
            Import CSV
          </button>
        </div>
      )}
      {tab === "notes" && (
        <>
          <div className="parser-status">
            <span className="live-dot" />
            {provider
              ? "IBM watsonx.ai · live extraction"
              : "Demo mode · offline rule-based parser"}
            <span>Human review required</span>
          </div>
          <label className="field">
            What’s available?
            <textarea
              rows={6}
              maxLength={6000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. 24 kg vegetable rice; category: Prepared meals; location: Dining Commons; pickup: 15:00–16:30; storage: Chilled; diet: vegan; allergens: soy"
            />
          </label>
          <div className="editor-helper">
            <button className="text-btn" onClick={() => setNote(SAMPLE_NOTE)}>
              <RefreshCw size={13} />
              Use a sample note
            </button>
            <span>{note.length}/6,000</span>
          </div>
          <div className="notice">
            <ShieldCheck size={17} />
            <span>
              {provider
                ? "The note will be sent to IBM for extraction. Include inventory details only; avoid personal or sensitive information."
                : "No API key is required for the demo. The offline parser reads labeled fields and leaves unknown details for you to verify."}
            </span>
          </div>
          <button
            className="btn primary full"
            disabled={busy}
            onClick={extract}
          >
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Sparkles size={16} />
            )}{" "}
            {busy
              ? "Structuring your note…"
              : provider
                ? "Extract with watsonx.ai"
                : "Structure note & review"}
            <ArrowRight size={16} />
          </button>
        </>
      )}
      {tab === "manual" && (
        <form onSubmit={save}>
          {extracted && (
            <div className="notice">
              <Sparkles size={17} />
              <span>{extracted}</span>
            </div>
          )}
          {(draft.source || existing?.source) && (
            <details className="source-note">
              <summary>View original source note</summary>
              <p>{draft.source || existing?.source}</p>
            </details>
          )}
          <div className="form-grid">
            <label className="field span-2">
              Food name
              <input
                required
                maxLength={140}
                value={draft.name || ""}
                onChange={(e) => change("name", e.target.value)}
                placeholder="e.g. Vegetable rice bowls"
              />
            </label>
            <label className="field">
              Weight (kg)
              <input
                required
                type="number"
                min="0.01"
                max="10000"
                step="0.01"
                value={draft.kg ?? ""}
                onChange={(e) =>
                  change("kg", e.target.value ? Number(e.target.value) : NaN)
                }
                placeholder="24"
              />
            </label>
            <label className="field">
              Category
              <select
                required
                value={draft.category || ""}
                onChange={(e) => change("category", e.target.value as Category)}
              >
                <option value="" disabled>
                  Choose category
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field span-2">
              Pickup location
              <input
                required
                maxLength={200}
                value={draft.location || ""}
                onChange={(e) => change("location", e.target.value)}
                placeholder="e.g. Dining Commons, loading entrance"
              />
            </label>
            <label className="field">
              Pickup starts
              <input
                required
                type="time"
                value={draft.start || ""}
                onChange={(e) => change("start", e.target.value)}
              />
            </label>
            <label className="field">
              Pickup ends
              <input
                required
                type="time"
                value={draft.end || ""}
                onChange={(e) => change("end", e.target.value)}
              />
            </label>
            <label className="field">
              Storage & handling
              <select
                required
                value={draft.storage || ""}
                onChange={(e) => change("storage", e.target.value as Storage)}
              >
                <option value="" disabled>
                  Choose storage
                </option>
                {STORAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Verified dietary labels
              <select
                value={
                  draft.diet?.includes("vegan")
                    ? "vegan"
                    : draft.diet?.includes("vegetarian")
                      ? "vegetarian"
                      : ""
                }
                onChange={(e) =>
                  change("diet", e.target.value ? [e.target.value] : [])
                }
              >
                <option value="">No dietary claim</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
              </select>
            </label>
            <label className="field span-2">
              Declared allergens
              <input
                required
                maxLength={300}
                value={draft.allergens || ""}
                onChange={(e) => change("allergens", e.target.value)}
                placeholder="e.g. soy, wheat — or none declared"
              />
              <small>
                Use “unknown” until confirmed by the donor. “None declared”
                requires verification.
              </small>
            </label>
          </div>
          <label className="verification-check">
            <input
              type="checkbox"
              checked={draft.verified === true}
              onChange={(e) => change("verified", e.target.checked)}
            />
            <span>
              <strong>I verified this listing with the donor.</strong>
              <small>
                Quantity, pickup window, storage/handling, allergens, and any
                dietary claims have been checked. This does not replace our food
                safety procedures.
              </small>
            </span>
            <ShieldCheck size={21} />
          </label>
          <p className="modal-note">
            Pickup date: October 23, 2026 · demo day. Unchecked listings go to
            the review queue.
          </p>
          <button type="submit" className="btn primary full">
            {draft.verified ? (
              <CheckCircle2 size={17} />
            ) : (
              <FileText size={17} />
            )}{" "}
            {draft.verified ? "Save verified listing" : "Save for human review"}
          </button>
        </form>
      )}
      {tab === "csv" && (
        <CSVImport
          value={csv}
          onChange={setCsv}
          sample={INVENTORY_CSV}
          filename="rescueloop-inventory-template.csv"
          label="Inventory CSV"
          explanation="Include name, kg, category, location, start, end, storage, diet, and allergens. All imported listings require human verification."
          onImport={() => {
            try {
              onImport(csv);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
          onError={setError}
        />
      )}
      {error && (
        <div className="form-error" role="alert">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}
    </div>
  );
}
function CSVImport({
  value,
  onChange,
  sample,
  filename,
  label,
  explanation,
  onImport,
  onError,
}: {
  value: string;
  onChange: (t: string) => void;
  sample: string;
  filename: string;
  label: string;
  explanation: string;
  onImport: () => void;
  onError: (t: string) => void;
}) {
  return (
    <div className="csv-import">
      <p>{explanation}</p>
      <label className="upload-zone">
        <Upload size={26} />
        <strong>Choose a CSV file</strong>
        <span>or paste its contents below · max 1 MB</span>
        <input
          aria-label={`Upload ${label}`}
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (file.size > 1_000_000) {
                onError("Choose a CSV file under 1 MB.");
                return;
              }
              try {
                onChange(await file.text());
                onError("");
              } catch {
                onError("This file could not be read.");
              }
            }
          }}
        />
      </label>
      <label className="field">
        {label}
        <textarea
          rows={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={sample}
        />
      </label>
      <div className="editor-helper">
        <button className="text-btn" onClick={() => download(filename, sample)}>
          <Download size={14} />
          Download template
        </button>
        <button className="text-btn" onClick={() => onChange(sample)}>
          Use sample data
        </button>
      </div>
      <button className="btn primary full" onClick={onImport}>
        <Upload size={16} />
        Import records
      </button>
    </div>
  );
}
function PartnerEditor({
  existing,
  initialTab,
  onSave,
  onImport,
}: {
  existing: Partner | null;
  initialTab: string;
  onSave: (p: Partner) => void;
  onImport: (t: string) => void;
}) {
  const [tab, setTab] = useState(existing ? "details" : initialTab);
  const [draft, setDraft] = useState<Partner>(
    existing || {
      id: crypto.randomUUID(),
      name: "",
      description: "Community food partner",
      capacity: 40,
      start: "14:00",
      end: "18:00",
      storage: ["Chilled", "Ambient"],
      categories: ["Prepared meals", "Produce", "Bakery"],
      excludedAllergens: [],
      requiredDiet: "",
      distance: 1,
      active: true,
      initials: "CP",
      color: "green",
    },
  );
  const [error, setError] = useState("");
  const [csv, setCsv] = useState("");
  const update = (key: string, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }));
  return (
    <div className="editor">
      <p className="editor-intro">
        Keep receiving capacity and preferences current so every match has
        somewhere to go.
      </p>
      {!existing && (
        <div className="tabs editor-tabs">
          <button
            className={tab === "details" ? "selected" : ""}
            onClick={() => setTab("details")}
          >
            Partner details
          </button>
          <button
            className={tab === "csv" ? "selected" : ""}
            onClick={() => setTab("csv")}
          >
            <Upload size={14} />
            Import CSV
          </button>
        </div>
      )}
      {tab === "details" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              onSave({
                ...draft,
                initials: draft.name
                  .split(" ")
                  .slice(0, 2)
                  .map((s) => s[0])
                  .join("")
                  .toUpperCase(),
              });
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <div className="form-grid">
            <label className="field span-2">
              Partner name
              <input
                required
                maxLength={140}
                value={draft.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Community Table"
              />
            </label>
            <label className="field span-2">
              Description
              <input
                required
                maxLength={200}
                value={draft.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </label>
            <label className="field">
              Daily capacity (kg)
              <input
                required
                type="number"
                min="0.01"
                max="10000"
                step="0.01"
                value={draft.capacity}
                onChange={(e) => update("capacity", Number(e.target.value))}
              />
            </label>
            <label className="field">
              Sample distance (km)
              <input
                required
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={draft.distance}
                onChange={(e) => update("distance", Number(e.target.value))}
              />
            </label>
            <label className="field">
              Receiving starts
              <input
                required
                type="time"
                value={draft.start}
                onChange={(e) => update("start", e.target.value)}
              />
            </label>
            <label className="field">
              Receiving ends
              <input
                required
                type="time"
                value={draft.end}
                onChange={(e) => update("end", e.target.value)}
              />
            </label>
            <fieldset className="checkbox-field span-2">
              <legend>Available storage</legend>
              {STORAGES.map((s) => (
                <label key={s}>
                  <input
                    type="checkbox"
                    checked={draft.storage.includes(s)}
                    onChange={(e) =>
                      update(
                        "storage",
                        e.target.checked
                          ? [...draft.storage, s]
                          : draft.storage.filter((x) => x !== s),
                      )
                    }
                  />
                  {s}
                </label>
              ))}
            </fieldset>
            <fieldset className="checkbox-field span-2">
              <legend>Accepted categories</legend>
              {CATEGORIES.map((c) => (
                <label key={c}>
                  <input
                    type="checkbox"
                    checked={draft.categories.includes(c)}
                    onChange={(e) =>
                      update(
                        "categories",
                        e.target.checked
                          ? [...draft.categories, c]
                          : draft.categories.filter((x) => x !== c),
                      )
                    }
                  />
                  {c}
                </label>
              ))}
            </fieldset>
            <label className="field">
              Dietary requirement
              <select
                value={draft.requiredDiet}
                onChange={(e) => update("requiredDiet", e.target.value)}
              >
                <option value="">No requirement</option>
                <option value="vegan">Vegan only</option>
                <option value="vegetarian">Vegetarian only</option>
              </select>
            </label>
            <label className="field">
              Excluded allergens
              <input
                value={draft.excludedAllergens.join(", ")}
                onChange={(e) =>
                  update(
                    "excludedAllergens",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="e.g. peanuts, milk"
              />
            </label>
          </div>
          <label className="verification-check">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => update("active", e.target.checked)}
            />
            <span>
              <strong>Available to receive on demo day</strong>
              <small>
                Pausing prevents new suggestions. Already approved pickups stay
                reserved.
              </small>
            </span>
          </label>
          <button type="submit" className="btn primary full">
            <Check size={17} />
            Save partner
          </button>
        </form>
      ) : (
        <CSVImport
          value={csv}
          onChange={setCsv}
          sample={PARTNERS_CSV}
          filename="rescueloop-partners-template.csv"
          label="Partner capacity CSV"
          explanation="Import partner capacity and receiving preferences. Separate multiple storage types, categories, or allergens with |."
          onImport={() => {
            try {
              onImport(csv);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
          onError={setError}
        />
      )}
      {error && (
        <div className="form-error" role="alert">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}
    </div>
  );
}
function ResetWorkspace({ onReset }: { onReset: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="reset-workspace">
      {confirm ? (
        <>
          <p>
            Replace this browser’s listings, partners, and activity with the
            original sample data?
          </p>
          <div>
            <button className="btn" onClick={() => setConfirm(false)}>
              Keep my changes
            </button>
            <button className="btn danger" onClick={onReset}>
              Restore sample workspace
            </button>
          </div>
        </>
      ) : (
        <button className="text-btn" onClick={() => setConfirm(true)}>
          <RefreshCw size={14} />
          Reset sample workspace
        </button>
      )}
    </div>
  );
}
