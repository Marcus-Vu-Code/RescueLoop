"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  PackageOpen,
  Users,
  LayoutDashboard,
  Truck,
  ChartNoAxesCombined,
  Bell,
  Search,
  RefreshCw,
  ShieldCheck,
  Leaf,
  Sprout,
  Clock,
  MapPin,
  Check,
  CheckCheck,
  X,
  ChevronRight,
  Menu,
  LogOut,
  Settings,
  MessageCircle,
  Download,
  AlertTriangle,
  Sparkles,
  LoaderCircle,
  Send,
  Link2,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  Info,
  CalendarDays,
  SlidersHorizontal,
  HeartHandshake,
  LockKeyhole,
  Copy,
  FileText,
} from "lucide-react";
import { Logo, Badge, Modal, FoodArt, Stat } from "./rescue-app";
import {
  FOOD_CATEGORIES,
  FOOD_STORAGE,
  matchEligibility,
  receivingWindow,
  localParts,
  isConnected,
  usedOnDay,
  type Workspace,
  type Listing,
  type Organization,
  type Pickup,
  type Message,
  type Preferences,
} from "../lib/live-domain";
import {
  parseNote,
  formatKg,
  csvExport,
  parseInventoryCSV,
  SAMPLE_NOTE,
  INVENTORY_CSV,
  type Food,
} from "../lib/rescue";

type View =
  | "Overview"
  | "Food listings"
  | "Partners"
  | "Pickups"
  | "Impact report"
  | "Notifications";
