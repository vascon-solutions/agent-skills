---
name: vascon-bits-usage
description: Use components, hooks, and utilities from the vascon-bits component library correctly. Covers import paths, variant APIs, compound component composition, styling conventions, and testing patterns. Use when building UI with this library or adding new components to it.
---

# Vascon Bits Component Library Usage

## Purpose

Guide correct usage of the vascon-bits component library — imports, component APIs, styling conventions, composition patterns, and testing. Ensures consistency when consuming or extending library components.

## When To Use

Use when:

- building UI features that consume vascon-bits components
- debugging styling or composition issues with library components
- reviewing code that uses library components

## When Not To Use

Do not use when:

- the task involves unrelated third-party component libraries
- pure backend logic with no UI rendering
- the user explicitly wants raw HTML/CSS without library components

## Imports

All components, hooks, utilities, and types are exported from the package root:

```typescript
import {
  Button,
  Modal,
  Table,
  Input,
  useDisclosure,
  cn,
} from "@vascon-solutions/bits";
```

Styles must be imported separately:

```typescript
import "@vascon-solutions/bits/style.css";
```

## Components

The library exports 55+ components. Each lives in `src/components/<name>/` with this structure:

```
component-name/
  component-name.tsx    # Implementation
  index.ts              # Public exports
  component-name.test.tsx
  component-name.stories.tsx
  types.ts              # (optional) Separate type definitions
  variants.ts           # (optional) CVA variant definitions
  *.module.css          # (optional) CSS module styles
```

### Available Components

Accordion, AccountBanner, ActivityLog, Alert, ApplicationAssignModal, ApplicationResubmit, ApplicationReview, Avatar, AvatarLabelGroup, Badge, BadgeGroup, Banner, Breadcrumb, Button, Card, CardHeader, Checkbox, CheckboxGroup, CommandMenu, CurrencyInput, DatePicker, Drawer, Dropdown (DropdownMenu, DropdownMenuItem, etc.), Dropzone, DropzoneUploader, EmptyState, FeatureIcon, FileIcons, FileList, Filter, Filters, HeaderNav, InfoCards, InlineCta, Input, Label, LoadingIndicator, Modal, MultiSelect, MultipleCombo, NativeSelect, OldTable, PageHeader, Pagination, Progress, ProgressSteps, Radio, Reviews, Sidebar, Skeleton, Slider, Switch, SystemSync, Table, TableCells, Tabs, Tag, Text, TextArea, TextEditor, Toast, Tooltip.

## Component API Patterns

### Pattern 1: CVA Variants

Most leaf components use `class-variance-authority` for type-safe variant props.

```typescript
import { Button } from "@vascon-solutions/bits";

// Variant and size props are type-safe
<Button variant="default">Default</Button>
<Button variant="destructive" size="sm">Delete</Button>
<Button variant="outline" size="lg">Cancel</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
```

Common variant props: `variant`, `size`. The `buttonVariants` (and similar) function is also exported for use outside the component:

```typescript
import { buttonVariants } from "@vascon-solutions/bits";

<a className={buttonVariants({ variant: "outline" })} href="/page">Link styled as button</a>
```

### Pattern 2: asChild (Radix Slot)

Components with an `asChild` prop render their styling onto the child element instead of a wrapper:

```typescript
<Button asChild>
  <a href="/dashboard">Go to Dashboard</a>
</Button>
```

### Pattern 3: Compound Components (Namespaced)

Complex components use a namespace object with sub-components:

```typescript
import { Table } from "@vascon-solutions/bits";

<Table.Root columns={columns} data={data}>
  <Table.Header />
  <Table.Body />
  <Table.Pagination />
  <Table.Empty />
</Table.Root>
```

### Pattern 4: Compound Components (Named Exports)

Some compound components export sub-parts as separate named exports:

```typescript
import { Modal, ModalClose } from "@vascon-solutions/bits";

<Modal
  trigger={<Button>Open</Button>}
  title="Confirm"
  description="Are you sure?"
  open={isOpen}
  onOpenChange={setIsOpen}
>
  <ModalClose asChild>
    <Button variant="outline">Cancel</Button>
  </ModalClose>
</Modal>
```

