# Component Composition

This file covers correct composition patterns for all compound and complex components in the library.

## Contents

- Button composition
- Modal composition
- Drawer composition
- Table composition
- Tabs composition
- Accordion composition
- DropdownMenu composition
- Tooltip composition
- EmptyState vs custom markup
- Skeleton vs custom loading
- Badge vs custom styled spans
- Alert/Banner vs custom callouts
- Card composition

---

## Button Composition

Button uses CVA variants. Never use className for colors or sizes.

**Incorrect:**

```tsx
// Using className for size
<Button className="h-8 px-3 text-sm">Small</Button>

// Using className for color
<Button className="bg-red-500 hover:bg-red-600 text-white">Delete</Button>

// Nesting link inside button (invalid HTML)
<Button>
  <a href="/page">Go</a>
</Button>

// Using onClick for navigation
<Button onClick={() => router.push("/dashboard")}>Dashboard</Button>
```

**Correct:**

```tsx
// Use size prop
<Button size="sm">Small</Button>

// Use variant prop
<Button variant="destructive">Delete</Button>

// Use asChild for links
<Button asChild>
  <a href="/page">Go</a>
</Button>

// All button variants
<Button variant="default">Default</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="outline">Outline</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
<Button variant="warning">Warning</Button>

// All button sizes
<Button size="default">Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><PlusIcon /></Button>

// Loading state
<Button isLoading>Saving...</Button>
<Button isLoading disabled>Processing</Button>
```

---

## Modal Composition

Modal requires `trigger` and `title`. Use `ModalClose` for close buttons.

**Incorrect:**

```tsx
// Missing trigger - modal won't open
<Modal title="Confirm">
  <p>Content</p>
</Modal>

// Missing title - accessibility issue
<Modal trigger={<Button>Open</Button>}>
  <p>Content without context</p>
</Modal>

// Using regular button to close
<Modal trigger={<Button>Open</Button>} title="Confirm">
  <Button onClick={onClose}>Cancel</Button>
</Modal>

// Building custom modal with div
<div className="fixed inset-0 bg-black/50 flex items-center justify-center">
  <div className="bg-white rounded-lg p-6">Custom modal</div>
</div>
```

**Correct:**

```tsx
// Complete Modal composition
<Modal
  trigger={<Button>Open Modal</Button>}
  title="Confirm Action"
  description="This action cannot be undone."
  showClose={true}
>
  <p>Are you sure you want to proceed?</p>
  <div className="flex justify-end gap-3 mt-4">
    <ModalClose asChild>
      <Button variant="outline">Cancel</Button>
    </ModalClose>
    <Button variant="destructive">Delete</Button>
  </div>
</Modal>

// Controlled Modal
const [open, setOpen] = useState(false);

<Modal
  open={open}
  onOpenChange={setOpen}
  trigger={<Button>Open</Button>}
  title="Settings"
>
  <ModalClose asChild>
    <Button variant="outline">Close</Button>
  </ModalClose>
</Modal>

// Modal with custom classNames
<Modal
  trigger={<Button>Open</Button>}
  title="Large Modal"
  overlayClassName="bg-black/80"
  contentClassName="max-w-2xl"
>
  <p>Wide content area</p>
</Modal>
```

---

## Drawer Composition

Drawer is for side panels. Use `side` prop for position.

**Incorrect:**

```tsx
// Using Modal for side panel
<Modal trigger={<Button>Open Panel</Button>} title="Settings">
  <div className="w-[400px]">Panel content</div>
</Modal>

// Building custom drawer
<div className="fixed right-0 top-0 h-full w-80 bg-white">
  Custom side panel
</div>
```

**Correct:**

```tsx
// Drawer for side panel
<Drawer
  trigger={<Button>Open Panel</Button>}
  title="Settings"
  side="right"
>
  <p>Panel content goes here</p>
</Drawer>

// Drawer sides
<Drawer side="right" {...props}>Right panel</Drawer>
<Drawer side="left" {...props}>Left panel</Drawer>
<Drawer side="top" {...props}>Top panel</Drawer>
<Drawer side="bottom" {...props}>Bottom panel</Drawer>
```

---

## Table Composition

Table uses namespaced compound components. Always use the required sub-components.

**Incorrect:**

```tsx
// Missing compound parts
<Table columns={columns} data={data} />

// Using raw HTML table
<table className="w-full">
  <thead>
    <tr>{columns.map(col => <th key={col.id}>{col.header}</th>)}</tr>
  </thead>
  <tbody>
    {data.map(row => <tr key={row.id}>...</tr>)}
  </tbody>
</table>

// Mixing patterns
<Table.Root columns={columns} data={data}>
  <table>
    <thead>...</thead>
  </table>
</Table.Root>
```

**Correct:**

