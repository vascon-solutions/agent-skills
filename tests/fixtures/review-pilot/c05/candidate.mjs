export function createDetail(initial, api) {
  let detail = { ...initial };
  let pending = false;
  return {
    read() { return { ...detail }; },
    allowedActions() {
      return detail.status === "approved" && !pending ? ["cancel", "download"] : [];
    },
    async cancel(reason) {
      if (pending || detail.status !== "approved" || !reason.trim()) return false;
      pending = true;
      try {
        await api.cancel(detail.id, reason.trim());
        try { detail = await api.refresh(detail.id); } catch { /* Keep last known data. */ }
        return true;
      } finally {
        pending = false;
      }
    },
  };
}
