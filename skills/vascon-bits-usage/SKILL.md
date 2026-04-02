---
name: vascon-bits-usage
description: Use components, hooks, and utilities from the vascon-bits component library correctly. Covers import paths, variant APIs, compound component composition, styling conventions, and React patterns. Use when building UI with this library.
user-invocable: false
---

# Vascon Bits Component Library

A comprehensive React component library built on Radix UI primitives with TanStack integrations. Components are consumed via npm package with Tailwind CSS styling.

> **IMPORTANT:** All imports come from `@vascon-solutions/bits`. Never import from internal paths like `src/components/button/button.tsx`.

## Imports

```typescript
import {
  // Components
  Button,
  Modal,
  Table,
  Input,
  Tabs,
  Accordion,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  // Hooks
  useDisclosure,
  useControllableState,
  useDebounce,
  // Utilities
  cn,
} from "@vascon-solutions/bits";
```

Styles must be imported once in your app entry point:

```typescript
import "@vascon-solutions/bits/style.css";
```

## Principles

1. **Use library components first.** Check the component list below before writing custom markup.
2. **Use built-in variants before custom styles.** `variant="outline"`, `size="sm"`, etc.
3. **Compose compound components correctly.** Use all required sub-components.
4. **className is for layout only.** Never override colors, typography, or internal styles.
5. **Avoid unnecessary Effects.** Calculate derived state during render, use event handlers for user actions.

## Critical Rules

These rules are **always enforced**. Each links to a file with Incorrect/Correct code pairs.

### Styling & Tailwind → [styling.md](./rules/styling.md)

- **`v:` prefix required inside library code.** Consumer code does NOT use `v:` prefix.
- **Use `cn()` for class merging.** Never manual string concatenation or template literals.
- **`className` for layout only.** `w-full`, `mt-4`, `max-w-md` — never override colors or typography.
- **Use built-in variants first.** `variant="outline"` not `className="border bg-transparent"`.
- **Use component-specific className props.** `overlayClassName`, `contentClassName`, `triggerClassName`.
- **No raw Tailwind colors.** Use Badge variants or semantic tokens, not `text-green-500`.

### Component Composition → [composition.md](./rules/composition.md)

- **Button uses `variant` and `size` props.** Never className for size/color changes.
- **Button with links uses `asChild`.** `<Button asChild><a href="...">` — never nest `<a>` inside `<Button>`.
- **Modal requires `trigger` and `title`.** Always provide both for functionality and accessibility.
- **Drawer is for side panels.** Not Modal. Different animation and positioning.
- **Table uses `Table.Root` + compound parts.** `Table.Header`, `Table.Body`, `Table.Content`, `Table.Pagination`.
- **Tabs uses the `tabs` array prop.** Not manual `TabsTrigger` composition.
- **Accordion uses compound parts.** `AccordionItem`, `AccordionTrigger`, `AccordionContent`.
- **DropdownMenu uses named exports.** `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuGroup`.
- **Tooltip wraps trigger with `Tooltip` component.** Pass `content` prop for tooltip text.
- **EmptyState for empty content.** Never custom `div` with centered text and icon.
- **Skeleton for loading placeholders.** Never custom `animate-pulse` divs.
- **LoadingIndicator for spinners.** Never custom spinning divs.
- **Badge for status indicators.** Never custom styled spans.
- **Alert/Banner for notices.** Never custom callout divs.

### Forms & Inputs → [forms.md](./rules/forms.md)

- **Input icons use `icon` + `iconPosition` props.** Never manual absolute positioning.
- **Input states use `variant="error"`.** Never custom red border classes.
- **Input sizes use `size` prop.** `sm`, `default`, `lg` — never className for height.
- **Password toggle is built-in.** `type="password"` automatically shows toggle. Never build custom.
- **Number input blocks invalid chars.** Built-in. Never manual `onKeyDown` filtering.
- **Switch for settings, Checkbox for forms.** Semantic difference in purpose.
- **NativeSelect for simple dropdowns.** When you don't need search or custom styling.
- **MultiSelect/MultipleCombo for searchable.** When users need to search options.
- **DatePicker for date selection.** Built on react-day-picker.
- **CurrencyInput for money fields.** Has formatting built-in.
- **TextArea for multi-line text.** Never Input with custom height.
- **TextEditor for rich text.** Built on Tiptap.
- **Dropzone/DropzoneUploader for file upload.** Built on react-dropzone.
- **Controlled inputs need `value` + `onChange`.** Both together, always.
- **Uncontrolled inputs use `defaultValue`.** Not `value` without `onChange`.

### Hooks → [hooks.md](./rules/hooks.md)