type Popup = "food" | "profile" | "security" | "guide" | null;
type AuthMode = "login" | "signup" | "recover" | "forgot";
const dateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
const ago = (value: string) => {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(value)) / 60000),
  );
  return minutes < 1
    ? "Just now"
    : minutes < 60
      ? `${minutes}m ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h ago`
        : dateTime(value);
};
const initialDate = (value?: string) => {
  const d = value ? new Date(value) : new Date(Date.now() + 30 * 60000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const initialLetters = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
const stateTone = (s: string) =>
  s === "review" || s === "requested"
    ? "orange"
    : s === "approved" || s === "reserved"
      ? "purple"
      : s === "collected" || s === "accepted" || s === "available"
        ? "green"
        : "gray";
const stateLabel = (s: string) =>
  s === "review"
    ? "Needs review"
    : s === "requested"
      ? "Awaiting approval"
      : s === "reserved"
        ? "Pickup reserved"
        : s[0].toUpperCase() + s.slice(1);
async function api(input: Record<string, unknown>) {
  const r = await fetch("/api/live", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await r.json()) as {
    error?: string;
    recoveryCode?: string;
    message?: string;
    id?: string;
    receipt?: string;
  };
  if (!r.ok) throw new Error(data.error || "Your changes could not be saved.");
  return data;
}
function ErrorNote({ text }: { text: string }) {
  return text ? (
    <div className="form-error" role="alert">
      <AlertTriangle size={16} />
      {text}
    </div>
  ) : null;
}
function Blank({
  icon = <Sprout size={31} />,
  title,
  text,
  children,
}: {
  icon?: ReactNode;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="live-empty">
      {icon}
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}

export default function LiveApp() {
  const [emailAction, setEmailAction] = useState<{
    purpose: "verify" | "reset";
    token: string;
  } | null>(null);
  useEffect(() => {
    const match = window.location.hash.match(
      /^#(verify|reset)=([A-Za-z0-9_-]{43})$/,
    );
    if (match) {
      setEmailAction({
        purpose: match[1] as "verify" | "reset",
        token: match[2],
      });
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, []);
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [loading, setLoading] = useState(true),
    [connectionError, setConnectionError] = useState(""),
    [authMode, setAuthMode] = useState<AuthMode | null>(null),
    [view, setView] = useState<View>("Overview"),
    [popup, setPopup] = useState<Popup>(null),
    [editing, setEditing] = useState<Listing | null>(null),
    [selected, setSelected] = useState<Listing | null>(null),
    [thread, setThread] = useState<Pickup | null>(null),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [toastError, setToastError] = useState(false),
    [recovery, setRecovery] = useState(""),
    [mobile, setMobile] = useState(false),
    [narrow, setNarrow] = useState(false),
    [search, setSearch] = useState(""),
    [foodTab, setFoodTab] = useState("all"),
    [partnerTab, setPartnerTab] = useState("directory"),
    [pickupTab, setPickupTab] = useState("active"),
    [confirm, setConfirm] = useState<{
      title: string;
      text: string;
      input: Record<string, unknown>;
      success: string;
    } | null>(null),
    [connectionTarget, setConnectionTarget] = useState<Organization | null>(
      null,
    );
  const sequence = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const refresh = useCallback(async () => {
    const seq = ++sequence.current;
    try {
      const r = await fetch("/api/live", { cache: "no-store" });
      const data = (await r.json()) as Workspace & { error?: string };
      if (!r.ok)
        throw new Error(
          data.error || "Unable to connect to the shared workspace.",
        );
      if (seq === sequence.current) {
        setWorkspace(data.user ? data : null);
        setConnectionError("");
      }
    } catch (e) {
      if (seq === sequence.current) setConnectionError((e as Error).message);
    } finally {
      if (seq === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, 20000);
    const visible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  useEffect(() => {
    const q = matchMedia("(max-width: 600px)");
    const update = () => setNarrow(q.matches);
    update();
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  function notice(text: string, error = false) {
    setToast(text);
    setToastError(error);
  }
  async function mutate(input: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      const result = await api(input);
      await refresh();
      if (success) notice(success);
      return result;
    } finally {
      setBusy(false);
    }
  }
  function act(input: Record<string, unknown>, success: string) {
    mutate(input, success).catch((e) => notice((e as Error).message, true));
  }
  function navigate(next: View) {
    setView(next);
    setSearch("");
    setMobile(false);
  }
  function addFood() {
    setEditing(null);
    setPopup("food");
  }
  function exportImpact() {
    if (!workspace) return;
    const rows: (string | number)[][] = [
      ["RescueLoop confirmed collections"],
      ["Organization", workspace.organization.name],
      ["Generated", new Date().toISOString()],
      [
        "Receipt",
        "Food",
        "Weight (kg)",
        "Estimated meal equivalents (0.5 kg)",
        "Donor",
        "Receiver",
        "Confirmed at",
      ],
    ];
    for (const p of workspace.pickups.filter((p) => p.status === "collected")) {
      const f = workspace.listings.find((f) => f.id === p.listingId);
      if (f)
        rows.push([
          p.receipt || p.id,
          f.name,
          f.kg,
          Math.floor(f.kg / 0.5),
          orgName(p.donorId),
          orgName(p.receiverId),
          p.collectedAt || "",
        ]);
    }
    downloadText("rescueloop-collections.csv", csvExport(rows), "text/csv");
    notice("Your collection report has been downloaded.");
  }
  function orgName(id: string) {
    return workspace?.organization.id === id
      ? workspace.organization.name
      : workspace?.directory.find((o) => o.id === id)?.name ||
          "Community partner";
  }
  if (loading)
    return (
      <div className="live-loading">
        <Logo />
        <LoaderCircle size={26} className="spin" />
        <p>Opening your community workspace…</p>
      </div>
    );
  const emailModal = emailAction && (
    <EmailActionModal
      action={emailAction}
      onClose={() => {
        setEmailAction(null);
        refresh();
      }}
    />
  );
  if (!workspace)
    return (
      <>
        <Landing onAuth={setAuthMode} />
        {emailModal}
        {connectionError && (
          <div className="landing-error">
            <ErrorNote text={connectionError} />
            <button className="text-btn" onClick={refresh}>
              Try connecting again
              <RefreshCw size={14} />
            </button>
          </div>
        )}
        {authMode && (
          <Modal
            title={
              authMode === "signup"
                ? "A good connection starts here"
                : authMode === "recover" || authMode === "forgot"
                  ? "Get back in the loop"
                  : "Welcome back to the loop"
            }
            eyebrow={
              authMode === "signup"
                ? "CREATE YOUR RESCUELOOP ACCOUNT"
                : authMode === "recover" || authMode === "forgot"
                  ? "ACCOUNT RECOVERY"
                  : "SIGN IN TO RESCUELOOP"
            }
            onClose={() => setAuthMode(null)}
          >
            <AuthForm
              mode={authMode}
              setMode={setAuthMode}
              onSuccess={async (code) => {
                setAuthMode(null);
                if (code) setRecovery(code);
                await refresh();
              }}
            />
          </Modal>
        )}
      </>
    );
  const w = workspace,
    me = w.organization,
    orgs = [me, ...w.directory];
  const unread = w.notifications.filter((n) => !n.readAt).length;
  const mine = w.listings.filter((f) => f.ownerId === me.id);
  const available = w.listings.filter(
    (f) => f.status === "available" && Date.parse(f.endAt) > Date.now(),
  );
  const connections = w.partnerships.filter((p) => p.status === "accepted");
  const incoming = w.partnerships.filter(
    (p) => p.status === "pending" && p.requesterId !== me.id,
  );
  const activePickups = w.pickups.filter((p) =>
    ["approved", "requested"].includes(p.status),
  );
  const completed = w.pickups.filter((p) => p.status === "collected");
  const rescued = completed.reduce(
    (n, p) => n + (w.listings.find((f) => f.id === p.listingId)?.kg || 0),
    0,
  );
  const ownReview = mine.filter((f) => f.status === "review");
  const requests = w.pickups.filter(
    (p) => p.donorId === me.id && p.status === "requested",
  );
  const visibleFoods = w.listings
    .filter(
      (f) =>
        (foodTab === "all"
          ? ["review", "available", "reserved"].includes(f.status)
          : foodTab === "mine"
            ? f.ownerId === me.id
            : foodTab === "network"
              ? f.ownerId !== me.id
              : foodTab === "review"
                ? f.ownerId === me.id && f.status === "review"
                : foodTab === "history"
                  ? ["collected", "withdrawn"].includes(f.status)
                  : true) &&
        `${f.name} ${orgName(f.ownerId)} ${f.category}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => a.endAt.localeCompare(b.endAt));
  const visiblePickups = w.pickups.filter(
    (p) =>
      (pickupTab === "active"
        ? ["requested", "approved"].includes(p.status)
        : pickupTab === "incoming"
          ? p.donorId === me.id && p.status === "requested"
          : pickupTab === "completed"
            ? p.status === "collected"
            : ["declined", "cancelled"].includes(p.status)) &&
      `${w.listings.find((f) => f.id === p.listingId)?.name} ${orgName(p.donorId)} ${orgName(p.receiverId)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const visiblePartners = w.directory
    .filter((o) =>
      `${o.name} ${o.area} ${o.role}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .filter((o) =>
      partnerTab === "connected"
        ? isConnected(me.id, o.id, w.partnerships)
        : partnerTab === "requests"
          ? w.partnerships.some(
              (p) =>
                p.status === "pending" && (p.orgA === o.id || p.orgB === o.id),
            )
          : o.discoverable,
    );
  function pickupCard(p: Pickup) {
    const f = w.listings.find((f) => f.id === p.listingId);
    if (!f) return null;
    const receiving = p.receiverId === me.id;
    return (
      <article key={p.id} className="panel live-pickup-card">
        <div className="live-card-top">
          <Badge tone={stateTone(p.status)}>{stateLabel(p.status)}</Badge>
          <span className="muted small">
            {receiving ? "Receiving" : "Donating"}
          </span>
        </div>
        <div className="live-food-title">
          <FoodArt food={f} />
          <div>
            <h3>{f.name}</h3>
            <p>
              {formatKg(f.kg)} kg · {f.storage} · {f.category}
            </p>
          </div>
        </div>
        <div className="live-pickup-path">
          <span>{orgName(p.donorId)}</span>
          <ArrowRight size={15} />
          <span>{orgName(p.receiverId)}</span>
        </div>
        <p className="live-detail">
          <CalendarDays size={15} />
          {dateTime(p.windowStart)} – {dateTime(p.windowEnd)}
        </p>
        <p className="live-detail">
          <MapPin size={15} />
          {f.pickupLocation}
        </p>
        <div className="live-card-actions">
          <button className="btn" onClick={() => setThread(p)}>
            <MessageCircle size={15} />
            {p.status === "collected"
              ? "Receipt & conversation"
              : "Pickup details"}
          </button>
          {p.status === "requested" && !receiving && (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() =>
                act(
                  { action: "pickup.approve", id: p.id },
                  "Pickup approved. Receiving capacity is now reserved.",
                )
              }
            >
              <Check size={15} />
              Approve
            </button>
          )}
          {p.status === "approved" && receiving && (
            <button className="btn primary" onClick={() => setThread(p)}>
              Confirm receipt
              <CheckCheck size={15} />
            </button>
          )}
        </div>
      </article>
    );
  }
  return (
    <div className="app-shell live-app">
      <a className="skip-link" href="#main">
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
          onClick={() => setPopup("profile")}
        >
          <span className="workspace-icon">
            <Sprout size={19} />
          </span>
          <span>
            <strong>{me.name}</strong>
            <small>{me.area}</small>
          </span>
          <ChevronRight size={15} />
        </button>
        <div className="nav-label">YOUR COMMUNITY</div>
        <nav aria-label="Main navigation">
          {[
            { name: "Overview" as View, icon: LayoutDashboard },
            { name: "Food listings" as View, icon: PackageOpen },
            { name: "Partners" as View, icon: Users },
            { name: "Pickups" as View, icon: Truck },
            { name: "Impact report" as View, icon: ChartNoAxesCombined },
            { name: "Notifications" as View, icon: Bell },
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={"nav-item " + (view === name ? "active" : "")}
              aria-current={view === name ? "page" : undefined}
              onClick={() => navigate(name)}
            >
              <Icon size={19} />
              <span>{name}</span>
              {name === "Notifications" && unread > 0 && (
                <span className="nav-count">{unread}</span>
              )}
              {name === "Pickups" && requests.length > 0 && (
                <span className="nav-count">{requests.length}</span>
              )}
              {name === "Partners" && incoming.length > 0 && (
                <span className="nav-count">{incoming.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mission-card">
            <Sprout size={28} />
            <p>
              A little less waste.
              <br />A lot more possibility.
            </p>
            <span>Better, together.</span>
          </div>
          <button className="sidebar-link" onClick={() => setPopup("profile")}>
            <Settings size={17} />
            Organization profile
          </button>
          <button className="sidebar-link" onClick={() => setPopup("security")}>
            <LockKeyhole size={17} />
            Account & security
          </button>
          <button className="sidebar-link" onClick={() => setPopup("guide")}>
            <Info size={17} />
            How it works
          </button>
          <button
            className="sidebar-link"
            disabled={busy}
            onClick={() => act({ action: "auth.logout" }, "Signed out.")}
          >
            <LogOut size={17} />
            Sign out
          </button>
          <div className="sidebar-signoff">
            <span className="live-dot" />
            Shared records. Real connections.
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-scrim"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
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
              <Menu size={20} />
            </button>
            <span>Your workspace</span>
            <ChevronRight size={13} />
            <strong>{view}</strong>
          </div>
          <div className="topbar-right">
            <label className="global-search">
              <Search size={16} />
              <input
                ref={searchRef}
                aria-label="Search current view"
                placeholder={`Search ${view.toLowerCase()}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>⌘ K</kbd>
            </label>
            <button
              className="live-sync"
              title={`Last refreshed ${dateTime(w.serverTime)}`}
              onClick={refresh}
            >
              <span
                className={"live-dot " + (connectionError ? "paused" : "")}
              />
              {connectionError ? "Reconnect" : "Connected"}
              <RefreshCw size={12} />
            </button>
            <button
              className="icon-btn notification"
              aria-label={`${unread} unread notifications`}
              onClick={() => navigate("Notifications")}
            >
              <Bell size={19} />
              {unread > 0 && <span />}
            </button>
            <button
              className="avatar"
              onClick={() => setPopup("security")}
              aria-label="Account settings"
            >
              {initialLetters(w.user.displayName)}
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">SMALL ACTIONS. SHARED IMPACT.</p>
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
                  ? `Welcome, ${w.user.displayName.split(" ")[0]}. Let’s put good food in good hands.`
                  : view === "Partners"
                    ? "Build trusted relationships with the organizations around you."
                    : view === "Food listings"
                      ? "Fresh opportunities from your organization and connected partners."
                      : view === "Pickups"
                        ? "Coordinate the handoff. Confirm the collection. Close the loop."
                        : view === "Notifications"
                          ? "Partner requests, pickup updates, and conversations, all in one place."
                          : "Every confirmed collection has a record. Every rescue adds up."}
              </p>
            </div>
            <div className="heading-actions">
              {view === "Impact report" ? (
                <button className="btn primary" onClick={exportImpact}>
                  <Download size={16} />
                  Export collections
                </button>
              ) : view === "Partners" ? (
                <button
                  className="btn primary"
                  onClick={() => setPopup("profile")}
                >
                  <Settings size={16} />
                  Manage profile
                </button>
              ) : (
                me.role !== "receiver" && (
                  <button className="btn primary" onClick={addFood}>
                    <Plus size={17} />
                    Add surplus
                  </button>
                )
              )}
            </div>
          </div>
          {connectionError && (
            <div className="notice warning">
              <AlertTriangle size={17} />
              <span>
                {connectionError} Your last loaded data is shown below.
              </span>
              <button onClick={refresh}>
                Retry
                <RefreshCw size={13} />
              </button>
            </div>
          )}
          {view === "Overview" && (
            <>
              {!me.discoverable && (
                <div className="live-onboarding">
                  <span className="small-icon sage">
                    <HeartHandshake size={24} />
                  </span>
                  <div>
                    <h3>Let your community find you.</h3>
                    <p>
                      Set your receiving preferences and publish your
                      organization profile to start building partnerships.
                    </p>
                  </div>
                  <button
                    className="btn primary"
                    onClick={() => setPopup("profile")}
                  >
                    Finish profile
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
              <div className="overview-meta">
                <span>
                  <span className="live-dot" />
                  Your community at a glance
                </span>
                <span>
                  <Clock size={14} />
                  Updated {dateTime(w.serverTime)}
                </span>
              </div>
              <section className="stats-grid">
                <Stat
                  icon={<Leaf size={19} />}
                  label="Food you helped rescue"
                  value={formatKg(rescued)}
                  unit="kg"
                  note="Confirmed collections only"
                  color="green"
                />
                <Stat
                  icon={<Truck size={19} />}
                  label="Active pickups"
                  value={String(activePickups.length).padStart(2, "0")}
                  note={`${requests.length} awaiting your approval`}
                  color="orange"
                />
                <Stat
                  icon={<PackageOpen size={19} />}
                  label="Surplus in your network"
                  value={formatKg(available.reduce((n, f) => n + f.kg, 0))}
                  unit="kg"
                  note={`${available.length} available listings`}
                  color="yellow"
                />
                <Stat
                  icon={<Users size={19} />}
                  label="Community partners"
                  value={String(connections.length).padStart(2, "0")}
                  note={`${incoming.length} incoming connection requests`}
                  color="purple"
                />
              </section>
              <section className="live-overview-grid">
                <div className="rescue-hero">
                  <div className="hero-content">
                    <span className="hero-kicker">
                      <span className="live-dot" />
                      GOOD FOOD BELONGS IN THE COMMUNITY
                    </span>
                    <h2>
                      More than a surplus.
                      <br />
                      <em>The start of something good.</em>
                    </h2>
                    <p>
                      Connect with a pantry, a kitchen, or a campus donor.
                      <br />
                      Make your next rescue happen, together.
                    </p>
                    <button
                      className="btn light"
                      onClick={() => navigate("Partners")}
                    >
                      Find community partners
                      <ArrowUpRight size={17} />
                    </button>
                    <span className="hero-footnote">
                      <ShieldCheck size={14} />
                      Verified listings. Human approval. Shared progress.
                    </span>
                  </div>
                  <div className="live-hero-art" aria-hidden="true">
                    <div>
                      <Sprout size={54} />
                    </div>
                    <span>
                      <HeartHandshake size={35} />
                    </span>
                    <i />
                  </div>
                </div>
                <section className="panel live-next-steps">
                  <div className="section-heading">
                    <h2>A little attention goes a long way</h2>
                    <Sparkles size={18} />
                  </div>
                  <button
                    className="attention-item"
                    onClick={() => {
                      navigate("Partners");
                      setPartnerTab("requests");
                    }}
                  >
                    <span className="attention-icon sage">
                      <Users size={20} />
                    </span>
                    <span>
                      <strong>
                        {incoming.length} partner request
                        {incoming.length !== 1 ? "s" : ""}
                      </strong>
                      <small>Welcome someone new into your network.</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                  <button
                    className="attention-item"
                    onClick={() => {
                      navigate("Pickups");
                      setPickupTab("incoming");
                    }}
                  >
                    <span className="attention-icon amber">
                      <Truck size={20} />
                    </span>
                    <span>
                      <strong>
                        {requests.length} pickup request
                        {requests.length !== 1 ? "s" : ""} to review
                      </strong>
                      <small>
                        Check the details before reserving capacity.
                      </small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                  <button
                    className="attention-item"
                    onClick={() => {
                      navigate("Food listings");
                      setFoodTab("review");
                    }}
                  >
                    <span className="attention-icon sage">
                      <ShieldCheck size={20} />
                    </span>
                    <span>
                      <strong>
                        {ownReview.length} listing
                        {ownReview.length !== 1 ? "s" : ""} need
                        {ownReview.length === 1 ? "s" : ""} verification
                      </strong>
                      <small>
                        Review allergens and handling with the donor.
                      </small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                </section>
              </section>
              <section className="panel live-overview-list">
                <div className="section-heading">
                  <h2>Ready for a second helping</h2>
                  <button
                    className="text-btn"
                    onClick={() => navigate("Food listings")}
                  >
                    All food listings
                    <ArrowRight size={15} />
                  </button>
                </div>
                {available
                  .slice()
                  .sort((a, b) => a.endAt.localeCompare(b.endAt))
                  .slice(0, 4)
                  .map((f) => (
                    <ListingRow
                      key={f.id}
                      listing={f}
                      owner={orgName(f.ownerId)}
                      mine={f.ownerId === me.id}
                      onOpen={() => setSelected(f)}
                    />
                  ))}
                {available.length === 0 && (
                  <Blank
                    title="Your next rescue starts with a connection"
                    text={
                      connections.length
                        ? "Post surplus food or check back when a partner shares a new listing."
                        : "Connect with a community partner to share and discover available surplus."
                    }
                  >
                    <button
                      className="btn"
                      onClick={() => navigate("Partners")}
                    >
                      Explore partners
                      <ArrowRight size={15} />
                    </button>
                  </Blank>
                )}
              </section>
            </>
          )}
          {view === "Food listings" && (
            <>
              <div className="list-toolbar">
                <div className="tabs" aria-label="Listing filters">
                  {[
                    ["all", "Active listings"],
                    ["mine", "My surplus"],
                    ["network", "Partner surplus"],
                    ["review", "Needs review"],
                    ["history", "History"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      className={foodTab === key ? "selected" : ""}
                      onClick={() => setFoodTab(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="live-mobile-search">
                  <Search size={14} />
                  <input
                    aria-label="Search food listings"
                    placeholder="Search food…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              <div className="notice">
                <ShieldCheck size={17} />
                <span>
                  Only verified food is available to connected partners. Every
                  pickup needs donor approval, and the receiver confirms the
                  handoff.
                </span>
              </div>
              <section className="panel live-food-table">
                {visibleFoods.map((f) => (
                  <ListingRow
                    key={f.id}
                    listing={f}
                    owner={orgName(f.ownerId)}
                    mine={f.ownerId === me.id}
                    onOpen={() => setSelected(f)}
                  />
                ))}
                {!visibleFoods.length && (
                  <Blank
                    icon={<PackageOpen size={33} />}
                    title="No listings in this view yet"
                    text="Try another filter, share surplus, or connect with another organization."
                  />
                )}
              </section>
            </>
          )}
          {view === "Partners" && (
            <>
              <div className="list-toolbar">
                <div className="tabs">
                  {[
                    ["directory", "Discover partners"],
                    ["connected", "My partners"],
                    ["requests", "Requests"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      className={partnerTab === key ? "selected" : ""}
                      onClick={() => setPartnerTab(key)}
                    >
                      {label}
                      {key === "requests" && incoming.length > 0 && (
                        <span>{incoming.length}</span>
                      )}
                    </button>
                  ))}
                </div>
                <label className="live-mobile-search">
                  <Search size={14} />
                  <input
                    aria-label="Search partners"
                    placeholder="Search partners…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              <div className="live-partner-grid">
                {visiblePartners.map((o) => {
                  const p = w.partnerships.find(
                    (p) => p.orgA === o.id || p.orgB === o.id,
                  );
                  return (
                    <article className="panel partner-card" key={o.id}>
                      <div className="partner-top">
                        <span className="partner-avatar large">
                          {initialLetters(o.name)}
                        </span>
                        <Badge
                          tone={
                            p?.status === "accepted"
                              ? "green"
                              : p?.status === "pending"
                                ? "orange"
                                : "gray"
                          }
                        >
                          {p?.status === "accepted"
                            ? "Connected"
                            : p?.status === "pending"
                              ? p.requesterId === me.id
                                ? "Request sent"
                                : "Incoming request"
                              : o.role === "donor"
                                ? "Food donor"
                                : o.accepting
                                  ? "Receiving food"
                                  : "Community partner"}
                        </Badge>
                      </div>
                      <h2>{o.name}</h2>
                      <p className="live-partner-description">
                        {o.description ||
                          "A new member of the RescueLoop community."}
                      </p>
                      <div className="partner-details">
                        <span>
                          <MapPin size={15} />
                          {o.area}
                        </span>
                        <span>
                          <Clock size={15} />
                          {o.receivingStart}–{o.receivingEnd} ·{" "}
                          {o.timezone.replaceAll("_", " ")}
                        </span>
                        <span>
                          <PackageOpen size={15} />
                          {o.storage.join(", ")}
                        </span>
                        {o.role !== "donor" && (
                          <span>
                            <Truck size={15} />
                            {formatKg(o.capacityKg)} kg daily capacity ·{" "}
                            {o.accepting ? "accepting" : "paused"}
                          </span>
                        )}
                      </div>
                      <div className="tags">
                        {o.categories.map((c) => (
                          <span key={c}>{c}</span>
                        ))}
                        {o.requiredDiet && (
                          <span className="diet">{o.requiredDiet} only</span>
                        )}
                      </div>
                      {p?.status === "pending" && p.note && (
                        <p className="live-request-note">“{p.note}”</p>
                      )}
                      {p?.status === "accepted" ? (
                        <div className="live-partner-actions">
                          <button
                            className="btn full"
                            onClick={() => {
                              navigate("Food listings");
                              setSearch(o.name);
                              setFoodTab("network");
                            }}
                          >
                            View shared food
                            <ArrowRight size={15} />
                          </button>
                          <button
                            className="text-btn"
                            onClick={() =>
                              setConfirm({
                                title: "Close this partnership?",
                                text: "New pickups will require a new accepted partnership. Existing approved pickups and conversations remain accessible.",
                                input: { action: "partnership.end", id: p.id },
                                success: "Partnership closed.",
                              })
                            }
                          >
                            End partnership
                          </button>
                        </div>
                      ) : p?.status === "pending" ? (
                        p.requesterId === me.id ? (
                          <button
                            className="btn full"
                            disabled={busy}
                            onClick={() =>
                              act(
                                { action: "partnership.end", id: p.id },
                                "Connection request cancelled.",
                              )
                            }
                          >
                            Cancel request
                          </button>
                        ) : (
                          <div className="live-card-actions">
                            <button
                              className="btn"
                              disabled={busy}
                              onClick={() =>
                                act(
                                  {
                                    action: "partnership.respond",
                                    id: p.id,
                                    status: "declined",
                                  },
                                  "Partner request declined.",
                                )
                              }
                            >
                              Decline
                            </button>
                            <button
                              className="btn primary"
                              disabled={busy}
                              onClick={() =>
                                act(
                                  {
                                    action: "partnership.respond",
                                    id: p.id,
                                    status: "accepted",
                                  },
                                  "You’re connected. Share food and coordinate your first pickup.",
                                )
                              }
                            >
                              <Check size={15} />
                              Accept partner
                            </button>
                          </div>
                        )
                      ) : (
                        <button
                          className="btn primary full"
                          onClick={() => setConnectionTarget(o)}
                        >
                          <Link2 size={15} />
                          Request partnership
                        </button>
                      )}
                    </article>
                  );
                })}
                {!visiblePartners.length && (
                  <section className="panel live-empty-panel">
                    <Blank
                      icon={<Users size={34} />}
                      title={
                        partnerTab === "requests"
                          ? "No pending requests"
                          : "Your community is still growing"
                      }
                      text="Organizations appear here after they publish their directory profiles. Share the app with your campus pantry or dining team to connect."
                    />
                  </section>
                )}
              </div>
            </>
          )}
          {view === "Pickups" && (
            <>
              <div className="list-toolbar">
                <div className="tabs">
                  {[
                    ["active", "Active pickups"],
                    ["incoming", "Needs approval"],
                    ["completed", "Completed"],
                    ["closed", "Closed"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      className={pickupTab === key ? "selected" : ""}
                      onClick={() => setPickupTab(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="live-pickup-grid">
                {visiblePickups.map(pickupCard)}
                {!visiblePickups.length && (
                  <section className="panel live-empty-panel">
                    <Blank
                      icon={<Truck size={35} />}
                      title="Every good handoff starts somewhere"
                      text="Request available food from a connected partner, or review requests for your own surplus."
                    >
                      <button
                        className="btn"
                        onClick={() => navigate("Food listings")}
                      >
                        Explore food listings
                        <ArrowRight size={15} />
                      </button>
                    </Blank>
                  </section>
                )}
              </div>
            </>
          )}
          {view === "Impact report" && (
            <>
              <div className="impact-banner">
                <span className="impact-leaf">
                  <Leaf size={35} />
                </span>
                <div>
                  <p className="eyebrow">GOOD THINGS ADD UP</p>
                  <h2>{formatKg(rescued)} kg with a better destination.</h2>
                  <p>
                    From collections confirmed by the receiving organization.
                    Your donations and receipts are counted once each.
                  </p>
                </div>
                <button className="btn" onClick={() => setPopup("guide")}>
                  <Info size={15} />
                  How we measure
                </button>
              </div>
              <section className="stats-grid">
                <Stat
                  icon={<Leaf size={19} />}
                  label="Food rescued"
                  value={formatKg(rescued)}
                  unit="kg"
                  note="Confirmed collection weight"
                  color="green"
                />
                <Stat
                  icon={<HeartHandshake size={19} />}
                  label="Meal equivalents"
                  value={String(Math.floor(rescued / 0.5))}
                  note="Estimate · 0.5 kg per meal"
                  color="orange"
                />
                <Stat
                  icon={<Truck size={19} />}
                  label="Completed pickups"
                  value={String(completed.length)}
                  note="With a collection receipt"
                  color="yellow"
                />
                <Stat
                  icon={<Users size={19} />}
                  label="Connected partners"
                  value={String(connections.length)}
                  note="Mutually accepted partnerships"
                  color="purple"
                />
              </section>
              <section className="panel collection-log">
                <div className="section-heading">
                  <h2>The rescue record</h2>
                  <button className="text-btn" onClick={exportImpact}>
                    <Download size={15} />
                    Download CSV
                  </button>
                </div>
                {completed.length ? (
                  <div className="log-table">
                    <table>
                      <thead>
                        <tr>
                          <th>FOOD</th>
                          <th>WEIGHT</th>
                          <th>PARTNER</th>
                          <th>CONFIRMED</th>
                          <th>RECEIPT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {completed.map((p) => {
                          const f = w.listings.find(
                            (f) => f.id === p.listingId,
                          );
                          return (
                            <tr key={p.id}>
                              <td>{f?.name}</td>
                              <td>{formatKg(f?.kg || 0)} kg</td>
                              <td>
                                {orgName(
                                  p.donorId === me.id
                                    ? p.receiverId
                                    : p.donorId,
                                )}
                              </td>
                              <td>
                                {p.collectedAt ? dateTime(p.collectedAt) : "—"}
                              </td>
                              <td>
                                <button
                                  className="text-btn"
                                  onClick={() => setThread(p)}
                                >
                                  {p.receipt}
                                  <ArrowUpRight size={12} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Blank
                    title="Your first rescue is ahead of you"
                    text="Confirmed pickups will appear here with the food weight, partner, and a traceable collection receipt."
                  />
                )}
              </section>
              <div className="notice live-impact-note">
                <Info size={17} />
                <span>
                  Meal equivalents use an illustrative 0.5 kg assumption and are
                  rounded down. Actual servings vary. Listing weight is
                  donor-reported; this app does not independently weigh food or
                  estimate emissions.
                </span>
              </div>
            </>
          )}
          {view === "Notifications" && (
            <>
              <div className="list-toolbar">
                <span className="muted">
                  {unread} unread update{unread !== 1 ? "s" : ""}
                </span>
                <button
                  className="btn"
                  disabled={busy || !unread}
                  onClick={() =>
                    act(
                      { action: "notifications.read" },
                      "All notifications marked as read.",
                    )
                  }
                >
                  <CheckCheck size={15} />
                  Mark all read
                </button>
              </div>
              <section className="panel live-notifications">
                {w.notifications.map((n) => (
                  <button
                    key={n.id}
                    className={
                      "live-notification " + (!n.readAt ? "unread" : "")
                    }
                    onClick={() => {
                      if (!n.readAt)
                        act({ action: "notifications.read", ids: [n.id] }, "");
                      if (n.kind === "partnership") {
                        navigate("Partners");
                        setPartnerTab("requests");
                      } else {
                        const p = w.pickups.find((p) => p.id === n.entityId);
                        if (p) setThread(p);
                        else navigate("Pickups");
                      }
                    }}
                  >
                    <span
                      className={
                        "attention-icon " +
                        (n.kind === "partnership" ? "sage" : "amber")
                      }
                    >
                      {n.kind === "partnership" ? (
                        <Users size={19} />
                      ) : n.kind === "message" ? (
                        <MessageCircle size={19} />
                      ) : (
                        <Truck size={19} />
                      )}
                    </span>
                    <span>
                      <strong>{n.title}</strong>
                      <p>{n.body}</p>
                      <small>{ago(n.createdAt)}</small>
                    </span>
                    {!n.readAt && <i className="live-dot" />}
                    <ChevronRight size={17} />
                  </button>
                ))}
                {!w.notifications.length && (
                  <Blank
                    icon={<Bell size={33} />}
                    title="You’re all caught up"
                    text="Partner requests, pickup updates, and conversation notifications will appear here."
                  />
                )}
              </section>
              <section className="panel live-preferences">
                <div>
                  <h3>
                    <Mail size={19} /> Email updates
                  </h3>
                  {w.emailMode === "owner-test" && (
                    <p className="notice">
                      Owner-only delivery test. Sending to other users requires
                      a verified domain.
                    </p>
                  )}
                  <p>
                    {!w.emailConfigured
                      ? "Email delivery is awaiting provider setup. In-app notifications remain available."
                      : w.user.emailVerifiedAt
                        ? "Your address is verified. Choose whether RescueLoop sends you updates."
                        : "Verify your sign-in email before enabling email updates."}
                  </p>
                  {w.emailConfigured && !w.user.emailVerifiedAt && (
                    <button
                      className="btn outline"
                      disabled={busy}
                      onClick={() =>
                        act(
                          { action: "account.email.verify" },
                          "Verification email requested. Check your inbox; requests are limited to one per minute.",
                        )
                      }
                    >
                      Send verification email
                    </button>
                  )}
                  <label className="live-switch">
                    <input
                      type="checkbox"
                      checked={w.user.emailEnabled}
                      disabled={
                        busy ||
                        (!w.user.emailEnabled &&
                          (!w.emailConfigured || !w.user.emailVerifiedAt))
                      }
                      onChange={(e) =>
                        act(
                          {
                            action: "account.email.preferences",
                            enabled: e.target.checked,
                          },
                          "Email preferences saved.",
                        )
                      }
                    />
                    <span>Send my selected notifications by email</span>
                  </label>
                  <small>
                    Email updates contain a sign-in link, without private
                    conversation text. Delivery is retried automatically when
                    the provider is temporarily unavailable.
                  </small>
                </div>
              </section>
              <section className="panel live-preferences">
                <div>
                  <h3>Keep the right things in your loop.</h3>
                  <p>
                    Choose the in-app notifications you receive. Updates refresh
                    automatically while the app is open.
                  </p>
                </div>
                {(["partnership", "pickup", "message"] as const).map((key) => (
                  <label className="live-switch" key={key}>
                    <input
                      type="checkbox"
                      checked={w.preferences[key]}
                      disabled={busy}
                      onChange={(e) =>
                        act(
                          {
                            action: "notifications.preferences",
                            preferences: {
                              ...w.preferences,
                              [key]: e.target.checked,
                            },
                          },
                          "Notification preferences saved.",
                        )
                      }
                    />
                    <span>
                      {key === "partnership"
                        ? "Partner requests"
                        : key === "pickup"
                          ? "Pickup updates"
                          : "Messages"}
                    </span>
                  </label>
                ))}
              </section>
            </>
          )}
          <footer className="page-footer">
            <span>
              <Leaf size={13} />
              Good food belongs in the community.
            </span>
            <span>
              Shared workspace<span className="footer-dot">·</span>
              <button onClick={() => setPopup("guide")}>
                Responsible by design
                <ArrowUpRight size={12} />
              </button>
            </span>
          </footer>
        </main>
      </div>
      {popup === "food" && (
        <Modal
          title={
            editing ? "Review your surplus" : "A second chance for good food"
          }
          eyebrow="SURPLUS FOOD"
          wide
          onClose={() => {
            setPopup(null);
            setEditing(null);
          }}
        >
          <LiveFoodForm
            existing={editing}
            provider={w.providerConfigured}
            onSave={async (listing) => {
              await mutate(
                { action: "listing.save", listing },
                listing.verified
                  ? "Verified listing published to your connected partners."
                  : "Listing saved for review.",
              );
              setPopup(null);
              setEditing(null);
            }}
            onImport={async (listings) => {
              await mutate(
                { action: "listing.import", listings },
                `${listings.length} listings imported for review.`,
              );
              setPopup(null);
            }}
          />
        </Modal>
      )}
      {popup === "profile" && (
        <Modal
          title="Your community starts with you"
          eyebrow="ORGANIZATION PROFILE"
          wide
          onClose={() => setPopup(null)}
        >
          <OrganizationForm
            organization={me}
            onSave={async (organization) => {
              await mutate(
                { action: "organization.save", organization },
                "Organization profile updated.",
              );
              setPopup(null);
            }}
          />
        </Modal>
      )}
      {popup === "security" && (
        <Modal
          title="Your account, in your hands"
          eyebrow="ACCOUNT & SECURITY"
          onClose={() => setPopup(null)}
        >
          <AccountSettings
            email={w.user.email}
            verified={!!w.user.emailVerifiedAt}
            onSubmit={async (input) => {
              const result = await mutate(input, "Account security updated.");
              if (result.recoveryCode) {
                setPopup(null);
                setRecovery(result.recoveryCode);
              }
            }}
          />
        </Modal>
      )}
      {selected && (
        <Modal
          title={selected.name}
          eyebrow={
            selected.ownerId === me.id
              ? "YOUR SURPLUS LISTING"
              : "PARTNER SURPLUS"
          }
          wide
          onClose={() => setSelected(null)}
        >
          <ListingDetails
            listing={w.listings.find((f) => f.id === selected.id) || selected}
            workspace={w}
            orgName={orgName}
            busy={busy}
            onEdit={(f) => {
              setSelected(null);
              setEditing(f);
              setPopup("food");
            }}
            onRequest={async (f) => {
              await mutate(
                { action: "pickup.request", listingId: f.id },
                "Pickup requested. Your partner will review and approve the handoff.",
              );
              setSelected(null);
              navigate("Pickups");
            }}
            onWithdraw={(f) => {
              setSelected(null);
              setConfirm({
                title: "Withdraw this listing?",
                text: "Pending requests will be declined and their receiving organizations notified. Approved pickups must be cancelled from the Pickups screen.",
                input: { action: "listing.withdraw", id: f.id },
                success: "Listing withdrawn.",
              });
            }}
          />
        </Modal>
      )}
      {thread && (
        <Modal
          title="Keep the handoff in the loop"
          eyebrow="PICKUP & CONVERSATION"
          wide
          onClose={() => setThread(null)}
        >
          <PickupThread
            pickup={w.pickups.find((p) => p.id === thread.id) || thread}
            workspace={w}
            orgName={orgName}
            busy={busy}
            onAction={async (input, success) => {
              await mutate(input, success);
            }}
            onCancel={(p) => {
              setThread(null);
              setConfirm({
                title: "Cancel this pickup?",
                text: "Your partner will be notified. Any reserved receiving capacity will be released.",
                input: { action: "pickup.cancel", id: p.id },
                success: "Pickup cancelled and receiving capacity released.",
              });
            }}
          />
        </Modal>
      )}
      {connectionTarget && (
        <Modal
          title={`Connect with ${connectionTarget.name}`}
          eyebrow="PARTNERSHIP REQUEST"
          onClose={() => setConnectionTarget(null)}
        >
          <ConnectionForm
            busy={busy}
            onSubmit={async (note) => {
              await mutate(
                {
                  action: "partnership.request",
                  organizationId: connectionTarget.id,
                  note,
                },
                "Partnership request sent. You’ll be notified when they respond.",
              );
              setConnectionTarget(null);
            }}
          />
        </Modal>
      )}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p className="live-modal-copy">{confirm.text}</p>
          <div className="live-card-actions">
            <button className="btn" onClick={() => setConfirm(null)}>
              Keep as is
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                try {
                  await mutate(confirm.input, confirm.success);
                  setConfirm(null);
                } catch (e) {
                  notice((e as Error).message, true);
                }
              }}
            >
              Confirm{busy && <LoaderCircle size={15} className="spin" />}
            </button>
          </div>
        </Modal>
      )}
      {recovery && (
        <RecoveryModal
          code={recovery}
          onClose={() => {
            setRecovery("");
            if (!me.discoverable) setPopup("profile");
          }}
        />
      )}
      {emailModal}
      {popup === "guide" && (
        <Modal
          title="Good food. Clear decisions."
          eyebrow="HOW THE SHARED APP WORKS"
          wide
          onClose={() => setPopup(null)}
        >
          <div className="methodology-grid">
            <div>
              <Users size={23} />
              <h3>Connect first</h3>
              <p>
                Create your organization profile and opt into the directory.
                Both organizations must accept a partnership before shared food
                can be requested. Your login email stays private.
              </p>
            </div>
            <div>
              <ShieldCheck size={23} />
              <h3>Verify the actual food</h3>
              <p>
                Donors verify quantity, handling, dietary labels, allergens,
                location, and dates. Unknown allergens block publication. The
                app cannot certify food safety; follow donor and partner
                procedures.
              </p>
            </div>
            <div>
              <Truck size={23} />
              <h3>Coordinate the pickup</h3>
              <p>
                The receiver requests food. The donor approves after storage,
                diet, receiving hours, and remaining capacity checks. Approval
                reserves the batch and receiving capacity together. Use the
                private pickup conversation to coordinate.
              </p>
            </div>
            <div>
              <Leaf size={23} />
              <h3>Confirm what happened</h3>
              <p>
                The receiving organization confirms collection after the agreed
                window starts. That creates a receipt and adds donor-reported
                weight to the impact report. Meal equivalents use an
                illustrative 0.5 kg assumption.
              </p>
            </div>
          </div>
          <div className="notice">
            <Info size={17} />
            <span>
              Notifications are delivered inside the app, with automatic refresh
              while it is open. No email or SMS delivery is claimed. Email
              ownership is not verified; never treat a profile as proof of an
              organization’s affiliation.
            </span>
          </div>
          <a className="text-btn" href="/demo">
            Explore the isolated sample demo
            <ArrowUpRight size={15} />
          </a>
        </Modal>
      )}
      {toast && (
        <div
          className={"toast " + (toastError ? "error" : "")}
          role={toastError ? "alert" : "status"}
        >
          {toastError ? <AlertTriangle size={18} /> : <CheckCheck size={18} />}
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function Landing({ onAuth }: { onAuth: (mode: AuthMode) => void }) {
  return (
    <div className="live-landing">
      <header>
        <Logo />
        <div>
          <a href="/demo">
            Explore the demo
            <ArrowUpRight size={14} />
          </a>
          <button className="btn" onClick={() => onAuth("login")}>
            Sign in
          </button>
          <button className="btn primary" onClick={() => onAuth("signup")}>
            Create account
            <ArrowRight size={15} />
          </button>
        </div>
      </header>
      <main>
        <div className="landing-hero">
          <div>
            <p className="eyebrow">
              <span className="live-dot" />A LITTLE COORDINATION. A LOT OF GOOD.
            </p>
            <h1>
              Good food.
              <br />
              <span>Greater impact.</span>
            </h1>
            <p>
              Connect campus surplus with the people who can put it to good use.
              Find community partners, coordinate pickups, and close the loop on
              food waste.
            </p>
            <div className="landing-cta">
              <button className="btn primary" onClick={() => onAuth("signup")}>
                Start your rescue loop
                <ArrowUpRight size={18} />
              </button>
              <button className="text-btn" onClick={() => onAuth("login")}>
                Already in the loop? Sign in
                <ArrowRight size={15} />
              </button>
            </div>
            <span className="landing-trust">
              <ShieldCheck size={17} />
              Human decisions. Real connections. Traceable collections.
            </span>
          </div>
          <div className="landing-art">
            <div className="landing-circle">
              <Sprout size={90} />
              <span>
                <HeartHandshake size={50} />
              </span>
            </div>
            <div className="landing-floating first">
              <span className="small-icon sage">
                <PackageOpen size={21} />
              </span>
              <div>
                <strong>Surplus has a second chapter.</strong>
                <p>From your campus to your community.</p>
              </div>
            </div>
            <div className="landing-floating second">
              <span className="small-icon peach">
                <CheckCheck size={22} />
              </span>
              <div>
                <strong>Close the loop, together.</strong>
                <p>Every collection has a receipt.</p>
              </div>
            </div>
            <span className="landing-orbit a" />
            <span className="landing-orbit b" />
          </div>
        </div>
        <section className="landing-steps">
          {[
            {
              n: "01",
              icon: PackageOpen,
              title: "Share what’s available",
              text: "Post surplus with clear pickup dates, verified allergens, and handling details.",
            },
            {
              n: "02",
              icon: Users,
              title: "Build your community",
              text: "Find local organizations and form partnerships by mutual agreement.",
            },
            {
              n: "03",
              icon: Truck,
              title: "Make the handoff happen",
              text: "Request, approve, coordinate, and confirm pickups in one shared place.",
            },
          ].map(({ n, icon: Icon, title, text }) => (
            <article key={n}>
              <span>
                {n}
                <Icon size={23} />
              </span>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </section>
        <section className="landing-join">
          <Leaf size={29} />
          <div>
            <h2>A little less waste. A lot more possibility.</h2>
            <p>
              For campus dining teams, food pantries, and community kitchens.
            </p>
          </div>
          <button className="btn primary" onClick={() => onAuth("signup")}>
            Join RescueLoop
            <ArrowRight size={16} />
          </button>
        </section>
        <footer>
          <Logo small />
          <span>Good food belongs in the community.</span>
          <span>Built for responsible campus food rescue.</span>
        </footer>
      </main>
    </div>
  );
}
function AuthForm({
  mode,
  setMode,
  onSuccess,
}: {
  mode: AuthMode;
  setMode: (m: AuthMode) => void;
  onSuccess: (recoveryCode?: string) => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setMessage("");
    setError("");
  }, [mode]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await api({
        action: mode === "forgot" ? "auth.email.request-reset" : `auth.${mode}`,
        ...data,
      });
      if (mode === "forgot") {
        setMessage(
          result.message || "Check your inbox for a password reset link.",
        );
        return;
      }
      await onSuccess(result.recoveryCode);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="live-auth-form" onSubmit={submit}>
      <p className="editor-intro">
        {mode === "signup"
          ? "Your email and password sign you into RescueLoop. Create an organization to connect with your community."
          : mode === "recover"
            ? "Use the recovery code saved when you created your account."
            : mode === "forgot"
              ? "Request an email reset link for your verified address, or recover using your saved code."
              : "Sign in with your RescueLoop email and password to continue."}
      </p>
      {mode === "signup" && (
        <>
          <label className="field">
            Your name
            <input
              name="displayName"
              autoComplete="name"
              minLength={2}
              maxLength={80}
              required
            />
          </label>
          <label className="field">
            Organization name
            <input
              name="organizationName"
              autoComplete="organization"
              minLength={2}
              maxLength={140}
              required
              placeholder="e.g. Campus Community Pantry"
            />
          </label>
          <div className="form-grid">
            <label className="field">
              Your role
              <select name="role" defaultValue="both">
                <option value="donor">Donate surplus food</option>
                <option value="receiver">Receive food</option>
                <option value="both">Donate and receive</option>
              </select>
            </label>
            <label className="field">
              City or campus
              <input
                name="area"
                maxLength={160}
                minLength={2}
                required
                placeholder="e.g. San José"
                autoComplete="address-level2"
              />
            </label>
          </div>
        </>
      )}
      <label className="field">
        Email address
        <input
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
        />
      </label>
      {mode === "recover" && (
        <label className="field">
          Recovery code
          <input
            name="recoveryCode"
            autoComplete="off"
            minLength={20}
            maxLength={100}
            required
            spellCheck={false}
          />
        </label>
      )}
      {mode !== "forgot" && (
        <label className="field">
          {mode === "recover" ? "New password" : "Password"}
          <span className="live-password">
            <input
              name="password"
              type={show ? "text" : "password"}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={15}
              maxLength={128}
              required
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={show ? "Hide password" : "Show password"}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
          <small>
            {mode === "login"
              ? "Enter your account passphrase."
              : "Use a unique passphrase of at least 15 characters."}
          </small>
        </label>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <ErrorNote text={error} />
      <button className="btn primary full" disabled={busy}>
        {busy ? (
          <LoaderCircle size={17} className="spin" />
        ) : (
          <ArrowRight size={17} />
        )}{" "}
        {mode === "signup"
          ? "Create account"
          : mode === "recover"
            ? "Recover account"
            : mode === "forgot"
              ? "Send reset link"
              : "Sign in"}
      </button>
      <div className="live-auth-links">
        {mode !== "login" && (
          <button
            type="button"
            className="text-btn"
            onClick={() => setMode("login")}
          >
            Back to sign in
          </button>
        )}
        {mode === "login" && (
          <>
            <button
              type="button"
              className="text-btn"
              onClick={() => setMode("signup")}
            >
              Create an account
            </button>
            <button
              type="button"
              className="text-btn"
              onClick={() => setMode("forgot")}
            >
              Forgot password?
            </button>
          </>
        )}
        {(mode === "forgot" || mode === "recover") && (
          <button
            type="button"
            className="text-btn"
            onClick={() => setMode(mode === "forgot" ? "recover" : "forgot")}
          >
            {mode === "forgot"
              ? "Use a recovery code"
              : "Send an email reset link"}
          </button>
        )}
      </div>
      {mode === "signup" && (
        <p className="modal-note">
          Your login email is private. You choose whether your organization
          appears in the partner directory. Profiles are self-reported and do
          not establish verified affiliation.
        </p>
      )}
    </form>
  );
}
function EmailActionModal({
  action,
  onClose,
}: {
  action: { purpose: "verify" | "reset"; token: string };
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [code, setCode] = useState("");
  if (code) return <RecoveryModal code={code} onClose={onClose} />;
  return (
    <Modal
      title={
        action.purpose === "verify"
          ? "Verify your email"
          : "Choose a new password"
      }
      eyebrow="YOUR RESCUELOOP ACCOUNT"
      onClose={onClose}
    >
      {done ? (
        <>
          <p className="notice">
            Your email is verified. Sign in and enable email updates in
            Notifications.
          </p>
          <button className="btn primary" onClick={onClose}>
            Continue to RescueLoop
          </button>
        </>
      ) : (
        <form
          className="live-auth-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              const result = await api({
                action: `auth.email.${action.purpose}`,
                token: action.token,
                ...(action.purpose === "reset"
                  ? { password: data.get("password") }
                  : {}),
              });
              if (result.recoveryCode) setCode(result.recoveryCode);
              else setDone(true);
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            {action.purpose === "verify"
              ? "Confirm that this is your email address. This does not sign you in or enable notifications automatically."
              : "This link works once and expires after 30 minutes. Resetting signs out all previous sessions."}
          </p>
          {action.purpose === "reset" && (
            <label className="field">
              New password
              <input
                type="password"
                name="password"
                required
                minLength={15}
                maxLength={128}
                autoComplete="new-password"
              />
              <small>Use a unique passphrase of at least 15 characters.</small>
            </label>
          )}
          <ErrorNote text={error} />
          <button className="btn primary" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <ShieldCheck size={17} />
            )}{" "}
            {action.purpose === "verify" ? "Verify email" : "Reset password"}
          </button>
        </form>
      )}
    </Modal>
  );
}
function RecoveryModal({
  code,
  onClose,
}: {
  code: string;
  onClose: () => void;
}) {
  const [saved, setSaved] = useState(false),
    [copied, setCopied] = useState(false);
  return (
    <Modal
      title="Keep your way back in"
      eyebrow="SAVE YOUR RECOVERY CODE"
      onClose={() => {
        if (saved) onClose();
      }}
    >
      <div className="notice">
        <KeyRound size={20} />
        <span>
          This code can recover your account if you forget your password. Store
          it somewhere private. It is shown only once, and using it replaces it
          with a new code.
        </span>
      </div>
      <code className="live-recovery-code">{code}</code>
      <div className="live-card-actions">
        <button
          className="btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          <Copy size={15} />
          {copied ? "Copied" : "Copy code"}
        </button>
        <button
          className="btn"
          onClick={() =>
            downloadText(
              "rescueloop-recovery-code.txt",
              `RescueLoop recovery code\n\n${code}\n\nKeep this private. This code can reset your password.\n`,
              "text/plain",
            )
          }
        >
          <Download size={15} />
          Save code file
        </button>
      </div>
      <label className="verification-check">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
        />
        <span>
          <strong>I saved my recovery code somewhere private.</strong>
          <small>
            This code works even when email recovery is unavailable.
          </small>
        </span>
      </label>
      <button className="btn primary full" disabled={!saved} onClick={onClose}>
        Continue to my workspace
        <ArrowRight size={16} />
      </button>
    </Modal>
  );
}
function ListingRow({
  listing: f,
  owner,
  mine,
  onOpen,
}: {
  listing: Listing;
  owner: string;
  mine: boolean;
  onOpen: () => void;
}) {
  const expired =
    Date.parse(f.endAt) <= Date.now() &&
    ["review", "available"].includes(f.status);
  return (
    <button className="live-listing-row" onClick={onOpen}>
      <FoodArt food={f} />
      <span className="live-listing-main">
        <strong>{f.name}</strong>
        <small>
          {owner}
          {mine ? " · Your organization" : ""}
        </small>
        <span>
          {f.category} · {f.storage} · {formatKg(f.kg)} kg
        </span>
      </span>
      <span className="live-listing-window">
        <span>
          <Clock size={13} />
          {dateTime(f.endAt)}
        </span>
        <Badge tone={expired ? "gray" : stateTone(f.status)}>
          {expired ? "Expired" : stateLabel(f.status)}
        </Badge>
      </span>
      <ArrowUpRight size={18} />
    </button>
  );
}
function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: `${type};charset=utf-8` }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function LiveFoodForm({
  existing,
  provider,
  onSave,
  onImport,
}: {
  existing: Listing | null;
  provider: boolean;
  onSave: (listing: Record<string, unknown>) => Promise<void>;
  onImport: (listings: Record<string, unknown>[]) => Promise<void>;
}) {
  const [tab, setTab] = useState(existing ? "details" : "notes"),
    [note, setNote] = useState(""),
    [date, setDate] = useState(initialDate().slice(0, 10)),
    [csv, setCsv] = useState(""),
    [error, setError] = useState(""),
    [info, setInfo] = useState(""),
    [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Partial<Listing>>(
    existing || {
      name: "",
      category: "Prepared meals",
      kg: undefined,
      storage: "Chilled",
      diet: [],
      allergens: "unknown",
      pickupLocation: "",
      startAt: initialDate(),
      endAt: initialDate(new Date(Date.now() + 3 * 3600000).toISOString()),
      verified: false,
      source: "",
    },
  );
  function change(key: string, value: unknown) {
    setDraft((d) => ({
      ...d,
      [key]: value,
      ...(key !== "verified" ? { verified: false } : {}),
    }));
    setError("");
  }
  async function extract() {
    setBusy(true);
    setError("");
    try {
      if (!note.trim()) throw new Error("Paste a donor note first.");
      let extracted: Partial<Food>;
      if (provider) {
        const r = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        });
        const result = (await r.json()) as {
          draft?: Partial<Food>;
          error?: string;
        };
        if (!r.ok || !result.draft)
          throw new Error(
            result.error ||
              "Extraction failed. You can enter the details manually.",
          );
        extracted = result.draft;
      } else extracted = parseNote(note);
      setDraft({
        name: extracted.name || "",
        category: extracted.category,
        kg: extracted.kg,
        storage: extracted.storage,
        diet: extracted.diet || [],
        allergens: extracted.allergens || "unknown",
        pickupLocation: extracted.location || "",
        startAt: extracted.start ? `${date}T${extracted.start}` : "",
        endAt: extracted.end ? `${date}T${extracted.end}` : "",
        verified: false,
        source: note,
      });
      setInfo(
        provider
          ? "IBM watsonx.ai created this draft. Check every field against the donor’s note."
          : "The offline rule-based parser structured this note. Missing facts need a human check.",
      );
      setTab("details");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSave({
        ...draft,
        startAt: new Date(draft.startAt!).toISOString(),
        endAt: new Date(draft.endAt!).toISOString(),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importCSV() {
    setError("");
    setBusy(true);
    try {
      const parsed = parseInventoryCSV(csv);
      if (parsed.length > 30)
        throw new Error("Import up to 30 listings per batch.");
      await onImport(
        parsed.map((f) => ({
          name: f.name,
          kg: f.kg,
          category: f.category,
          pickupLocation: f.location,
          storage: f.storage,
          diet: f.diet,
          allergens: f.allergens,
          verified: false,
          source: f.source,
          startAt: new Date(`${date}T${f.start}`).toISOString(),
          endAt: new Date(`${date}T${f.end}`).toISOString(),
        })),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="editor live-form">
      <p className="editor-intro">
        Food is shared with accepted partners after you verify the donor
        details. Your original notes stay private to your organization.
      </p>
      {!existing && (
        <div className="tabs editor-tabs">
          {[
            ["notes", "From a note"],
            ["details", "Enter details"],
            ["csv", "Import CSV"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              disabled={busy}
              className={tab === key ? "selected" : ""}
              onClick={() => {
                setTab(key);
                setError("");
              }}
            >
              {key === "notes" ? (
                <Sparkles size={14} />
              ) : key === "csv" ? (
                <Download size={14} />
              ) : (
                <FileText size={14} />
              )}{" "}
              {label}
            </button>
          ))}
        </div>
      )}
      {tab === "notes" && (
        <>
          <div className="parser-status">
            <span className="live-dot" />
            {provider
              ? "IBM watsonx.ai configured"
              : "Offline rule-based parser"}
            <span>Human verification required</span>
          </div>
          <label className="field">
            Pickup date
            <input
              type="date"
              required
              value={date}
              onInput={(e) => setDate(e.currentTarget.value)}
            />
          </label>
          <label className="field">
            What’s available?
            <textarea
              maxLength={6000}
              rows={6}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={SAMPLE_NOTE}
            />
          </label>
          <div className="editor-helper">
            <button
              className="text-btn"
              type="button"
              onClick={() => setNote(SAMPLE_NOTE)}
            >
              Use an example note
              <RefreshCw size={13} />
            </button>
            <span>{note.length}/6,000</span>
          </div>
          <div className="notice">
            <Info size={17} />
            <span>
              {provider
                ? "Only the note is sent to IBM for extraction. Avoid personal or sensitive information. The draft cannot verify food safety."
                : "No model is connected. The parser reads explicit labels and leaves missing facts for you to check."}
            </span>
          </div>
          <button
            className="btn primary full"
            disabled={busy}
            type="button"
            onClick={extract}
          >
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Sparkles size={16} />
            )}
            Structure note & review
          </button>
        </>
      )}
      {tab === "details" && (
        <form onSubmit={save}>
          {info && (
            <div className="notice">
              <Sparkles size={17} />
              <span>{info}</span>
            </div>
          )}
          {draft.source && (
            <details className="source-note">
              <summary>Original donor note</summary>
              <p>{draft.source}</p>
            </details>
          )}
          <div className="form-grid">
            <label className="field span-2">
              Food name
              <input
                value={draft.name || ""}
                required
                minLength={2}
                maxLength={140}
                onChange={(e) => change("name", e.target.value)}
              />
            </label>
            <label className="field">
              Weight (kg)
              <input
                value={draft.kg ?? ""}
                type="number"
                min="0.01"
                max="10000"
                step="0.01"
                required
                onChange={(e) =>
                  change(
                    "kg",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
              />
            </label>
            <label className="field">
              Category
              <select
                value={draft.category || ""}
                required
                onChange={(e) => change("category", e.target.value)}
              >
                <option value="" disabled>
                  Choose category
                </option>
                {FOOD_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field span-2">
              Pickup location
              <input
                value={draft.pickupLocation || ""}
                required
                minLength={2}
                maxLength={250}
                onChange={(e) => change("pickupLocation", e.target.value)}
              />
              <small>
                Visible to accepted partners who can view this listing.
              </small>
            </label>
            <label className="field">
              Pickup starts
              <input
                type="datetime-local"
                value={
                  draft.startAt
                    ? draft.startAt.endsWith("Z")
                      ? initialDate(draft.startAt)
                      : draft.startAt
                    : ""
                }
                required
                onInput={(e) => change("startAt", e.currentTarget.value)}
              />
            </label>
            <label className="field">
              Pickup ends
              <input
                type="datetime-local"
                value={
                  draft.endAt
                    ? draft.endAt.endsWith("Z")
                      ? initialDate(draft.endAt)
                      : draft.endAt
                    : ""
                }
                required
                onInput={(e) => change("endAt", e.currentTarget.value)}
              />
            </label>
            <label className="field">
              Storage & handling
              <select
                value={draft.storage || ""}
                required
                onChange={(e) => change("storage", e.target.value)}
              >
                <option value="" disabled>
                  Choose storage
                </option>
                {FOOD_STORAGE.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Verified dietary label
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
                <option value="vegan">Vegan</option>
                <option value="vegetarian">Vegetarian</option>
              </select>
            </label>
            <label className="field span-2">
              Declared allergens
              <input
                value={draft.allergens || ""}
                required
                maxLength={300}
                onChange={(e) => change("allergens", e.target.value)}
                placeholder="e.g. soy, wheat — or none declared"
              />
              <small>
                Use “unknown” until confirmed with the donor. Unknowns cannot be
                published as available.
              </small>
            </label>
          </div>
          <label className="verification-check">
            <input
              type="checkbox"
              checked={!!draft.verified}
              onChange={(e) => change("verified", e.target.checked)}
            />
            <span>
              <strong>I checked the actual food and donor details.</strong>
              <small>
                Quantity, allergens, storage, dietary claims, pickup location,
                and dates are accurate. Handling follows our organization’s food
                safety procedures.
              </small>
            </span>
            <ShieldCheck size={21} />
          </label>
          <p className="modal-note">
            Times use your device’s time zone:{" "}
            {Intl.DateTimeFormat().resolvedOptions().timeZone}. Keep your
            organization’s receiving time zone current.
          </p>
          <button className="btn primary full" disabled={busy}>
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Check size={16} />
            )}{" "}
            {draft.verified
              ? "Publish verified listing"
              : "Save for human review"}
          </button>
        </form>
      )}
      {tab === "csv" && (
        <>
          <p className="editor-intro">
            Use the template columns below. All imported food starts in review.
            Up to 30 listings are saved together in one batch.
          </p>
          <label className="field">
            Pickup date for this import
            <input
              type="date"
              value={date}
              required
              onInput={(e) => setDate(e.currentTarget.value)}
            />
          </label>
          <label className="upload-zone">
            <Download size={26} />
            <strong>Choose an inventory CSV</strong>
            <span>or paste it below · up to 1 MB</span>
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="Upload inventory CSV"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 1000000) {
                    setError("Choose a file under 1 MB.");
                    return;
                  }
                  setCsv(await file.text());
                }
              }}
            />
          </label>
          <label className="field">
            Inventory CSV
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={5}
              placeholder={INVENTORY_CSV}
            />
          </label>
          <div className="editor-helper">
            <button
              className="text-btn"
              onClick={() =>
                downloadText(
                  "rescueloop-inventory-template.csv",
                  INVENTORY_CSV,
                  "text/csv",
                )
              }
            >
              Download template
              <Download size={13} />
            </button>
            <span>Times are in your device’s time zone</span>
          </div>
          <button
            className="btn primary full"
            disabled={busy}
            onClick={importCSV}
          >
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <PackageOpen size={16} />
            )}
            Import for review
          </button>
        </>
      )}
      <ErrorNote text={error} />
    </div>
  );
}

function OrganizationForm({
  organization: o,
  onSave,
}: {
  organization: Organization;
  onSave: (o: Organization) => Promise<void>;
}) {
  const [draft, setDraft] = useState(o),
    [allergenText, setAllergenText] = useState(o.excludedAllergens.join(", ")),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const update = (key: string, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }));
  return (
    <form
      className="live-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
          await onSave({
            ...draft,
            excludedAllergens: allergenText
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          });
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="editor-intro">
        Tell partners what you do, where you are, and what you can safely
        receive. Publishing makes this profile visible to signed-in
        organizations.
      </p>
      <div className="form-grid">
        <label className="field span-2">
          Organization name
          <input
            required
            minLength={2}
            maxLength={140}
            value={draft.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </label>
        <label className="field">
          Organization role
          <select
            value={draft.role}
            onChange={(e) => update("role", e.target.value)}
          >
            <option value="donor">Donate food</option>
            <option value="receiver">Receive food</option>
            <option value="both">Donate & receive</option>
          </select>
        </label>
        <label className="field">
          City or campus
          <input
            required
            minLength={2}
            maxLength={160}
            value={draft.area}
            onChange={(e) => update("area", e.target.value)}
          />
        </label>
        <label className="field span-2">
          About your organization
          <textarea
            rows={3}
            maxLength={1000}
            value={draft.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Tell your community a little about your pantry, kitchen, or dining team."
          />
        </label>
        <label className="field">
          Daily receiving capacity (kg)
          <input
            type="number"
            min="0"
            max="10000"
            step="0.01"
            required
            value={draft.capacityKg}
            onChange={(e) => update("capacityKg", Number(e.target.value))}
          />
        </label>
        <label className="field">
          Receiving time zone
          <input
            required
            value={draft.timezone}
            list="time-zones"
            onChange={(e) => update("timezone", e.target.value)}
          />
          <datalist id="time-zones">
            {[
              "America/Los_Angeles",
              "America/Denver",
              "America/Chicago",
              "America/New_York",
              "America/Toronto",
              "Europe/London",
              "UTC",
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </datalist>
        </label>
        <label className="field">
          Receiving starts daily
          <input
            type="time"
            required
            value={draft.receivingStart}
            onInput={(e) => update("receivingStart", e.currentTarget.value)}
          />
        </label>
        <label className="field">
          Receiving ends daily
          <input
            type="time"
            required
            value={draft.receivingEnd}
            onInput={(e) => update("receivingEnd", e.currentTarget.value)}
          />
        </label>
        <fieldset className="checkbox-field span-2">
          <legend>Storage you can provide</legend>
          {FOOD_STORAGE.map((s) => (
            <label key={s}>
              <input
                type="checkbox"
                checked={draft.storage.includes(s)}
                onChange={(e) =>
                  update(
                    "storage",
                    e.target.checked
                      ? [...draft.storage, s]
                      : draft.storage.filter((v) => v !== s),
                  )
                }
              />
              {s}
            </label>
          ))}
        </fieldset>
        <fieldset className="checkbox-field span-2">
          <legend>Accepted food categories</legend>
          {FOOD_CATEGORIES.map((c) => (
            <label key={c}>
              <input
                type="checkbox"
                checked={draft.categories.includes(c)}
                onChange={(e) =>
                  update(
                    "categories",
                    e.target.checked
                      ? [...draft.categories, c]
                      : draft.categories.filter((v) => v !== c),
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
          Allergens you cannot accept
          <input
            value={allergenText}
            maxLength={1000}
            onChange={(e) => setAllergenText(e.target.value)}
            placeholder="e.g. peanuts, milk"
          />
          <small>Separate restrictions with commas.</small>
        </label>
      </div>
      {draft.role !== "donor" && (
        <label className="verification-check">
          <input
            type="checkbox"
            checked={draft.accepting}
            onChange={(e) => update("accepting", e.target.checked)}
          />
          <span>
            <strong>We are accepting food pickups.</strong>
            <small>
              Pause this whenever capacity or staffing changes. Approved pickups
              remain reserved until cancelled or collected.
            </small>
          </span>
        </label>
      )}
      <label className="verification-check">
        <input
          type="checkbox"
          checked={draft.discoverable}
          onChange={(e) => update("discoverable", e.target.checked)}
        />
        <span>
          <strong>Publish our profile in the partner directory.</strong>
          <small>
            Signed-in RescueLoop organizations can view this profile and request
            a partnership. Your sign-in email stays private.
          </small>
        </span>
      </label>
      <ErrorNote text={error} />
      <button className="btn primary full" disabled={busy}>
        {busy ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <Check size={16} />
        )}
        Save organization profile
      </button>
    </form>
  );
}

function ListingDetails({
  listing: f,
  workspace: w,
  orgName,
  busy,
  onEdit,
  onRequest,
  onWithdraw,
}: {
  listing: Listing;
  workspace: Workspace;
  orgName: (id: string) => string;
  busy: boolean;
  onEdit: (f: Listing) => void;
  onRequest: (f: Listing) => Promise<void>;
  onWithdraw: (f: Listing) => void;
}) {
  const me = w.organization,
    mine = f.ownerId === me.id;
  const existing = w.pickups.find(
    (p) =>
      p.listingId === f.id &&
      p.receiverId === me.id &&
      ["requested", "approved", "collected"].includes(p.status),
  );
  const window = receivingWindow(f, me);
  const used = window ? usedOnDay(me.id, window.day, w.pickups, w.listings) : 0;
  const check = matchEligibility(
    f,
    me,
    used,
    isConnected(me.id, f.ownerId, w.partnerships),
  );
  const [error, setError] = useState("");
  return (
    <div className="live-listing-details">
      <div className="live-food-title">
        <FoodArt food={f} />
        <div>
          <h3>{orgName(f.ownerId)}</h3>
          <p>
            {formatKg(f.kg)} kg · {f.category} · {f.storage}
          </p>
        </div>
        <Badge tone={stateTone(f.status)}>{stateLabel(f.status)}</Badge>
      </div>
      <dl className="live-detail-grid">
        <div>
          <dt>Pickup starts</dt>
          <dd>{dateTime(f.startAt)}</dd>
        </div>
        <div>
          <dt>Pickup ends</dt>
          <dd>{dateTime(f.endAt)}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{f.pickupLocation}</dd>
        </div>
        <div>
          <dt>Dietary labels</dt>
          <dd>{f.diet.join(", ") || "No dietary claim"}</dd>
        </div>
        <div className="span-2">
          <dt>Declared allergens</dt>
          <dd>{f.allergens}</dd>
        </div>
      </dl>
      {mine ? (
        <>
          <div className="notice">
            <ShieldCheck size={17} />
            <span>
              {f.verified
                ? "You verified the donor details. Connected partners can request this food while it is available."
                : "This listing needs your review. It is not available to receiving partners."}
            </span>
          </div>
          {["review", "available"].includes(f.status) && (
            <div className="live-card-actions">
              <button className="btn" onClick={() => onWithdraw(f)}>
                Withdraw listing
              </button>
              <button className="btn primary" onClick={() => onEdit(f)}>
                Review & edit
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </>
      ) : existing ? (
        <div className="notice">
          <Truck size={17} />
          <span>
            {existing.status === "requested"
              ? "Your request is waiting for donor approval."
              : existing.status === "approved"
                ? "Your pickup is approved and receiving capacity is reserved."
                : "This collection is already confirmed."}{" "}
            Open Pickups to coordinate the handoff.
          </span>
        </div>
      ) : (
        <>
          <div className={"live-eligibility " + (check.ok ? "eligible" : "")}>
            <h3>
              {check.ok
                ? "A good fit, with clear reasons"
                : "A little coordination is needed"}
            </h3>
            {(check.ok ? check.reasons : check.blocked).map((reason) => (
              <p key={reason}>
                {check.ok ? <Check size={15} /> : <Info size={15} />}
                <span>{reason}</span>
              </p>
            ))}
            {check.window && (
              <small>
                Overlapping window: {dateTime(check.window.start)}–
                {dateTime(check.window.end)}
              </small>
            )}
          </div>
          <button
            className="btn primary full"
            disabled={busy || !check.ok}
            onClick={async () => {
              try {
                await onRequest(f);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Truck size={16} />
            Request this pickup
          </button>
        </>
      )}
      <ErrorNote text={error} />
    </div>
  );
}

function ConnectionForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState(""),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          await onSubmit(note);
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <p className="live-modal-copy">
        Introduce your organization. This request appears in their RescueLoop
        notifications; the partnership becomes active when they accept.
      </p>
      <label className="field">
        A short introduction (optional)
        <textarea
          rows={4}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Hi! We’d love to coordinate food rescues with your team."
        />
      </label>
      <ErrorNote text={error} />
      <button className="btn primary full" disabled={busy}>
        <Send size={16} />
        Send partnership request
      </button>
    </form>
  );
}

function PickupThread({
  pickup: p,
  workspace: w,
  orgName,
  busy,
  onAction,
  onCancel,
}: {
  pickup: Pickup;
  workspace: Workspace;
  orgName: (id: string) => string;
  busy: boolean;
  onAction: (input: Record<string, unknown>, success: string) => Promise<void>;
  onCancel: (p: Pickup) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]),
    [body, setBody] = useState(""),
    [error, setError] = useState(""),
    [sending, setSending] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const f = w.listings.find((f) => f.id === p.listingId),
    receiving = p.receiverId === w.organization.id;
  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/live?thread=${encodeURIComponent(p.id)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as {
        messages: Message[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || "Conversation could not be loaded.");
      setMessages(data.messages);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [p.id]);
  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (!document.hidden) load();
    }, 10000);
    return () => clearInterval(interval);
  }, [load]);
  async function change(action: string, success: string) {
    setError("");
    try {
      await onAction({ action, id: p.id }, success);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!f) return <ErrorNote text="This listing is no longer available." />;
  const closed = ["declined", "cancelled"].includes(p.status);
  return (
    <div className="live-thread">
      <div className="live-food-title">
        <FoodArt food={f} />
        <div>
          <h3>{f.name}</h3>
          <p>
            {formatKg(f.kg)} kg · {orgName(p.donorId)} → {orgName(p.receiverId)}
          </p>
        </div>
        <Badge tone={stateTone(p.status)}>{stateLabel(p.status)}</Badge>
      </div>
      <div className="live-thread-summary">
        <p>
          <CalendarDays size={16} />
          {dateTime(p.windowStart)}–{dateTime(p.windowEnd)}
        </p>
        <p>
          <MapPin size={16} />
          {f.pickupLocation}
        </p>
        <p>
          <ShieldCheck size={16} />
          {f.storage} · Declared allergens: {f.allergens}
        </p>
      </div>
      {p.status === "requested" && !receiving && (
        <div className="live-card-actions">
          <button
            className="btn"
            disabled={busy}
            onClick={() => change("pickup.decline", "Pickup request declined.")}
          >
            Decline request
          </button>
          <button
            className="btn primary"
            disabled={busy}
            onClick={() =>
              change("pickup.approve", "Pickup approved and capacity reserved.")
            }
          >
            <Check size={15} />
            Approve pickup
          </button>
        </div>
      )}
      {p.status === "approved" && receiving && (
        <div className="live-confirm-receipt">
          <label className="verification-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              <strong>
                I received the full {formatKg(f.kg)} kg shown above.
              </strong>
              <small>
                Confirm after the physical handoff. This adds the collection to
                both organizations’ impact reports.
              </small>
            </span>
          </label>
          <button
            className="btn primary full"
            disabled={
              busy || !confirmed || Date.now() < Date.parse(p.windowStart)
            }
            onClick={() =>
              change(
                "pickup.collect",
                "Collection confirmed. Your receipt and impact report are ready.",
              )
            }
          >
            <CheckCheck size={16} />
            Confirm collection
          </button>
          {Date.now() < Date.parse(p.windowStart) && (
            <p className="modal-note">
              Confirmation opens when the pickup window starts.
            </p>
          )}
        </div>
      )}
      {p.status === "collected" && (
        <div className="live-receipt">
          <CheckCheck size={23} />
          <div>
            <strong>Collection confirmed</strong>
            <p>{p.collectedAt ? dateTime(p.collectedAt) : ""}</p>
            <code>{p.receipt}</code>
          </div>
          <button
            className="btn"
            onClick={() =>
              downloadText(
                `${p.receipt}.txt`,
                `RescueLoop collection receipt\nReference: ${p.receipt}\nFood: ${f.name}\nDonor-reported weight: ${f.kg} kg\nDonor: ${orgName(p.donorId)}\nReceiver: ${orgName(p.receiverId)}\nCollection confirmed: ${p.collectedAt}\nEstimated meal equivalents (0.5 kg/meal): ${Math.floor(f.kg / 0.5)}\n`,
                "text/plain",
              )
            }
          >
            <Download size={15} />
            Receipt
          </button>
        </div>
      )}
      <div className="live-thread-heading">
        <h3>
          <MessageCircle size={17} />
          Pickup conversation
        </h3>
        <span>Only the two participating organizations</span>
      </div>
      <div className="live-messages" aria-live="polite">
        {messages.length ? (
          messages.map((m) => (
            <div
              key={m.id}
              className={
                "live-message " +
                (m.authorId === w.organization.id ? "own" : "")
              }
            >
              <strong>
                {m.authorId === w.organization.id ? "You" : orgName(m.authorId)}
              </strong>
              <p>{m.body}</p>
              <small>{ago(m.createdAt)}</small>
            </div>
          ))
        ) : (
          <p className="live-no-messages">
            Share an entrance, arrival time, or handoff detail here.
          </p>
        )}
      </div>
      {closed ? (
        <p className="modal-note">
          This conversation is read-only because the pickup is {p.status}.
        </p>
      ) : (
        <form
          className="live-message-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setSending(true);
            setError("");
            try {
              await api({ action: "message.send", pickupId: p.id, body });
              setBody("");
              await load();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setSending(false);
            }
          }}
        >
          <label className="field">
            Message your pickup partner
            <textarea
              required
              maxLength={2000}
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="e.g. We’ll arrive at the loading entrance at 3 PM."
            />
          </label>
          <button className="btn primary" disabled={sending || !body.trim()}>
            {sending ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Send size={16} />
            )}
            Send message
          </button>
        </form>
      )}
      <ErrorNote text={error} />
      {["requested", "approved"].includes(p.status) && (
        <div className="live-thread-cancel">
          <button className="text-btn" onClick={() => onCancel(p)}>
            Cancel pickup
          </button>
        </div>
      )}
    </div>
  );
}

function AccountSettings({
  email,
  verified,
  onSubmit,
}: {
  email: string;
  verified: boolean;
  onSubmit: (input: Record<string, unknown>) => Promise<void>;
}) {
  const [tab, setTab] = useState("password"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="live-form">
      <div className="live-account-email">
        <Mail size={19} />
        <div>
          <strong>{email}</strong>
          <p>
            Private sign-in address ·{" "}
            {verified
              ? "email verified"
              : "verify in Notifications to enable email updates and recovery"}
          </p>
        </div>
      </div>
      <div className="tabs editor-tabs">
        <button
          className={tab === "password" ? "selected" : ""}
          onClick={() => {
            setTab("password");
            setError("");
          }}
        >
          Change password
        </button>
        <button
          className={tab === "recovery" ? "selected" : ""}
          onClick={() => {
            setTab("recovery");
            setError("");
          }}
        >
          New recovery code
        </button>
      </div>
      <form
        key={tab}
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          const form = e.currentTarget;
          const data = Object.fromEntries(new FormData(form));
          try {
            await onSubmit(
              tab === "password"
                ? {
                    action: "account.password",
                    currentPassword: data.currentPassword,
                    newPassword: data.newPassword,
                  }
                : {
                    action: "account.recovery",
                    password: data.currentPassword,
                  },
            );
            if (tab === "password") form.reset();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="editor-intro">
          {tab === "password"
            ? "Changing your password signs out your other sessions."
            : "This replaces your current recovery code. Save the new code somewhere private when it appears."}
        </p>
        <label className="field">
          Current password
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            required
          />
        </label>
        {tab === "password" && (
          <label className="field">
            New password
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={15}
              maxLength={128}
              required
            />
            <small>Use a unique passphrase of at least 15 characters.</small>
          </label>
        )}
        <ErrorNote text={error} />
        <button className="btn primary full" disabled={busy}>
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <KeyRound size={16} />
          )}{" "}
          {tab === "password" ? "Update password" : "Replace recovery code"}
        </button>
      </form>
    </div>
  );
}
