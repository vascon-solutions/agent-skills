import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchPrReviewState,
  parseCliArgs,
  parsePullRequestUrl,
  redactSensitive,
} from "./fetch-pr-review-state.mjs";

const page = (nodes, hasNextPage = false, endCursor = null) => ({
  nodes,
  pageInfo: { hasNextPage, endCursor },
});

const author = (login) => ({ login });

const operationName = (query) => query.match(/query\s+(\w+)/)?.[1];

const createClient = (responses) => {
  const calls = [];
  return {
    calls,
    async graphql(query, variables) {
      const operation = operationName(query);
      calls.push({ operation, variables });
      const key = [operation, variables.threadId ?? "", variables.cursor ?? ""].join(":");
      const response = responses[key];
      if (response instanceof Error) throw response;
      if (!response) throw new Error(`Unexpected GraphQL call: ${key}`);
      return response;
    },
  };
};

test("fetchPrReviewState paginates, deduplicates, and normalizes all review surfaces", async () => {
  const client = createClient({
    "PullRequestMeta::": {
      data: {
        repository: {
          pullRequest: {
            number: 5,
            url: "https://github.com/vascon-solutions/agent-skills/pull/5",
            title: "Example",
            state: "OPEN",
            isDraft: true,
            headRefName: "delivery-contract-task-doc",
            headRefOid: "abc123",
            reviewDecision: null,
          },
        },
      },
    },
    "PullRequestComments::": {
      data: {
        repository: {
          pullRequest: {
            comments: page([
              {
                id: "IC_2",
                databaseId: 2,
                body: "Second",
                url: "https://example.test/comment/2",
                createdAt: "2026-08-04T12:02:00Z",
                updatedAt: "2026-08-04T12:02:00Z",
                author: author("reviewer"),
              },
            ], true, "comments-2"),
          },
        },
      },
    },
    "PullRequestComments::comments-2": {
      data: {
        repository: {
          pullRequest: {
            comments: page([
              {
                id: "IC_1",
                databaseId: 1,
                body: "First",
                url: "https://example.test/comment/1",
                createdAt: "2026-08-04T12:01:00Z",
                updatedAt: "2026-08-04T12:01:00Z",
                author: author("reviewer"),
              },
              {
                id: "IC_2",
                databaseId: 2,
                body: "Second duplicate",
                url: "https://example.test/comment/2",
                createdAt: "2026-08-04T12:02:00Z",
                updatedAt: "2026-08-04T12:02:00Z",
                author: author("reviewer"),
              },
            ]),
          },
        },
      },
    },
    "PullRequestReviews::": {
      data: {
        repository: {
          pullRequest: {
            reviews: page([
              {
                id: "PRR_1",
                databaseId: 10,
                state: "CHANGES_REQUESTED",
                body: "Please adjust this",
                url: "https://example.test/review/1",
                submittedAt: "2026-08-04T12:03:00Z",
                updatedAt: "2026-08-04T12:03:00Z",
                author: author("reviewer"),
              },
            ]),
          },
        },
      },
    },
    "PullRequestThreads::": {
      data: {
        repository: {
          pullRequest: {
            reviewThreads: page([
              {
                id: "THREAD_B",
                isResolved: false,
                isOutdated: false,
                path: "src/b.js",
                line: 12,
                startLine: 10,
                diffSide: "RIGHT",
                resolvedBy: null,
                comments: page([], false, null),
              },
            ], true, "threads-2"),
          },
        },
      },
    },
    "PullRequestThreads::threads-2": {
      data: {
        repository: {
          pullRequest: {
            reviewThreads: page([
              {
                id: "THREAD_A",
                isResolved: false,
                isOutdated: true,
                path: "src/a.js",
                line: null,
                startLine: null,
                diffSide: "RIGHT",
                resolvedBy: null,
                comments: page([
                  {
                    id: "PRRC_2",
                    databaseId: 22,
                    body: "Reply two",
                    url: "https://example.test/thread-comment/2",
                    createdAt: "2026-08-04T12:05:00Z",
                    updatedAt: "2026-08-04T12:05:00Z",
                    author: author("author"),
                  },
                  {
                    id: "PRRC_1",
                    databaseId: 21,
                    body: "Reply one",
                    url: "https://example.test/thread-comment/1",
                    createdAt: "2026-08-04T12:04:00Z",
                    updatedAt: "2026-08-04T12:04:00Z",
                    author: author("reviewer"),
                  },
                ], true, "thread-comments-2"),
              },
            ]),
          },
        },
      },
    },
    "ReviewThreadComments:THREAD_A:thread-comments-2": {
      data: {
        node: {
          comments: page([
            {
              id: "PRRC_3",
              databaseId: 23,
              body: "Reply three",
              url: "https://example.test/thread-comment/3",
              createdAt: "2026-08-04T12:06:00Z",
              updatedAt: "2026-08-04T12:06:00Z",
              author: author("reviewer"),
            },
            {
              id: "PRRC_2",
              databaseId: 22,
              body: "Reply two duplicate",
              url: "https://example.test/thread-comment/2",
              createdAt: "2026-08-04T12:05:00Z",
              updatedAt: "2026-08-04T12:05:00Z",
              author: author("author"),
            },
          ]),
        },
      },
    },
  });

  const result = await fetchPrReviewState({
    client,
    repository: "vascon-solutions/agent-skills",
    prNumber: 5,
    capturedAt: "2026-08-04T12:10:00.000Z",
  });

  assert.deepEqual(result.pullRequest, {
    number: 5,
    url: "https://github.com/vascon-solutions/agent-skills/pull/5",
    title: "Example",
    state: "OPEN",
    isDraft: true,
    headRefName: "delivery-contract-task-doc",
    headRefOid: "abc123",
    reviewDecision: null,
  });
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.capturedAt, "2026-08-04T12:10:00.000Z");
  assert.equal(result.repository, "vascon-solutions/agent-skills");
  assert.deepEqual(result.conversationComments.map(({ id }) => id), ["IC_1", "IC_2"]);
  assert.equal(result.conversationComments[0].author, "reviewer");
  assert.deepEqual(result.reviews.map(({ id }) => id), ["PRR_1"]);
  assert.deepEqual(result.reviewThreads.map(({ id }) => id), ["THREAD_A", "THREAD_B"]);
  assert.equal(result.reviewThreads[0].line, null);
  assert.deepEqual(result.reviewThreads[0].comments.map(({ id }) => id), ["PRRC_1", "PRRC_2", "PRRC_3"]);
  assert.equal(client.calls.filter(({ operation }) => operation === "PullRequestComments").length, 2);
  assert.equal(client.calls.filter(({ operation }) => operation === "ReviewThreadComments").length, 1);
});