- **`useDisclosure` for open/close state.** Returns `{ open, onOpen, onClose, onToggle }`.
- **`useControllableState` for controlled/uncontrolled.** Single hook handles both patterns.
- **`useComposedRefs` for merging refs.** When you need forwardRef + local ref.
- **`useClickOutside` for dismiss on outside click.** Pass ref and callback.
- **`useDebounce` for rate limiting.** Search inputs, API calls.
- **`useMediaQuery` for responsive logic.** When CSS media queries aren't enough.
- **`useUrlQuery` for URL state sync.** Tabs component uses this automatically.

### React Patterns → [no-unnecessary-effect.md](./rules/no-unnecessary-effect.md)

- **Don't use Effect for derived state.** `const fullName = first + last` — calculate during render.
- **Use `useMemo` for expensive calculations.** Not useEffect + setState.
- **Use `key` prop to reset component state.** Not useEffect watching props.
- **Event handlers for user actions.** Not useEffect checking state changes.
- **Avoid Effect chains.** Calculate all state updates in single event handler.
- **`useSyncExternalStore` for external subscriptions.** Not manual useEffect listeners.

---

## Component Reference

### Buttons & Actions

| Component | Usage                    | Key Props                                             |
| --------- | ------------------------ | ----------------------------------------------------- |
| `Button`  | Primary action component | `variant`, `size`, `asChild`, `isLoading`, `disabled` |

```tsx
<Button variant="default">Primary</Button>
<Button variant="destructive" size="sm">Delete</Button>
<Button variant="outline" isLoading>Saving...</Button>
<Button asChild><a href="/dashboard">Go to Dashboard</a></Button>
```

**Button variants:** `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `warning`
**Button sizes:** `default`, `sm`, `lg`, `icon`

---

### Overlays & Modals

| Component    | Usage                     | Key Props                                                              |
| ------------ | ------------------------- | ---------------------------------------------------------------------- |
| `Modal`      | Centered dialog           | `trigger`, `title`, `description`, `open`, `onOpenChange`, `showClose` |
| `ModalClose` | Close button inside Modal | `asChild`                                                              |
| `Drawer`     | Side panel overlay        | `trigger`, `title`, `side`                                             |
| `Tooltip`    | Hover information         | `content`, `side`, `align`                                             |

```tsx
// Modal - always provide trigger and title
<Modal
  trigger={<Button>Open</Button>}
  title="Confirm Action"
  description="This cannot be undone."
>
  <p>Are you sure?</p>
  <ModalClose asChild>
    <Button variant="outline">Cancel</Button>
  </ModalClose>
  <Button variant="destructive">Delete</Button>
</Modal>

// Drawer - side panel
<Drawer trigger={<Button>Open Panel</Button>} title="Settings" side="right">
  <p>Panel content</p>
</Drawer>

// Tooltip
<Tooltip content="More information here">
  <Button variant="ghost" size="icon"><InfoIcon /></Button>
</Tooltip>
```

---

### Forms & Inputs

| Component          | Usage                   | Key Props                                         |
| ------------------ | ----------------------- | ------------------------------------------------- |
| `Input`            | Text input              | `variant`, `size`, `icon`, `iconPosition`, `type` |
| `TextArea`         | Multi-line text         | `variant`, `size`                                 |
| `NativeSelect`     | Simple dropdown         | `value`, `onChange`, `children`                   |
| `MultiSelect`      | Searchable multi-select | `options`, `value`, `onChange`                    |
| `MultipleCombo`    | Combobox with search    | `options`, `value`, `onChange`                    |
| `Checkbox`         | Form checkbox           | `checked`, `onCheckedChange`                      |
| `CheckboxGroup`    | Multiple checkboxes     | `value`, `onValueChange`, `options`               |
| `Switch`           | Toggle switch           | `checked`, `onCheckedChange`                      |
| `Radio`            | Radio button            | `value`, `onValueChange`                          |
| `Slider`           | Range slider            | `value`, `onValueChange`, `min`, `max`            |
| `DatePicker`       | Date selection          | `value`, `onChange`, `mode`                       |
| `CurrencyInput`    | Money input             | `value`, `onChange`, `currency`                   |
| `TextEditor`       | Rich text editor        | `value`, `onChange`                               |
| `Dropzone`         | File drop area          | `onDrop`, `accept`                                |
| `DropzoneUploader` | Full file uploader      | `onUpload`, `maxFiles`                            |
| `Label`            | Form label              | `htmlFor`                                         |

```tsx
// Input with icon
<Input icon={<SearchIcon />} iconPosition="left" placeholder="Search..." />

// Input with error state
<Input variant="error" placeholder="Email" />
<span className="text-sm text-destructive">Invalid email</span>