```tsx
// Full Table composition
<Table.Root
  url="/api/users"
  queryKey="users"
  getData={getData}
  columns={columns}
  defaultPageSize={20}
>
  <Table.Search />
  <Table.Content>
    <Table.Header />
    <Table.Body />
  </Table.Content>
  <Table.Pagination />
  <Table.Empty />
</Table.Root>

// Minimal table (no search/pagination)
<Table.Root columns={columns} getData={getData}>
  <Table.Content>
    <Table.Header />
    <Table.Body />
  </Table.Content>
  <Table.Empty />
</Table.Root>

// Table with selection
<Table.Root columns={columns} getData={getData} onSelectionChange={setSelected}>
  <Table.Selection />
  <Table.Content>
    <Table.Header />
    <Table.Body />
  </Table.Content>
</Table.Root>
```

---

## Tabs Composition

Tabs uses the `tabs` array prop with automatic URL sync.

**Incorrect:**

```tsx
// Manual trigger composition (not supported)
<Tabs>
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>

// Building custom tabs
<div>
  <div className="flex border-b">
    <button className={activeTab === 'a' ? 'border-b-2' : ''}>Tab A</button>
    <button className={activeTab === 'b' ? 'border-b-2' : ''}>Tab B</button>
  </div>
  {activeTab === 'a' && <div>Content A</div>}
</div>
```

**Correct:**

```tsx
// Tabs with tabs array prop
<Tabs
  defaultValue="details"
  tabs={[
    { key: "details", title: "Details", content: <DetailsPanel /> },
    { key: "settings", title: "Settings", content: <SettingsPanel /> },
    { key: "history", title: "History", content: <HistoryPanel /> },
  ]}
/>

// Tabs with URL sync
<Tabs
  defaultValue="details"
  urlKey="tab"
  tabs={[
    { key: "details", title: "Details", content: <DetailsPanel /> },
    { key: "settings", title: "Settings", content: <SettingsPanel /> },
  ]}
/>

// Tabs with disabled tab
<Tabs
  tabs={[
    { key: "active", title: "Active", content: <ActiveContent /> },
    { key: "disabled", title: "Disabled", content: <div />, disabled: true },
  ]}
/>

// Tabs with custom title (badge, icon)
<Tabs
  tabs={[
    {
      key: "notifications",
      title: (
        <span className="flex items-center gap-2">
          Notifications
          <Badge variant="secondary">5</Badge>
        </span>
      ),
      content: <NotificationsPanel />,
    },
  ]}
/>
```

---

## Accordion Composition

Accordion uses compound parts. Choose `type="single"` or `type="multiple"`.

**Incorrect:**

```tsx
// Missing AccordionItem wrapper
<Accordion>
  <AccordionTrigger>Title</AccordionTrigger>
  <AccordionContent>Content</AccordionContent>
</Accordion>

// Building custom accordion
<div>
  <button onClick={() => setOpen(!open)}>Toggle</button>
  {open && <div>Collapsible content</div>}
</div>
```

**Correct:**

```tsx
// Single accordion (one open at a time)
<Accordion type="single" collapsible defaultValue="item-1">
  <AccordionItem value="item-1">
    <AccordionTrigger>First Section</AccordionTrigger>
    <AccordionContent>
      Content for the first section.
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-2">
    <AccordionTrigger>Second Section</AccordionTrigger>
    <AccordionContent>
      Content for the second section.
    </AccordionContent>
  </AccordionItem>
</Accordion>

// Multiple accordion (many can be open)
<Accordion type="multiple" defaultValue={["item-1", "item-2"]}>
  <AccordionItem value="item-1">
    <AccordionTrigger>Section A</AccordionTrigger>
    <AccordionContent>Content A</AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-2">
    <AccordionTrigger>Section B</AccordionTrigger>
    <AccordionContent>Content B</AccordionContent>
  </AccordionItem>
</Accordion>

// Accordion with custom icons
<AccordionItem value="custom">
  <AccordionTrigger icon={<ChevronRight />} openIcon={<ChevronDown />}>
    Custom Icons
  </AccordionTrigger>
  <AccordionContent>Content with custom icons</AccordionContent>
</AccordionItem>
```

---

## DropdownMenu Composition

DropdownMenu uses named exports. Import all needed parts explicitly.

**Incorrect:**

```tsx
// Missing sub-component imports
import { DropdownMenu } from "@vascon-solutions/bits";

<DropdownMenu>
  <button>Trigger</button>
  <div>
    <button>Item 1</button>
    <button>Item 2</button>
  </div>
</DropdownMenu>

// Building custom dropdown
<div className="relative">
  <button onClick={() => setOpen(!open)}>Menu</button>
  {open && (
    <div className="absolute top-full bg-white shadow">
      <button>Item</button>
    </div>
  )}
</div>
```

**Correct:**

