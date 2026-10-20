
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Search,
  ShieldCheck,
  Settings,
  Database,
  FileClock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
} from "lucide-react";
import { fetchAuditLogs } from "./api";
import {
  CATEGORIES,
  normalizeRecord,
  getCategoryLabel,
  getCategoryFields,
  matchesSearch,
} from "./auditUtils";
import "./App.css";

const PAGE_SIZE = 10;

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function categoryIcon(category) {
  if (category === "audit.security-events") return <ShieldCheck size={18} />;
  if (category === "audit.configuration") return <Settings size={18} />;
  if (category === "audit.data-access") return <Database size={18} />;
  return <Activity size={18} />;
}

function DetailModal({ record, onClose }) {
  if (!record) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="detail-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="detail-header">
          <div>
            <span className="eyebrow">AUDIT EVENT DETAILS</span>
            <h2>{getCategoryLabel(record.category)}</h2>
            <p>{record.event}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>

        <div className="detail-grid">
          <div className="detail-item">
            <span>Timestamp</span>
            <strong>{formatDate(record.time)}</strong>
          </div>
          <div className="detail-item">
            <span>Actor</span>
            <strong>{record.actor}</strong>
          </div>
          <div className="detail-item">
            <span>Category</span>
            <strong>{getCategoryLabel(record.category)}</strong>
          </div>
          <div className="detail-item">
            <span>IP address</span>
            <strong>{record.ip}</strong>
          </div>
        </div>

        <h3>Category-specific fields</h3>
        <div className="field-list">
          {getCategoryFields(record).map(([label, value]) => (
            <div className="field-row" key={label}>
              <span>{label}</span>
              <strong>{String(value ?? "—")}</strong>
            </div>
          ))}
        </div>

        <details className="raw-details">
          <summary>View original JSON</summary>
          <pre>{JSON.stringify(record.raw, null, 2)}</pre>
        </details>
      </section>
    </div>
  );
}