// Password (toggle built-in)
<Input type="password" placeholder="Password" />

// Checkbox
<Checkbox checked={agreed} onCheckedChange={setAgreed} id="terms" />
<Label htmlFor="terms">I agree to terms</Label>

// Switch (for settings)
<Switch checked={darkMode} onCheckedChange={setDarkMode} />

// Native select
<NativeSelect value={country} onChange={(e) => setCountry(e.target.value)}>
  <option value="us">United States</option>
  <option value="uk">United Kingdom</option>
</NativeSelect>
```

---

### Data Display

| Component          | Usage                | Key Props                                |
| ------------------ | -------------------- | ---------------------------------------- |
| `Table.Root`       | Data table container | `columns`, `getData`, `url`, `queryKey`  |
| `Table.Content`    | Table wrapper        | —                                        |
| `Table.Header`     | Table header row     | —                                        |
| `Table.Body`       | Table body rows      | —                                        |
| `Table.Search`     | Search input         | —                                        |
| `Table.Pagination` | Page controls        | —                                        |
| `Table.Empty`      | Empty state          | —                                        |
| `Badge`            | Status indicator     | `variant`                                |
| `Tag`              | Removable tag        | `onRemove`                               |
| `Avatar`           | User avatar          | `src`, `fallback`, `size`                |
| `AvatarLabelGroup` | Avatar with text     | `avatars`, `label`                       |
| `Skeleton`         | Loading placeholder  | `className` (for size)                   |
| `LoadingIndicator` | Spinning loader      | `size`                                   |
| `EmptyState`       | Empty content        | `title`, `description`, `icon`, `action` |
| `Progress`         | Progress bar         | `value`, `max`                           |
| `ProgressSteps`    | Step indicator       | `steps`, `currentStep`                   |

```tsx
// Table - full composition
<Table.Root
  url="/api/users"
  queryKey="users"
  getData={getData}
  columns={columns}
>
  <Table.Search />
  <Table.Content>
    <Table.Header />
    <Table.Body />
  </Table.Content>
  <Table.Pagination />
  <Table.Empty />
</Table.Root>

// Badge
<Badge variant="default">Active</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="secondary">Pending</Badge>

// Empty state
<EmptyState
  icon={<SearchIcon className="h-12 w-12 text-gray-400" />}
  title="No results found"
  description="Try adjusting your search terms"
  action={<Button>Clear filters</Button>}
/>

// Skeleton
<Skeleton className="h-4 w-[200px]" />
<Skeleton className="h-10 w-full" />
```

---

### Navigation

| Component    | Usage             | Key Props                                   |
| ------------ | ----------------- | ------------------------------------------- |
| `Tabs`       | Tab navigation    | `tabs`, `defaultValue`, `urlKey`            |
| `Breadcrumb` | Breadcrumb trail  | `items`                                     |
| `Sidebar`    | Side navigation   | `items`, `collapsed`                        |
| `Pagination` | Page navigation   | `currentPage`, `totalPages`, `onPageChange` |
| `HeaderNav`  | Header navigation | `items`                                     |

```tsx
// Tabs - uses tabs array, auto URL sync
<Tabs
  defaultValue="details"
  urlKey="tab"
  tabs={[
    { key: "details", title: "Details", content: <DetailsPanel /> },
    { key: "settings", title: "Settings", content: <SettingsPanel /> },
    { key: "history", title: "History", content: <HistoryPanel />, disabled: true },
  ]}
/>

// Breadcrumb
<Breadcrumb
  items={[
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: "Widget" }, // Current page, no href
  ]}
/>
```

---

### Layout & Structure

| Component          | Usage                    | Key Props                             |
| ------------------ | ------------------------ | ------------------------------------- |
| `Card`             | Content container        | `className`                           |
| `CardHeader`       | Card header section      | `title`, `description`, `action`      |
| `Accordion`        | Collapsible sections     | `type`, `collapsible`, `defaultValue` |
| `AccordionItem`    | Single accordion section | `value`                               |
| `AccordionTrigger` | Accordion header         | `icon`, `openIcon`                    |
| `AccordionContent` | Accordion body           | —                                     |
| `Alert`            | Alert message            | `variant`                             |
| `Banner`           | Page banner              | `variant`, `dismissible`              |
| `InlineCta`        | Call to action           | `title`, `action`                     |

```tsx
// Card
<Card className="max-w-md">
  <CardHeader title="Settings" description="Manage your preferences" />
  <div className="p-4">Card content</div>
</Card>

// Accordion
<Accordion type="single" collapsible defaultValue="item-1">
  <AccordionItem value="item-1">
    <AccordionTrigger>Section 1</AccordionTrigger>
    <AccordionContent>Content for section 1</AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-2">
    <AccordionTrigger>Section 2</AccordionTrigger>
    <AccordionContent>Content for section 2</AccordionContent>
  </AccordionItem>
