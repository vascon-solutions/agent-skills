#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PR_FIELDS = `
  number
  url
  title
  state
  isDraft
  headRefName
  headRefOid
  reviewDecision
`;

const COMMENT_FIELDS = `
  id
  databaseId
  body
  url
  createdAt
  updatedAt
  author { login }
`;

const META_QUERY = `
query PullRequestMeta($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) { ${PR_FIELDS} }
  }
}`;

const COMMENTS_QUERY = `
query PullRequestComments($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      comments(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes { ${COMMENT_FIELDS} }
      }
    }
  }
}`;

const REVIEWS_QUERY = `
query PullRequestReviews($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviews(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          databaseId
          state
          body
          url
          submittedAt
          updatedAt
          author { login }
        }
      }
    }
  }
}`;

const THREADS_QUERY = `
query PullRequestThreads($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          startLine
          diffSide
          resolvedBy { login }
          comments(first: 100) {
            pageInfo { hasNextPage endCursor }
            nodes { ${COMMENT_FIELDS} }
          }
        }
      }
    }
  }
}`;

const THREAD_COMMENTS_QUERY = `
query ReviewThreadComments($threadId: ID!, $cursor: String) {
  node(id: $threadId) {
    ... on PullRequestReviewThread {
      comments(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes { ${COMMENT_FIELDS} }
      }
    }
  }
}`;

const eventTime = (node) => node.createdAt ?? node.submittedAt ?? node.updatedAt ?? "";

const compareEvents = (left, right) =>
  eventTime(left).localeCompare(eventTime(right)) || String(left.id).localeCompare(String(right.id));

const deduplicate = (nodes) => {
  const byId = new Map();
  for (const node of nodes) {
    if (!node?.id) throw new Error("GitHub returned a review node without an id");
    if (!byId.has(node.id)) byId.set(node.id, node);
  }
  return [...byId.values()];
};

const assertPayload = (payload, operation) => {
  if (!payload || typeof payload !== "object") throw new Error(`${operation} returned an invalid payload`);
  if (payload.errors?.length) {
    const messages = payload.errors.map(({ message }) => message || "Unknown GraphQL error").join("; ");
    throw new Error(`${operation} failed: ${messages}`);
  }
  return payload;
};

const splitRepository = (repository) => {
  const match = /^([^/\s]+)\/([^/\s]+)$/.exec(repository ?? "");
  if (!match) throw new Error(`Invalid repository '${repository}'; expected OWNER/REPO`);
  return { owner: match[1], repo: match[2] };
};

const connectionPage = (payload, operation, selector) => {
  assertPayload(payload, operation);
  const connection = selector(payload);
  if (!connection || !Array.isArray(connection.nodes) || !connection.pageInfo) {
    throw new Error(`${operation} returned an invalid connection`);
  }
  return connection;
};

const fetchPages = async ({ client, query, variables, operation, selector, initialCursor = null }) => {
  const nodes = [];
  let cursor = initialCursor;

  while (true) {
    const payload = await client.graphql(query, { ...variables, cursor });
    const connection = connectionPage(payload, operation, selector);
    nodes.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) break;
    if (!connection.pageInfo.endCursor) throw new Error(`${operation} reported another page without an endCursor`);
    cursor = connection.pageInfo.endCursor;
  }

  return deduplicate(nodes);
};

const normalizeComment = (comment) => ({
  id: comment.id,
  databaseId: comment.databaseId ?? null,
  body: comment.body ?? "",
  url: comment.url ?? null,
  createdAt: comment.createdAt ?? null,
  updatedAt: comment.updatedAt ?? null,
  author: comment.author?.login ?? null,
});

const normalizeReview = (review) => ({
  id: review.id,
  databaseId: review.databaseId ?? null,
  state: review.state ?? null,
  body: review.body ?? "",
  url: review.url ?? null,
  submittedAt: review.submittedAt ?? null,
  updatedAt: review.updatedAt ?? null,
  author: review.author?.login ?? null,
});

const normalizeCapturedAt = (capturedAt) => {
  const value = capturedAt ?? new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`Invalid captured-at timestamp '${value}'`);
  return parsed.toISOString();
};

export const fetchPrReviewState = async ({ client, repository, prNumber, capturedAt }) => {
  if (!client?.graphql) throw new Error("A GraphQL client is required");
  if (!Number.isInteger(prNumber) || prNumber <= 0) throw new Error("PR number must be a positive integer");
  const { owner, repo } = splitRepository(repository);
  const variables = { owner, repo, number: prNumber };

  const metaPayload = assertPayload(await client.graphql(META_QUERY, variables), "PullRequestMeta");
  const pullRequest = metaPayload.data?.repository?.pullRequest;
  if (!pullRequest) throw new Error(`Pull request ${repository}#${prNumber} was not found`);

  const conversationComments = await fetchPages({
    client,
    query: COMMENTS_QUERY,
    variables,
    operation: "PullRequestComments",
    selector: (payload) => payload.data?.repository?.pullRequest?.comments,
  });
  const reviews = await fetchPages({
    client,
    query: REVIEWS_QUERY,
    variables,
    operation: "PullRequestReviews",
    selector: (payload) => payload.data?.repository?.pullRequest?.reviews,
  });
  const rawThreads = await fetchPages({
    client,
    query: THREADS_QUERY,
    variables,
    operation: "PullRequestThreads",
    selector: (payload) => payload.data?.repository?.pullRequest?.reviewThreads,
  });

  const reviewThreads = [];
  for (const thread of rawThreads) {
    const initialComments = thread.comments;
    if (!initialComments || !Array.isArray(initialComments.nodes) || !initialComments.pageInfo) {
      throw new Error(`Review thread ${thread.id} returned an invalid comments connection`);
    }
    const comments = [...initialComments.nodes];
    if (initialComments.pageInfo.hasNextPage) {
      if (!initialComments.pageInfo.endCursor) {
        throw new Error(`Review thread ${thread.id} reported another comments page without an endCursor`);
      }
      comments.push(...await fetchPages({
        client,
        query: THREAD_COMMENTS_QUERY,
        variables: { threadId: thread.id },
        operation: "ReviewThreadComments",
        initialCursor: initialComments.pageInfo.endCursor,
        selector: (payload) => payload.data?.node?.comments,
      }));
    }
    reviewThreads.push({
      id: thread.id,
      isResolved: Boolean(thread.isResolved),
      isOutdated: Boolean(thread.isOutdated),
      path: thread.path ?? null,
      line: thread.line ?? null,
      startLine: thread.startLine ?? null,
      diffSide: thread.diffSide ?? null,
      resolvedBy: thread.resolvedBy?.login ?? null,
      comments: deduplicate(comments).map(normalizeComment).sort(compareEvents),
    });
  }

  reviewThreads.sort((left, right) =>
    String(left.path ?? "").localeCompare(String(right.path ?? "")) ||
    (left.line ?? Number.MAX_SAFE_INTEGER) - (right.line ?? Number.MAX_SAFE_INTEGER) ||
    left.id.localeCompare(right.id));

  return {
    schemaVersion: 1,
    capturedAt: normalizeCapturedAt(capturedAt),
    repository,
    pullRequest: {
      number: pullRequest.number,
      url: pullRequest.url,
      title: pullRequest.title,
      state: pullRequest.state,
      isDraft: Boolean(pullRequest.isDraft),
      headRefName: pullRequest.headRefName,
      headRefOid: pullRequest.headRefOid,
      reviewDecision: pullRequest.reviewDecision ?? null,
    },
    conversationComments: conversationComments.map(normalizeComment).sort(compareEvents),
    reviews: reviews.map(normalizeReview).sort(compareEvents),
    reviewThreads,
  };
};

