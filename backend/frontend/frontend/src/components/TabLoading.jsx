/** Suspense fallback matching the existing skeleton style. */
export default function TabLoading() {
  return (
    <div className="tab-loading">
      <div className="skeleton-line" style={{ width: "40%", height: 28, margin: "48px auto 20px" }} />
      <div className="skeleton-line" style={{ width: "70%", height: 16, margin: "0 auto 10px" }} />
      <div className="skeleton-line" style={{ width: "55%", height: 16, margin: "0 auto" }} />
    </div>
  );
}
