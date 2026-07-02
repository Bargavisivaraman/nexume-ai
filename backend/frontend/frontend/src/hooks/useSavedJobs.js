import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "nexume_saved_jobs";
const MAX_SAVED = 200;

function read() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function write(jobs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(0, MAX_SAVED))); }
  catch {}
}

/**
 * useSavedJobs — saved-job state synced to localStorage.
 * Returns { saved, isSaved, toggleSave, removeSaved, clearAll }.
 * Triggers a window event so multiple tabs / hook consumers stay in sync.
 */
export default function useSavedJobs() {
  const [saved, setSaved] = useState(read);

  useEffect(() => {
    const onChange = () => setSaved(read());
    window.addEventListener("nexume_saved_jobs_change", onChange);
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) onChange();
    });
    return () => window.removeEventListener("nexume_saved_jobs_change", onChange);
  }, []);

  const persist = useCallback((next) => {
    write(next);
    setSaved(next);
    window.dispatchEvent(new Event("nexume_saved_jobs_change"));
  }, []);

  const isSaved = useCallback((jobId) => saved.some(j => j.job_id === jobId), [saved]);

  const toggleSave = useCallback((job) => {
    const id = job.job_id;
    if (!id) return;
    const next = saved.some(j => j.job_id === id)
      ? saved.filter(j => j.job_id !== id)
      : [{ ...job, saved_at: new Date().toISOString() }, ...saved];
    persist(next);
  }, [saved, persist]);

  const removeSaved = useCallback((jobId) => {
    persist(saved.filter(j => j.job_id !== jobId));
  }, [saved, persist]);

  const clearAll = useCallback(() => persist([]), [persist]);

  return { saved, isSaved, toggleSave, removeSaved, clearAll, savedCount: saved.length };
}
