"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { STATUSES } from "@/lib/roadmap/parse.mjs";

type Comment = { id: number; author: string; body: string; at: string; canDelete: boolean };
type Item = {
  id: string;
  item: string;
  outcome: string | null;
  repoStatus: string;
  status: string;
  pending: boolean;
  conflict: { repo: string; page: string } | null;
  repoNote: string;
  taskDoc: string | null;
  note: string;
  link: string;
  version: number;
  comments: Comment[];
};
type Group = { title: string; outcome: string | null; items: Item[] };
type Entry = { id: number; at: string; kind: string; itemId: string | null; actor: string; detail: string };
type Roadmap = {
  viewer: { signedIn: boolean; isEditor: boolean; name: string | null };
  snapshot: { commit: string; author: string; pushedAt: string; age: { days: number; stale: boolean } | null } | null;
  groups: Group[];
  pendingCount: number;
  lastPageChange: string | null;
  activity: Entry[];
};
type Config = {
  title: string;
  summary: string;
  roadmapPath: string;
  repositoryUrl?: string;
  ref?: string;
  colophon?: { substituted?: { token: string; note: string }[]; waived?: { token: string; note: string }[] };
};

const LABELS: Record<string, string> = {
  todo: "To do",
  "in-progress": "In progress",
  blocked: "Blocked",
  done: "Done",
  deferred: "Deferred",
  cancelled: "Cancelled",
};
const CLOSED = new Set(["done", "cancelled"]);

function day(iso: string) {
  return iso.slice(0, 10);
}

