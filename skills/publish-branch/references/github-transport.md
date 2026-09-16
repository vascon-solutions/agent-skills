# GitHub Markdown And Review Threads

Use structured tool fields or file-backed arguments for user-visible Markdown. For PR bodies and top-level comments, use `--body-file`. For inline replies, encode `{ "body": "..." }` with a JSON serializer in a temporary request file and send it with `gh api --input`. Shell-escape arguments normally; do not interpolate Markdown containing backticks or command substitutions into shell code.

An inline reply targets the original review comment's database ID, using `repos/OWNER/REPO/pulls/PR/comments/ROOT_COMMENT_ID/replies`. Thread resolution uses the GraphQL thread ID. Do not confuse these IDs or reply to a reply.

After a mutation, read the remote object back once and compare it with the intended content. Record the returned object ID. If the response is uncertain, inspect remote state before retrying creation. If content differs, update that same object and verify it; do not create another comment. If repair cannot be completed, report the mismatch.

Reply success and thread-resolution success are separate. If reply succeeds but resolution fails, record `reply_sent: true`, refresh state, and retry only resolution when appropriate; never duplicate the reply. Resolve only remotely verified valid fixes or confirmed duplicate/already-resolved dispositions unless the user explicitly requests another disposition. Keep rejected, ambiguous, and out-of-scope threads visible to the reviewer.

## Concrete Commands

Prepare `reply.json` with a JSON serializer from the exact reply text; it must contain a `body` string with actual newlines. Substitute verified repository, PR, and root review-comment database IDs. This example deliberately uses a request file instead of shell-interpolated Markdown:

```sh
gh api --method POST \
  "repos/OWNER/REPO/pulls/PR/comments/ROOT_DATABASE_ID/replies" \
  --input reply.json
```

Read the returned reply back using its database ID:

```sh
gh api "repos/OWNER/REPO/pulls/comments/REPLY_DATABASE_ID"
```

After confirming the reply and the disposition's resolution eligibility, resolve the GraphQL review-thread ID:

```sh
gh api graphql \
  -f query='mutation($thread:ID!){resolveReviewThread(input:{threadId:$thread}){thread{id isResolved}}}' \
  -f thread="THREAD_GRAPHQL_ID"
```

Confirm the current thread state separately:

```sh
gh api graphql \
  -f query='query($thread:ID!){node(id:$thread){... on PullRequestReviewThread{id isResolved}}}' \
  -f thread="THREAD_GRAPHQL_ID"
```

These are mutation recipes for an already-authorized reply/resolution; reading this reference does not authorize posting or resolving threads.