</Accordion>

// Alert
<Alert variant="destructive">
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Something went wrong.</AlertDescription>
</Alert>
```

---

### Menus & Dropdowns

| Component               | Usage           | Key Props             |
| ----------------------- | --------------- | --------------------- |
| `DropdownMenu`          | Action menu     | —                     |
| `DropdownMenuTrigger`   | Menu trigger    | `asChild`             |
| `DropdownMenuContent`   | Menu container  | `align`, `side`       |
| `DropdownMenuGroup`     | Group of items  | —                     |
| `DropdownMenuItem`      | Menu item       | `variant`, `onSelect` |
| `DropdownMenuSeparator` | Divider line    | —                     |
| `DropdownMenuLabel`     | Group label     | —                     |
| `CommandMenu`           | Command palette | `commands`            |

```tsx
// DropdownMenu - full composition
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Actions</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuLabel>Actions</DropdownMenuLabel>
    <DropdownMenuGroup>
      <DropdownMenuItem onSelect={() => handleEdit()}>
        <EditIcon className="mr-2 h-4 w-4" />
        Edit
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => handleDuplicate()}>
        <CopyIcon className="mr-2 h-4 w-4" />
        Duplicate
      </DropdownMenuItem>
    </DropdownMenuGroup>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="danger" onSelect={() => handleDelete()}>
      <TrashIcon className="mr-2 h-4 w-4" />
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

### Feedback

| Component         | Usage                | Key Props                        |
| ----------------- | -------------------- | -------------------------------- |
| `toast.success()` | Success notification | `{ title, description, action }` |
| `toast.error()`   | Error notification   | `{ title, description }`         |
| `toast.info()`    | Info notification    | `{ title, description }`         |
| `toast.warning()` | Warning notification | `{ title, description }`         |
| `Toasts`          | Toast container      | `position`, `duration`           |

```tsx
// Setup in app root
<Toasts position="bottom-right" duration={5000} />;

// Usage anywhere
toast.success({
  title: "Saved",
  description: "Your changes have been saved.",
  action: { label: "Undo", onClick: () => handleUndo() },
});

toast.error({
  title: "Error",
  description: "Failed to save changes.",
});
```

---

### Specialized Components

| Component                | Usage                  |
| ------------------------ | ---------------------- |
| `AccountBanner`          | Account status banner  |
| `ActivityLog`            | Activity feed          |
| `ApplicationAssignModal` | Application assignment |
| `ApplicationResubmit`    | Resubmission UI        |
| `ApplicationReview`      | Review interface       |
| `FeatureIcon`            | Feature highlight icon |
| `FileIcons`              | File type icons        |
| `FileList`               | File listing           |
| `Filter`                 | Single filter control  |
| `Filters`                | Filter group           |
| `InfoCards`              | Information cards      |
| `PageHeader`             | Page header with title |
| `Reviews`                | Review display         |
| `SystemSync`             | Sync status            |
| `TableCells`             | Pre-built table cells  |

---

## Hooks Reference

| Hook                   | Purpose                         | Returns                               |
| ---------------------- | ------------------------------- | ------------------------------------- |
| `useDisclosure`        | Boolean open/close state        | `{ open, onOpen, onClose, onToggle }` |
| `useControllableState` | Controlled/uncontrolled pattern | `[value, setValue]`                   |
| `useComposedRefs`      | Merge multiple refs             | Combined ref callback                 |
| `useClickOutside`      | Detect outside clicks           | void                                  |
| `useMediaQuery`        | Responsive breakpoints          | `boolean`                             |
| `useDebounce`          | Debounce value changes          | Debounced value                       |
| `useUrlQuery`          | URL query param sync            | `[value, setValue]`                   |
| `useUrlQueryMocker`    | Mock URL params in tests        | Context provider                      |

---

## Utilities

```typescript
import { cn } from "@vascon-solutions/bits";

// Merge classes with Tailwind conflict resolution
cn("px-4 py-2", isActive && "bg-primary", className);
```

Additional utilities: `number`, `request`, `array`, `token`, `format`, `files`, `string`.

---

## Key Dependencies

- **Radix UI** — Accessible primitives (Dialog, Dropdown, Accordion, Tabs, Tooltip)
- **TanStack Table** — Headless table with sorting, filtering, pagination
- **TanStack Virtual** — Virtual scrolling for large lists
- **TanStack Query** — Server state management (used in Table)
- **Sonner** — Toast notifications
- **Tiptap** — Rich text editor
- **react-day-picker** — Date picker
- **react-dropzone** — File upload
