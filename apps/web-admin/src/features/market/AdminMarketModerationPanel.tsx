import { useEffect, useMemo, useState } from "react";
import { AdminDataTable, AdminDetailDrawer, AdminEmptyState, AdminErrorState, AdminLoadingState, AdminNotice, AdminPageHeader, AdminPageSection, AdminPagination, AdminSearchInput, AdminStatusBadge, AdminTabs } from "../../components/admin/AdminPrimitives";
import { approveMarketListing, compactMarketStore, fetchAdminMarketCategories, fetchAdminMarketListings, fetchAdminMarketOutbox, fetchAdminMarketReports, rejectMarketListing, removeMarketListing, saveAdminMarketCategory, updateMarketTrust } from "./market-api";
import type { AdminMarketCategory, AdminMarketListing, AdminMarketOutboxEvent, AdminMarketReport } from "./market-api";

const statusTabs = [["PENDING_REVIEW", "Pending review"], ["APPROVED", "Approved"], ["REJECTED", "Rejected"], ["REPORTED", "Reported"], ["REMOVED", "Removed"]] as const;
const pageSize = 20;

export default function AdminMarketModerationPanel() {
  const [listings, setListings] = useState<AdminMarketListing[]>([]);
  const [reports, setReports] = useState<AdminMarketReport[]>([]);
  const [categories, setCategories] = useState<AdminMarketCategory[]>([]);
  const [outbox, setOutbox] = useState<AdminMarketOutboxEvent[]>([]);
  const [status, setStatus] = useState("PENDING_REVIEW");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminMarketListing | null>(null);
  const [categoryDraft, setCategoryDraft] = useState({ labelAr: "", labelEn: "", icon: "box" });

  async function refresh(nextStatus = status) {
    setLoading(true);
    setError("");
    try {
      const [nextListings, nextReports, nextCategories, nextOutbox] = await Promise.all([fetchAdminMarketListings(nextStatus), fetchAdminMarketReports(), fetchAdminMarketCategories(), fetchAdminMarketOutbox()]);
      setListings(nextListings); setReports(nextReports); setCategories(nextCategories); setOutbox(nextOutbox); setPage(1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load Marketplace authority."); } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  const filtered = useMemo(() => { const query = search.trim().toLowerCase(); return query ? listings.filter((listing) => `${listing.title} ${listing.description} ${listing.categoryId}`.toLowerCase().includes(query)) : listings; }, [listings, search]);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  async function run(action: () => Promise<void>, ok: string) { setMessage(""); setError(""); try { await action(); setMessage(ok); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to complete Marketplace action."); } }
  async function addCategory() { if (!categoryDraft.labelAr.trim()) { setError("Arabic category name is required."); return; } await run(async () => { await saveAdminMarketCategory(categoryDraft); setCategoryDraft({ labelAr: "", labelEn: "", icon: "box" }); }, "Category saved."); }
  return <div className="ops-page-stack" dir="ltr">
    <AdminPageHeader title="Marketplace" description="Gateway-owned listing moderation, seller trust, categories, reports, and integration events." actions={<button className="ghost" type="button" onClick={() => void refresh()} disabled={loading}>Refresh</button>} />
    {message && <AdminNotice tone="success">{message}</AdminNotice>}
    {error && <AdminErrorState message={error} />}
    <AdminPageSection title="Listings" description="Moderation actions are applied through the canonical Marketplace authority.">
      <AdminTabs items={statusTabs.map(([value, label]) => ({ value, label }))} value={status} onChange={(value) => { setStatus(value); void refresh(value); }} />
      <div className="admin-table-toolbar"><AdminSearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search title, description, or category" /><span className="admin-result-count">{filtered.length} listings</span><button className="ghost sm" type="button" onClick={() => void run(compactMarketStore, "Marketplace store compacted.")}>Compact store</button></div>
      {loading ? <AdminLoadingState message="Loading Marketplace listings..." /> : <AdminDataTable rows={visible} columns={["Listing", "Category", "Status", "Lifecycle", "Reports", "Actions"]} empty="No listings match this moderation view." renderRow={(listing) => <><td><button className="table-link" type="button" onClick={() => setSelected(listing)}>{listing.title}</button><small className="muted">{listing.description}</small></td><td>{listing.categoryId}</td><td><AdminStatusBadge status={listing.status} /></td><td>{listing.lifecycleStatus || "active"}</td><td>{listing.reportCount}</td><td><div className="ops-row-actions">{listing.status === "PENDING_REVIEW" && <button className="ghost sm" type="button" onClick={() => void run(() => approveMarketListing(listing.id), "Listing approved.")}>Approve</button>}<button className="ghost sm" type="button" onClick={() => void run(() => rejectMarketListing(listing.id, "Please clarify price or contact method", "Marketplace admin review"), "Listing rejected.")}>Reject</button><button className="ghost sm danger" type="button" onClick={() => { if (window.confirm("Remove this listing from Marketplace?")) void run(() => removeMarketListing(listing.id, "Removed from Marketplace moderation"), "Listing removed."); }}>Remove</button><button className="ghost sm" type="button" onClick={() => void run(() => updateMarketTrust(listing.id, { verifiedByWatany: true, sellerTrustLevel: "TRUSTED", note: "Verified by Watany" }), "Seller trust updated.")}>Verify</button></div></td></>} />}
      {!loading && <AdminPagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />}
    </AdminPageSection>
    <AdminPageSection title="Categories" description="Superadmin-owned category metadata used by Marketplace listings."><div className="admin-data-table-wrap"><table className="admin-data-table"><thead><tr><th>Icon</th><th>Arabic label</th><th>English label</th><th>Status</th><th>Order</th></tr></thead><tbody>{categories.map((category) => <tr key={category.id}><td>{category.icon}</td><td dir="rtl">{category.labelAr}</td><td>{category.labelEn}</td><td><AdminStatusBadge status={category.enabled ? "Enabled" : "Disabled"} /></td><td>{category.sortOrder}</td></tr>)}{categories.length === 0 && <tr><td colSpan={5}><AdminEmptyState message="No category metadata returned." /></td></tr>}</tbody></table></div><div className="ops-form-grid"><label><span>Arabic label</span><input value={categoryDraft.labelAr} onChange={(event) => setCategoryDraft({ ...categoryDraft, labelAr: event.target.value })} /></label><label><span>English label</span><input value={categoryDraft.labelEn} onChange={(event) => setCategoryDraft({ ...categoryDraft, labelEn: event.target.value })} /></label><label><span>Icon name</span><input value={categoryDraft.icon} onChange={(event) => setCategoryDraft({ ...categoryDraft, icon: event.target.value })} /></label><div className="ops-form-actions"><button className="accent" type="button" onClick={() => void addCategory()}>Add category</button></div></div></AdminPageSection>
    <AdminPageSection title="Reports and integration events" description="Operational context returned by the Marketplace authority."><div className="ops-split-grid"><div><h3>Open reports</h3>{reports.length === 0 ? <AdminEmptyState message="No open reports returned." /> : reports.map((report) => <div className="ops-list-row" key={report.id}><strong>{report.reason}</strong><span>{report.listing?.title || report.listingId}</span><AdminStatusBadge status={report.status} /></div>)}</div><div><h3>Outbox</h3>{outbox.length === 0 ? <AdminEmptyState message="No pending integration events returned." /> : outbox.slice(0, 12).map((event) => <div className="ops-list-row" key={event.id}><strong>{event.eventType}</strong><span>{event.aggregateType}</span><AdminStatusBadge status={event.mercurStatus} /></div>)}</div></div></AdminPageSection>
  {selected && <AdminDetailDrawer title={selected.title} onClose={() => setSelected(null)}><p>{selected.description}</p><p><strong>Category:</strong> {selected.categoryId}</p><p><strong>Owner:</strong> {selected.ownerId}</p><p><strong>Status:</strong> <AdminStatusBadge status={selected.status} /></p><p><strong>Trust:</strong> {selected.trust.sellerTrustLevel}</p><p><strong>Reports:</strong> {selected.reportCount}</p></AdminDetailDrawer>}
  </div>;
}
