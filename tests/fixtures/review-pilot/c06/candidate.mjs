export async function download(actor, id, repository) {
  if (!actor.active) return { status: 401 };
  const record = await repository.find(id);
  if (!record) return { status: 404 };
  if (actor.role !== "reader" || actor.tenantId !== record.tenantId) {
    return { status: 403 };
  }
  return { status: 200, body: record.contents };
}
