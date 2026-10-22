export function createHost(cancelRecord) {
  let view;
  const views = new Map();
  const createView = (record) => ({ record, open: false, reason: "", pending: false });
  return {
    visit(record) {
      if (!views.has(record.id)) views.set(record.id, createView(record));
      view = views.get(record.id);
      view.record = record;
    },
    read() { return { ...view }; },
    openConfirmation() { view.open = true; },
    editReason(reason) { view.reason = reason; },
    async confirm() {
      const target = view;
      if (!target.open || target.pending || !target.reason.trim()) return false;
      target.pending = true;
      try {
        await cancelRecord(target.record.id, target.reason.trim());
        target.open = false;
        target.reason = "";
        return true;
      } finally {
        target.pending = false;
      }
    },
  };
}