test("fetchPrReviewState rejects a paginated connection without an end cursor", async () => {
  const client = createClient({
    "PullRequestMeta::": {
      data: { repository: { pullRequest: { number: 1, url: "u", title: "t", state: "OPEN", isDraft: false, headRefName: "h", headRefOid: "o", reviewDecision: null } } },
    },
    "PullRequestComments::": {
      data: { repository: { pullRequest: { comments: page([], true, null) } } },
    },
    "PullRequestReviews::": {
      data: { repository: { pullRequest: { reviews: page([]) } } },
    },
    "PullRequestThreads::": {
      data: { repository: { pullRequest: { reviewThreads: page([]) } } },
    },
  });

  await assert.rejects(
    fetchPrReviewState({ client, repository: "owner/repo", prNumber: 1, capturedAt: "2026-08-04T00:00:00.000Z" }),
    /endCursor/,
  );
});

test("fetchPrReviewState surfaces GraphQL errors without returning partial state", async () => {
  const client = createClient({
    "PullRequestMeta::": { errors: [{ message: "API rate limit exceeded" }] },
  });

  await assert.rejects(
    fetchPrReviewState({ client, repository: "owner/repo", prNumber: 1, capturedAt: "2026-08-04T00:00:00.000Z" }),
    /API rate limit exceeded/,
  );
});

test("CLI parsing accepts PR URLs and explicit overrides", () => {
  assert.deepEqual(parsePullRequestUrl("https://github.com/vascon-solutions/agent-skills/pull/5"), {
    repository: "vascon-solutions/agent-skills",
    prNumber: 5,
  });
  assert.equal(parsePullRequestUrl("5"), null);
  assert.deepEqual(
    parseCliArgs(["--repo", "vascon-solutions/agent-skills", "--pr", "5", "--captured-at", "2026-08-04T12:00:00Z"]),
    { repository: "vascon-solutions/agent-skills", pr: "5", capturedAt: "2026-08-04T12:00:00Z", help: false },
  );
  assert.throws(() => parseCliArgs(["--unknown"]), /Unknown argument/);
});

test("redactSensitive removes GitHub and bearer credentials", () => {
  const redacted = redactSensitive("token ghp_abcdefghijklmnopqrstuvwxyz0123456789 bearer secret-value");
  assert.doesNotMatch(redacted, /ghp_|secret-value/);
  assert.match(redacted, /\[REDACTED\]/);
});