export default function App() {
  const [rawRecords, setRawRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState(null);

  async function loadLogs() {
    setLoading(true);
    setError("");

    try {
      const result = await fetchAuditLogs();

      if (!Array.isArray(result.records)) {
        throw new Error("The backend response did not contain a records array.");
      }

      setRawRecords(result.records);
      setPage(1);
    } catch (err) {
      setError(err.message || "Unable to load audit records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  const records = useMemo(
    () => rawRecords.map(normalizeRecord),
    [rawRecords]
  );

  const categoryCounts = useMemo(() => {
    const counts = { all: records.length };

    for (const category of CATEGORIES) {
      counts[category] = records.filter(
        (record) => record.category === category
      ).length;
    }

    return counts;
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const categoryMatches =
        activeCategory === "all" || record.category === activeCategory;

      const searchMatches = matchesSearch(record, search);

      const time = new Date(record.time).getTime();
      const start = startDate ? new Date(startDate).getTime() : null;
      const end = endDate
        ? new Date(`${endDate}T23:59:59.999`).getTime()
        : null;

      const startMatches = start === null || time >= start;
      const endMatches = end === null || time <= end;

      return (
        categoryMatches &&
        searchMatches &&
        startMatches &&
        endMatches
      );
    });
  }, [records, activeCategory, search, startDate, endDate]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRecords.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, totalPages);

  const visibleRecords = filteredRecords.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function changeCategory(category) {
    setActiveCategory(category);
    setPage(1);
  }

  function updateSearch(value) {
    setSearch(value);
    setPage(1);
  }

  function applyDates() {
    setPage(1);
    loadLogs();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><ShieldCheck /></div>
          <div>
            <strong>AuditLens</strong>
            <span>SAP AUDIT MONITOR</span>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>
        <div className="nav-item active">
          <Activity size={18} /> Audit overview
        </div>
        <div className="nav-item">
          <FileClock size={18} /> Event explorer
        </div>

        <div className="sidebar-footer">
          <span className="status-dot" />
          SAP API connection
          <small>Local development</small>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">MONITORING / AUDIT LOGS</span>
            <h1>Audit Log Overview</h1>
            <p>Explore security, configuration, access and modification events.</p>
          </div>
          <button className="refresh-button" onClick={loadLogs} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </header>

        <section className="search-panel">
          <div className="global-search">
            <Search size={20} />
            <input
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search users, events, categories, entities or details..."
              aria-label="Search audit records"
            />
            {search && (
              <button
                className="icon-button"
                onClick={() => updateSearch("")}
                aria-label="Clear search"
              >
                <X size={17} />
              </button>
            )}
          </div>

          <div className="date-filters">
            <label>
              From
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  setPage(1);
                }}
              />
            </label>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon purple"><Activity /></div>
            <span>Total records loaded</span>
            <strong>{records.length.toLocaleString()}</strong>
          </div>

          {CATEGORIES.map((category) => (
            <div className="stat-card" key={category}>
              <div className="stat-icon blue">{categoryIcon(category)}</div>
              <span>{getCategoryLabel(category)}</span>
              <strong>{(categoryCounts[category] || 0).toLocaleString()}</strong>
            </div>
          ))}
        </section>

        <section className="table-card">
          <div className="table-heading">
            <div>
              <h2>Audit events</h2>
              <p>{filteredRecords.length.toLocaleString()} matching records</p>
            </div>
            <span className="live-badge">
              <span className="status-dot" /> API DATA
            </span>
          </div>

          <div className="category-tabs">
  <button
    className={activeCategory === "all" ? "tab active" : "tab"}
    onClick={() => changeCategory("all")}
  >
    All Categories <span>{categoryCounts.all || 0}</span>
  </button>

  {[
    "audit.data-modification",
    "audit.security-events",
    "audit.configuration",
    "audit.data-access",
  ].map((category) => (
    <button
      key={category}
      className={activeCategory === category ? "tab active" : "tab"}
      onClick={() => changeCategory(category)}
    >
      {getCategoryLabel(category)}
      <span>{categoryCounts[category] || 0}</span>
    </button>
  ))}
</div>

          {error && (
            <div className="error-box">
              <strong>Unable to load audit logs</strong>
              <p>{error}</p>
              <button onClick={loadLogs}>Try again</button>
            </div>
          )}

          {loading ? (
            <div className="empty-state">
              <RefreshCw className="spin" />
              <strong>Loading audit records...</strong>
            </div>
          ) : !error && visibleRecords.length === 0 ? (
            <div className="empty-state">
              <Search size={28} />
              <strong>No matching audit events</strong>
              <p>Try another search term or clear the filters.</p>
              <button
                onClick={() => {
                  setSearch("");
                  setActiveCategory("all");
                  setStartDate("");
                  setEndDate("");
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            </div>
          ) : !error ? (
            <div className="table-scroll">
              <table>
                
<thead>
  {activeCategory === "audit.data-modification" ? (
    <tr>
      <th>Timestamp</th>
      <th>Actor</th>
      <th>Operation</th>
      <th>Entity</th>
      <th>Attribute</th>
      <th>Old Value</th>
      <th>New Value</th>
      <th>Details</th>
    </tr>
  ) : (
    <tr>
      <th>Timestamp</th>
      <th>Category</th>
      <th>Event</th>
      <th>Actor</th>
      <th>Source IP</th>
      <th>Details</th>
    </tr>
  )}
</thead>

<tbody>
  {visibleRecords.flatMap((record) => {
    if (activeCategory === "audit.data-modification") {
      const attributes = record.attributes.length
        ? record.attributes
        : [{ name: "No attribute details available" }];

      return attributes.map((attribute, index) => (
        <tr key={`${record.id}-${index}`}>
          <td className="timestamp">{formatDate(record.time)}</td>
          <td>{record.actor}</td>
          <td>{record.operation}</td>
          <td>{record.entity}</td>
          <td>{attribute.name || "—"}</td>
          <td className="change-value">
            {attribute.old ?? "—"}
          </td>
          <td className="change-value">
            {attribute.new ?? "—"}
          </td>
          <td>
            <button
              className="view-button"
              onClick={() => setSelectedRecord(record)}
            >
              <Eye size={15} /> View
            </button>
          </td>
        </tr>
      ));
    }

    return [
      <tr key={record.id}>
        <td className="timestamp">{formatDate(record.time)}</td>
        <td>
          <span className="category-pill">
            {categoryIcon(record.category)}
            {getCategoryLabel(record.category)}
          </span>
        </td>
        <td className="event-cell">{record.event}</td>
        <td className="actor-cell">{record.actor}</td>
        <td>{record.ip}</td>
        <td>
          <button
            className="view-button"
            onClick={() => setSelectedRecord(record)}
          >
            <Eye size={15} /> View
          </button>
        </td>
      </tr>,
    ];
  })}
</tbody>

                <tbody>
                  {visibleRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="timestamp">{formatDate(record.time)}</td>
                      <td>
                        <span className="category-pill">
                          {categoryIcon(record.category)}
                          {getCategoryLabel(record.category)}
                        </span>
                      </td>
                      <td className="event-cell">{record.event}</td>
                      <td className="actor-cell">{record.actor}</td>
                      <td>{record.ip}</td>
                      <td>
                        <button
                          className="view-button"
                          onClick={() => setSelectedRecord(record)}
                        >
                          <Eye size={15} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {!loading && !error && filteredRecords.length > 0 && (
            <div className="pagination">
              <span>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filteredRecords.length)} of{" "}
                {filteredRecords.length}
              </span>
              <div>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={17} />
                </button>
                <span>{currentPage} / {totalPages}</span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                  aria-label="Next page"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          )}
        </section>

        <footer className="page-footer">
          AuditLens · Data supplied by SAP Audit Log Management
        </footer>
      </main>

      <DetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
}