```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@vascon-solutions/bits";

// Full DropdownMenu composition
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">
      Options <ChevronDownIcon className="ml-2 h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-56">
    <DropdownMenuLabel>My Account</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuGroup>
      <DropdownMenuItem onSelect={() => handleProfile()}>
        <UserIcon className="mr-2 h-4 w-4" />
        Profile
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => handleSettings()}>
        <SettingsIcon className="mr-2 h-4 w-4" />
        Settings
      </DropdownMenuItem>
    </DropdownMenuGroup>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="danger" onSelect={() => handleLogout()}>
      <LogOutIcon className="mr-2 h-4 w-4" />
      Log out
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>;
```

---

## Tooltip Composition

Tooltip wraps the trigger element directly.

**Incorrect:**

```tsx
// Tooltip as sibling
<Button>Hover me</Button>
<Tooltip>This is the tooltip</Tooltip>

// Building custom tooltip
<div
  className="relative"
  onMouseEnter={() => setShow(true)}
  onMouseLeave={() => setShow(false)}
>
  <Button>Hover</Button>
  {show && <div className="absolute bg-black text-white">Tooltip</div>}
</div>
```

**Correct:**

```tsx
// Tooltip wrapping trigger
<Tooltip content="More information about this action">
  <Button variant="ghost" size="icon">
    <InfoIcon />
  </Button>
</Tooltip>

// Tooltip with positioning
<Tooltip content="Help text" side="right" align="start">
  <span className="underline cursor-help">What is this?</span>
</Tooltip>
```

---

## EmptyState vs Custom Markup

Always use EmptyState component for empty content states.

**Incorrect:**

```tsx
// Custom empty state markup
{
  data.length === 0 && (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <SearchIcon className="h-12 w-12 text-gray-400 mb-4" />
      <h3 className="text-lg font-semibold">No results found</h3>
      <p className="text-gray-500">Try adjusting your filters</p>
      <Button className="mt-4">Clear filters</Button>
    </div>
  );
}
```

**Correct:**

```tsx
import { EmptyState } from "@vascon-solutions/bits";

{
  data.length === 0 && (
    <EmptyState
      icon={<SearchIcon className="h-12 w-12 text-gray-400" />}
      title="No results found"
      description="Try adjusting your filters"
      action={<Button>Clear filters</Button>}
    />
  );
}
```

---

## Skeleton vs Custom Loading

Always use Skeleton for loading placeholders.

**Incorrect:**

```tsx
// Custom loading placeholder
{
  isLoading && <div className="animate-pulse bg-gray-200 rounded h-4 w-full" />;
}

// Custom spinner
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />;
```

**Correct:**

```tsx
import { Skeleton, LoadingIndicator } from "@vascon-solutions/bits";

// Skeleton for content placeholders
{
  isLoading && (
    <>
      <Skeleton className="h-4 w-[250px]" />
      <Skeleton className="h-4 w-[200px]" />
      <Skeleton className="h-10 w-full" />
    </>
  );
}

// LoadingIndicator for spinners
{
  isLoading && <LoadingIndicator size="lg" />;
}
```

---

## Badge vs Custom Styled Spans

Always use Badge for status indicators.

**Incorrect:**

```tsx
// Custom status span
<span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
  Active
</span>

// Inline status text
<span className="text-red-500 font-semibold">Error</span>
```

**Correct:**

```tsx
import { Badge } from "@vascon-solutions/bits";

<Badge variant="default">Active</Badge>
<Badge variant="secondary">Pending</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Draft</Badge>
```

---

## Alert/Banner vs Custom Callouts

Always use Alert or Banner for notices.

**Incorrect:**

```tsx
// Custom callout
<div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
  <div className="flex">
    <AlertTriangle className="h-5 w-5 text-yellow-400" />
    <p className="ml-3 text-yellow-700">Warning message here</p>
  </div>
</div>
```

**Correct:**

```tsx
import { Alert, AlertTitle, AlertDescription, Banner } from "@vascon-solutions/bits";

// Alert for inline messages
<Alert variant="destructive">
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Something went wrong. Please try again.</AlertDescription>
</Alert>

// Banner for page-level notices
<Banner variant="warning" dismissible>
  Your subscription expires in 3 days.
</Banner>
```

---

## Card Composition

Card is a simple container. Use CardHeader for structured headers.

**Incorrect:**

```tsx
// Everything in one div
<div className="bg-white rounded-lg shadow p-6">
  <h3 className="font-bold">Title</h3>
  <p className="text-gray-500">Description</p>
  <div>Content</div>
</div>
```

**Correct:**

```tsx
import { Card, CardHeader } from "@vascon-solutions/bits";

// Card with CardHeader
<Card className="max-w-md">
  <CardHeader
    title="Account Settings"
    description="Manage your account preferences"
    action={<Button variant="outline" size="sm">Edit</Button>}
  />
  <div className="p-4">
    <p>Card content goes here</p>
  </div>
</Card>

// Simple Card
<Card className="p-6">
  <h3 className="font-semibold">Simple Card</h3>
  <p>Just content, no header</p>
</Card>
```