```typescript
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem
} from "@vascon-solutions/bits";

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Options</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Edit</DropdownMenuItem>
    <DropdownMenuItem variant="danger">Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Pattern 5: Controlled and Uncontrolled

Components that manage open/closed or value state support both modes:

```typescript
// Uncontrolled (component manages its own state)
<Modal defaultOpen trigger={<Button>Open</Button>}>
  Content
</Modal>

// Controlled (parent manages state)
<Modal open={isOpen} onOpenChange={setIsOpen} trigger={<Button>Open</Button>}>
  Content
</Modal>
```

### className Overrides

All components accept a `className` prop. Classes are merged using `cn()` (clsx + tailwind-merge), so consumer classes override library defaults correctly:

```typescript
<Button className="v:w-full">Full Width</Button>
<Modal overlayClassName="v:bg-black/80" contentClassName="v:max-w-lg">...</Modal>
```

## Styling

### Tailwind `v:` Prefix

All library Tailwind classes use a `v:` prefix to avoid conflicts with consumer project styles. Always use this prefix when writing styles inside the library:

```typescript
// Correct — inside library code
"v:flex v:items-center v:gap-2 v:text-sm v:text-gray-700";

// Wrong — missing prefix inside library
"flex items-center gap-2 text-sm text-gray-700";
```

When consuming the library in an external project, your own classes do **not** need the `v:` prefix.

### cn() Utility

Use `cn()` to merge class names. It handles conditional classes and Tailwind conflict resolution:

```typescript
import { cn } from "@vascon-solutions/bits";

cn("v:px-4 v:py-2", isActive && "v:bg-primary-600", className);
```

### CSS Modules

Some complex components use CSS modules (`.module.css` files) for animations or styles that Tailwind cannot express. These are internal to the component — consumers do not interact with them.

## Hooks

```typescript
import {
  useDisclosure,
  useControllableState,
  useComposedRefs,
  useClickOutside,
  useMediaQuery,
  useDebounce,
  useUrlQuery,
  useUrlQueryMocker,
} from "@vascon-solutions/bits";
```

| Hook                   | Purpose                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `useDisclosure`        | Boolean open/close state: `{ open, onOpen, onClose, onToggle }` |
| `useControllableState` | Controlled/uncontrolled value with optional `onUpdate` callback |
| `useComposedRefs`      | Merge multiple refs into one                                    |
| `useClickOutside`      | Fire callback when click lands outside a ref element            |
| `useMediaQuery`        | Responsive breakpoint detection                                 |
| `useDebounce`          | Debounced value                                                 |
| `useUrlQuery`          | Read/write URL query parameters                                 |
| `useUrlQueryMocker`    | Mock URL query parameters in tests/stories                      |

## Utilities

```typescript
import { cn } from "@vascon-solutions/bits"; // CSS class merging
```

Additional utility modules exported from the library: `number`, `request`, `array`, `token`, `format`, `files`, `string`.

## Key Dependencies

Components build on these primitives — understand them when debugging or extending:

- **Radix UI** (`@radix-ui/*`) — accessible unstyled primitives (Dialog, Dropdown, Accordion, Tabs, Tooltip, etc.)
- **TanStack Table** (`@tanstack/react-table`) — headless table with sorting, filtering, pagination
- **TanStack Virtual** (`@tanstack/react-virtual`) — virtual scrolling for large lists
- **TanStack Query** (`@tanstack/react-query`) — server state (used in Table stories/examples)
- **Framer Motion** — animations
- **Lucide React** — icons
- **CVA** (`class-variance-authority`) — type-safe variant class generation
- **cmdk** — command menu
- **react-day-picker** — date picker
- **react-dropzone** — file upload
- **Tiptap** (`@tiptap/*`) — rich text editor

## Cautions

- Always use the `v:` prefix on Tailwind classes inside library source. Omitting it causes styles to silently fail.
- Do not import from component internals (e.g., `src/components/button/button.tsx`). Import from the package root or component index.
- Do not bypass `cn()` for className merging — direct string concatenation breaks Tailwind conflict resolution.
- The `Table` component requires `@tanstack/react-table` column definitions. Do not try to use it with plain JSX children.
- Components wrapping Radix UI primitives inherit Radix's controlled/uncontrolled patterns. Mixing both in the same render causes warnings.
