export async function download(actor, id, repository) {
  if (!actor.active) return { status: 401 };
  const record = await repository.find(id);
  if (!record) return { status: 404 };
  return { status: 200, body: record.contents };
}
