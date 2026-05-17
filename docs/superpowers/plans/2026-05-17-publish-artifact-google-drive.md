# Publish-Artifact Google Drive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `google-drive` publish destination that uploads an artifact workspace as regular Drive files inside a Drive folder instead of converting Markdown into native Google Docs.

**Architecture:** Keep `google-docs` for native document conversion and add a separate `google-drive` destination for raw file/folder upload. Extract Google auth into `scripts/common/google-auth.js` so both destinations use the same ADC/service-account behavior. Reuse the existing HTTP wrapper, workspace file set, secret scan, metadata writer, and dry-run conventions.

**Tech Stack:** Node.js CommonJS, native `fetch` via existing `common/http.js`, Google Drive REST API v3, Node test runner.

---

### Task 1: Shared Google Auth

**Files:**
- Create: `skills/publish-artifact/scripts/common/google-auth.js`
- Modify: `skills/publish-artifact/scripts/destinations/google-docs.js`
- Test: `skills/publish-artifact/scripts/common/google-auth.test.js`

- [ ] **Step 1: Write failing auth tests**

```js
test('service account credentials outside workspace fetch a Drive token', async () => {
  const token = await googleAuth.getAccessToken({
    env: { GOOGLE_APPLICATION_CREDENTIALS: credPath },
    workspacePath,
    scriptDir,
    httpClient,
    now: new Date('2026-05-17T12:00:00Z'),
    signJwt: () => 'signed.jwt',
  });
  assert.equal(token, 'service-token');
});
```

- [ ] **Step 2: Verify red**

Run: `node --test skills/publish-artifact/scripts/common/google-auth.test.js`
Expected: FAIL because `common/google-auth.js` does not exist.

- [ ] **Step 3: Implement shared auth**

Move `assertCredentialsOutside`, ADC token fetching, service-account JWT creation, and service-account token exchange from `google-docs.js` into `common/google-auth.js`.

- [ ] **Step 4: Update google-docs**

Require `getAccessToken()` from `common/google-auth.js` and remove local auth helpers from `google-docs.js`.

- [ ] **Step 5: Verify green**

Run: `node --test skills/publish-artifact/scripts/common/google-auth.test.js skills/publish-artifact/scripts/destinations/google-docs.test.js`
Expected: PASS.

### Task 2: Google Drive Raw Upload Driver

**Files:**
- Create: `skills/publish-artifact/scripts/destinations/google-drive.js`
- Create: `skills/publish-artifact/scripts/destinations/google-drive.test.js`
- Modify: `skills/publish-artifact/scripts/publish-artifact.js`

- [ ] **Step 1: Write failing driver tests**

```js
test('google-drive driver creates slug folder and uploads raw workspace files', async () => {
  const result = await googleDrive.publish({ workspace, files, flags, ctx });
  assert.equal(result.uploaded.length, 3);
  assert.equal(result.folderUrl, 'https://drive.google.com/drive/folders/folder-demo');
});
```

- [ ] **Step 2: Verify red**

Run: `node --test skills/publish-artifact/scripts/destinations/google-drive.test.js`
Expected: FAIL because the driver does not exist.

- [ ] **Step 3: Implement driver**

The driver validates `--google-folder` or `GOOGLE_DRIVE_PARENT_ID`, creates or finds a child folder named `<slug>`, creates subfolders for file path directories, searches by exact file name and parent, uploads raw file bytes with original MIME types, updates only with `--force`, and returns metadata lines plus report lines.

- [ ] **Step 4: Wire CLI**

Add `google-drive` to valid `--to` values, usage text, driver imports, and driver selection.

- [ ] **Step 5: Verify green**

Run: `node --test skills/publish-artifact/scripts/destinations/google-drive.test.js skills/publish-artifact/scripts/publish-artifact.test.js`
Expected: PASS.

### Task 3: Docs, Env, and Full Verification

**Files:**
- Modify: `skills/publish-artifact/SKILL.md`
- Modify: `skills/publish-artifact/.env.example`
- Modify: `README.md`

- [ ] **Step 1: Document destination**

Add `google-drive` to the destination list, CLI examples, validation notes, and README summary. Reuse `GOOGLE_DRIVE_PARENT_ID`; no new env var is required.

- [ ] **Step 2: Verify docs and tests**

Run:

```sh
node --test skills/**/*.test.js
git diff --check
bash bin/link-skills.sh
```

Expected: tests pass, diff check has no output, skills relink successfully.