function stamp(iso: string) {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function safeHref(href: string) {
  return /^(https?:\/\/|\/|#)/.test(href) ? href : null;
}

function docHref(path: string, config: Config) {
  if (/^https?:\/\//.test(path)) return path;
  if (!config.repositoryUrl) return null;
  return `${config.repositoryUrl.replace(/\/$/, "")}/blob/${config.ref || "main"}/${path.replace(/^\.?\//, "")}`;
}

const INLINE = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/g;

function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    const key = parts.length;
    if (match[1] !== undefined) parts.push(<code key={key}>{match[1]}</code>);
    else if (match[2] !== undefined) {
      const href = safeHref(match[3]);
      parts.push(href ? <a key={key} href={href}>{match[2]}</a> : match[2]);
    } else if (match[4] !== undefined) parts.push(<strong key={key}>{match[4]}</strong>);
    else parts.push(<em key={key}>{match[5] ?? match[6]}</em>);
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function Pill({ status }: { status: string }) {
  return <span className={`pill pill-${status}`}>{LABELS[status] || status}</span>;
}

function Marker({ item }: { item: Item }) {
  if (item.conflict) {
    return (
      <span className="marker marker-conflict">
        Conflict: repo {LABELS[item.conflict.repo]}, page {LABELS[item.conflict.page]}
      </span>
    );
  }
  if (item.pending) return <span className="marker">Changed on the page, not yet in the repo</span>;
  return null;
}

function DocLink({ path, config }: { path: string; config: Config }) {
  const href = docHref(path, config);
  return href ? <a href={href}>{path}</a> : <code>{path}</code>;
}

async function send(method: string, url: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return { ok: response.ok, status: response.status, payload };
}

function EditForm({ item, onSave }: { item: Item; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  const [status, setStatus] = useState(item.status);
  const [note, setNote] = useState(item.note);
  const [link, setLink] = useState(item.link);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="edit"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        await onSave({ id: item.id, version: item.version, status, note, link });
        setBusy(false);
      }}
    >
      <label>
        Status
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          {STATUSES.map((value: string) => (
            <option key={value} value={value}>{LABELS[value]}</option>
          ))}
        </select>
      </label>
      <label>
        Note
        <textarea value={note} rows={3} onChange={(event) => setNote(event.target.value)} />
      </label>
      <label>
        Link
        <input type="url" value={link} placeholder="https://" onChange={(event) => setLink(event.target.value)} />
      </label>
      <button className="primary" type="submit" disabled={busy}>Save</button>
    </form>
  );
}

function Drawer(props: {
  item: Item;
  data: Roadmap;
  config: Config;
  message: string;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  onComment: (body: string) => Promise<boolean>;
  onDelete: (id: number) => Promise<void>;
}) {
  const { item, data, config } = props;
  const [draft, setDraft] = useState("");
  const history = data.activity.filter((entry) => entry.itemId === item.id);
  const pageLink = item.link && safeHref(item.link);
  return (
    <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <header>
        <p className="eyebrow">{item.id}</p>
        <button className="ghost" onClick={props.onClose} aria-label="Close">Close</button>
      </header>
      <h2 id="drawer-title"><Inline text={item.item} /></h2>
      {item.outcome && <p className="lede"><Inline text={item.outcome} /></p>}
      <dl className="facts">
        <dt>Status</dt>
        <dd><Pill status={item.status} /> <Marker item={item} /></dd>
        {item.status !== item.repoStatus && (<><dt>Repo status</dt><dd><Pill status={item.repoStatus} /></dd></>)}
        {item.repoNote && (<><dt>Repo note</dt><dd><Inline text={item.repoNote} /></dd></>)}
        {item.taskDoc && (<><dt>Task doc</dt><dd><DocLink path={item.taskDoc} config={config} /></dd></>)}
        {item.note && (<><dt>Note</dt><dd className="prewrap">{item.note}</dd></>)}
        {item.link && (<><dt>Link</dt><dd>{pageLink ? <a href={pageLink}>{item.link}</a> : item.link}</dd></>)}
      </dl>
      {props.message && <p className="alert" role="alert">{props.message}</p>}
      {data.viewer.isEditor && <EditForm key={`${item.id}:${item.version}`} item={item} onSave={props.onSave} />}
      <section>
        <h3>Comments</h3>
        {item.comments.length === 0 && <p className="muted">No comments yet.</p>}
        <ul className="comments">
          {item.comments.map((comment) => (
            <li key={comment.id}>
              <p className="meta">{comment.author} · {stamp(comment.at)}</p>
              <p className="prewrap">{comment.body}</p>
              {comment.canDelete && <button className="ghost" onClick={() => props.onDelete(comment.id)}>Delete</button>}
            </li>
          ))}
        </ul>
        {data.viewer.signedIn && (
          <form
            className="comment-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await props.onComment(draft)) setDraft("");
            }}
          >
            <textarea aria-label="Add a comment" value={draft} rows={2} maxLength={2000} onChange={(event) => setDraft(event.target.value)} />
            <button className="primary" type="submit" disabled={!draft.trim()}>Comment</button>
          </form>
        )}
      </section>
      <section>
        <h3>Activity</h3>
        {history.length === 0 && <p className="muted">No activity on this item yet.</p>}
        <ul className="activity">
          {history.map((entry) => (
            <li key={entry.id}>{stamp(entry.at)} · {entry.actor}: {entry.detail}</li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

export default function RoadmapView(props: {
  initial: Roadmap;
  config: Config;
  initialStatus: string;
  initialQuery: string;
  signInPath: string;
  signOutPath: string;
}) {
  const { config } = props;
  const [data, setData] = useState(props.initial);
  const [filter, setFilter] = useState(() => new Set(props.initialStatus.split(",").filter((s) => STATUSES.includes(s))));
  const [query, setQuery] = useState(props.initialQuery);
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    if (filter.size) url.searchParams.set("status", [...filter].join(","));
    else url.searchParams.delete("status");
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  }, [filter, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpenId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = useMemo(() => data.groups.flatMap((group) => group.items), [data]);
  const open = items.find((item) => item.id === openId) || null;
  const counted = items.filter((item) => item.status !== "cancelled" && item.status !== "deferred");
  const needle = query.trim().toLowerCase();
  const matches = (item: Item) =>
    (!filter.size || filter.has(item.status)) &&
    (!needle || [item.id, item.item, item.outcome || ""].some((text) => text.toLowerCase().includes(needle)));
  const filtering = filter.size > 0 || needle.length > 0;

  async function reload() {
    const result = await send("GET", "/api/roadmap");
    if (result.ok) setData(result.payload as unknown as Roadmap);
  }

  async function apply(result: { ok: boolean; status: number; payload: { error?: string } }) {
    if (result.ok) {
      setData(result.payload as unknown as Roadmap);
      setMessage("");
      return true;
    }
    setMessage(result.payload.error || `Request failed (${result.status}).`);
    if (result.status === 409) await reload();
    return false;
  }

  const days: [string, Entry[]][] = [];
  for (const entry of data.activity) {
    const last = days[days.length - 1];
    if (last && last[0] === day(entry.at)) last[1].push(entry);
    else days.push([day(entry.at), [entry]]);
  }
  const colophon = config.colophon || {};
  const tokenNotes = [
    ...(colophon.substituted || []).map((row) => `${row.token} substituted (${row.note})`),
    ...(colophon.waived || []).map((row) => `${row.token} waived (${row.note})`),
  ];
  const snap = data.snapshot;

  return (
    <div className="page">
      <header className="masthead">
        <div className="masthead-inner">
          <p className="eyebrow">Roadmap</p>
          <h1>{config.title}</h1>
          <p className="lede">{config.summary}</p>
          <dl className="facts facts-row">
            <div><dt>Roadmap file</dt><dd><code>{config.roadmapPath}</code></dd></div>
            <div>
              <dt>Repo snapshot</dt>
              <dd className={snap?.age?.stale ? "warn" : undefined}>
                {snap ? `${snap.commit.slice(0, 7)} · ${day(snap.pushedAt)} · ${snap.age?.days ?? 0} day(s) old` : "Not pushed yet"}
                {snap?.age?.stale && " · stale: run sync"}
              </dd>
            </div>
            <div><dt>Pending page changes</dt><dd>{data.pendingCount}</dd></div>
            <div><dt>Last change on the page</dt><dd>{data.lastPageChange ? stamp(data.lastPageChange) : "None"}</dd></div>
            <div>
              <dt>Signed in</dt>
              <dd>
                {data.viewer.signedIn ? (
                  <>{data.viewer.name}{data.viewer.isEditor ? " (editor)" : ""} · <a href={props.signOutPath} target="_top">Sign out</a></>
                ) : (
                  <a href={props.signInPath} target="_top">Sign in with ChatGPT</a>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <main className="content">
        <section className="summary" aria-label="Status summary">
          <p className="done-count">{counted.filter((item) => item.status === "done").length} of {counted.length} done</p>
          <ul>
            {STATUSES.map((status: string) => (
              <li key={status}><Pill status={status} /> {items.filter((item) => item.status === status).length}</li>
            ))}
          </ul>
        </section>

        <section className="controls" aria-label="Filters">
          <div className="chips">
            {STATUSES.map((status: string) => (
              <button
                key={status}
                className={`chip${filter.has(status) ? " chip-on" : ""}`}
                aria-pressed={filter.has(status)}
                onClick={() => {
                  const next = new Set(filter);
                  if (next.has(status)) next.delete(status);
                  else next.add(status);
                  setFilter(next);
                }}
              >
                {LABELS[status]}
              </button>
            ))}
          </div>
          <input type="search" aria-label="Search id, item and outcome" placeholder="Search id, item or outcome" value={query} onChange={(event) => setQuery(event.target.value)} />
        </section>

        {!snap && <p className="muted">No snapshot yet. Run a sync push from the repo checkout.</p>}

        {data.groups.map((group) => {
          const shown = group.items.filter(matches);
          if (filtering && !shown.length) return null;
          const finished = group.items.every((item) => CLOSED.has(item.status));
          const done = group.items.filter((item) => item.status === "done").length;
          return (
            <details key={`${group.title}:${filtering}`} className="group" open={filtering || !finished}>
              <summary>
                <span className="group-title">{group.title}</span>
                <span className="muted">{done} of {group.items.length} done</span>
              </summary>
              {group.outcome && <p className="group-outcome"><Inline text={group.outcome} /></p>}
              <ul className="items">
                {shown.map((item) => (
                  <li key={item.id} id={`item-${item.id}`}>
                    <button className="row" onClick={() => { setMessage(""); setOpenId(item.id); }}>
                      <span className="row-id">{item.id}</span>
                      <span className="row-text"><Inline text={item.outcome || item.item} /></span>
                      <span className="row-meta">
                        <Pill status={item.status} />
                        <Marker item={item} />
                        {item.taskDoc && <span className="muted">Task doc</span>}
                        {item.comments.length > 0 && <span className="muted">{item.comments.length} comment(s)</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}

        <section className="activity-log">
          <h2>Activity</h2>
          {days.length === 0 && <p className="muted">No activity yet.</p>}
          {days.map(([date, entries]) => (
            <Fragment key={date}>
              <h3>{date}</h3>
              <ul className="activity">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    {entry.at.slice(11, 16)} · {entry.actor}: {entry.detail}
                    {entry.itemId && (
                      <> · <a href={`#item-${entry.itemId}`} onClick={() => setOpenId(entry.itemId)}>{entry.itemId}</a></>
                    )}
                  </li>
                ))}
              </ul>
            </Fragment>
          ))}
        </section>

        <footer className="colophon">
          <p>Status comes from <code>{config.roadmapPath}</code> and page edits reach it only through a sync pull reviewed in the repo.</p>
          {tokenNotes.length > 0 && <p>Tokens: {tokenNotes.join("; ")}.</p>}
        </footer>
      </main>

      {open && (
        <>
          <div className="scrim" onClick={() => setOpenId(null)} />
          <Drawer
            item={open}
            data={data}
            config={config}
            message={message}
            onClose={() => setOpenId(null)}
            onSave={async (body) => { await apply(await send("PUT", "/api/items", body)); }}
            onComment={async (body) => apply(await send("POST", "/api/comments", { itemId: open.id, body }))}
            onDelete={async (id) => { await apply(await send("DELETE", "/api/comments", { id })); }}
          />
        </>
      )}
    </div>
  );
}