export const parsePullRequestUrl = (value) => {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/.exec(value ?? "");
  if (!match) return null;
  return { repository: `${match[1]}/${match[2]}`, prNumber: Number(match[3]) };
};

export const parseCliArgs = (argv) => {
  const options = { repository: null, pr: null, capturedAt: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    const key = { "--repo": "repository", "--pr": "pr", "--captured-at": "capturedAt" }[argument];
    if (!key) throw new Error(`Unknown argument '${argument}'`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
    options[key] = value;
    index += 1;
  }
  return options;
};

export const redactSensitive = (value) => String(value ?? "")
  .replace(/\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]+\b/g, "[REDACTED]")
  .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]");

export const GH_MAX_BUFFER_BYTES = 16 * 1024 * 1024;

export const runGh = (args, { input, spawn = spawnSync } = {}) => {
  const result = spawn("gh", args, { encoding: "utf8", input, maxBuffer: GH_MAX_BUFFER_BYTES });
  if (result.error) throw new Error(`Unable to run gh: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = redactSensitive(result.stderr || result.stdout).trim();
    throw new Error(detail || `gh ${args[0]} failed with exit code ${result.status}`);
  }
  return result.stdout;
};

export const createGhClient = (runGhImpl = runGh) => ({
  async graphql(query, variables) {
    const args = ["api", "graphql", "-F", "query=@-"];
    for (const [key, value] of Object.entries(variables)) {
      if (value === null || value === undefined) continue;
      args.push("-F", `${key}=${value}`);
    }
    const output = runGhImpl(args, { input: query });
    try {
      return JSON.parse(output);
    } catch (error) {
      throw new Error(`GitHub CLI returned malformed JSON: ${error.message}`);
    }
  },
});

const parseGhJson = (output, command) => {
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`${command} returned malformed JSON: ${error.message}`);
  }
};

export const resolveCliTarget = (options, runGhImpl = runGh) => {
  const fromUrl = parsePullRequestUrl(options.pr);
  if (fromUrl && options.repository && options.repository !== fromUrl.repository) {
    throw new Error(`--repo '${options.repository}' conflicts with PR URL repository '${fromUrl.repository}'`);
  }

  let repository = fromUrl?.repository ?? options.repository;
  if (!repository) {
    const repo = parseGhJson(runGhImpl(["repo", "view", "--json", "nameWithOwner"]), "gh repo view");
    repository = repo.nameWithOwner;
  }
  splitRepository(repository);

  let prNumber = fromUrl?.prNumber;
  if (!prNumber && options.pr) {
    if (!/^\d+$/.test(options.pr)) throw new Error(`Invalid --pr '${options.pr}'; expected a number or GitHub PR URL`);
    prNumber = Number(options.pr);
  }
  if (!prNumber) {
    const pr = parseGhJson(runGhImpl(["pr", "view", "--json", "number"]), "gh pr view");
    prNumber = Number(pr.number);
  }
  if (!Number.isInteger(prNumber) || prNumber <= 0) throw new Error("Unable to resolve a positive PR number");

  return { repository, prNumber };
};

const usage = `Usage: node fetch-pr-review-state.mjs [--repo OWNER/REPO] [--pr NUMBER|URL] [--captured-at ISO]`;

export const runCli = async (argv, { runGhImpl = runGh, stdout = process.stdout } = {}) => {
  const options = parseCliArgs(argv);
  if (options.help) {
    stdout.write(`${usage}\n`);
    return;
  }
  runGhImpl(["auth", "status"]);
  const target = resolveCliTarget(options, runGhImpl);
  const result = await fetchPrReviewState({
    client: createGhClient(runGhImpl),
    ...target,
    capturedAt: options.capturedAt,
  });
  stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runCli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`fetch-pr-review-state: ${redactSensitive(error.message)}\n`);
    process.exitCode = 1;
  });
}
