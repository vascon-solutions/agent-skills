# Styling & Customization

This file covers correct styling patterns for all components in the library.

## Contents

- Tailwind `v:` prefix (library authors only)
- Using cn() for class merging
- className for layout only
- Component-specific className props
- Built-in variants first
- No raw Tailwind colors
- buttonVariants() and similar functions

---

## Tailwind `v:` Prefix Requirement

**This section is for library authors only.** If you are consuming the library in your project, skip this section.

Inside library source code, all Tailwind classes must use the `v:` prefix to avoid conflicts with consumer project styles.

**Incorrect (inside library code):**

```tsx
// Missing v: prefix in library component
<div className="flex items-center gap-2 text-sm text-gray-700">
  <span className="font-medium">Label</span>
</div>
```

**Correct (inside library code):**

```tsx
// All classes have v: prefix
<div className="v:flex v:items-center v:gap-2 v:text-sm v:text-gray-700">
  <span className="v:font-medium">Label</span>
</div>
```

**For consumers:** Your project code does NOT use the `v:` prefix. Use regular Tailwind classes:

```tsx
// Consumer project code - no v: prefix needed
import { Button } from "@vascon-solutions/bits";

<Button className="w-full mt-4">Submit</Button>;
```

---

## Using cn() for Class Merging

Always use `cn()` Sto merge class names. It handles conditional classes and Tailwind conflict resolution via tailwind-merge.

**Incorrect:**

```tsx
// Manual string concatenation
<div className={`px-4 py-2 ${isActive ? "bg-primary" : ""} ${className}`}>

// Template literal without cn()
<Button className={`${size === "large" ? "text-lg" : "text-sm"}`}>

// Array join
<div className={["px-4", isActive && "bg-primary", className].filter(Boolean).join(" ")}>
```

**Correct:**

```tsx
import { cn } from "@vascon-solutions/bits";

// Conditional classes
<div className={cn("px-4 py-2", isActive && "bg-primary", className)}>

// Ternary with cn()
<Button className={cn(size === "large" ? "text-lg" : "text-sm")}>

// Multiple conditions
<div className={cn(
  "base-class",
  variant === "primary" && "bg-primary text-white",
  variant === "secondary" && "bg-secondary",
  disabled && "opacity-50 cursor-not-allowed",
  className
)}>
```

---

## className for Layout Only

Use `className` for layout positioning only. Never override component colors, typography, or internal styles.

**Incorrect:**

```tsx
// Overriding colors
<Button className="bg-blue-500 hover:bg-blue-600 text-white">
  Custom blue
</Button>

// Overriding typography
<Input className="font-bold text-xl">

// Overriding internal styles
<Card className="border-red-500 shadow-none rounded-none p-0">

// Overriding size
<Button className="h-8 px-2 text-xs">
```

**Correct:**

```tsx
// Layout positioning only
<Button className="w-full">Full width</Button>
<Button className="mt-4">With margin</Button>
<Button className="ml-auto">Aligned right</Button>

<Card className="max-w-md mx-auto">Centered card</Card>

<Input className="w-64" placeholder="Fixed width" />

<Modal contentClassName="max-w-2xl">Wide modal</Modal>
```

---

## Component-Specific className Props

Many components expose multiple className props for targeted styling. Use these instead of trying to reach into component DOM.

**Incorrect:**

```tsx
// Trying to style modal overlay via children
<Modal trigger={<Button>Open</Button>} title="Title">
  <div className="bg-black/80">{/* Trying to style overlay */}</div>
</Modal>

// Trying to style dropdown position
<DropdownMenu>
  <DropdownMenuContent className="!top-10">
```

**Correct:**

```tsx
// Use component-specific className props
<Modal
  trigger={<Button>Open</Button>}
  title="Title"
  overlayClassName="bg-black/80"
  contentClassName="max-w-lg"
>
  <p>Content</p>
</Modal>

// DropdownMenu positioning via align/side props
<DropdownMenuContent align="end" side="bottom">
```

**Available className props by component:**

| Component | className props                        |
| --------- | -------------------------------------- |
| Modal     | `overlayClassName`, `contentClassName` |
| Drawer    | `overlayClassName`, `contentClassName` |
| Input     | `className`, `iconClassName`           |
| Button    | `className`                            |
| Card      | `className`                            |

---

## Built-In Variants First

Always use component variant props before adding custom styles. Variants are type-safe and maintain design consistency.

**Incorrect:**

```tsx
// Custom outline style
<Button className="border border-gray-300 bg-transparent hover:bg-gray-100">
  Outline
</Button>

// Custom destructive color
<Button className="bg-red-500 hover:bg-red-600 text-white">
  Delete
</Button>

// Custom small size
<Input className="h-8 text-sm py-1" placeholder="Small" />

// Custom badge color
<span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
  Active
</span>
```

**Correct:**

```tsx
// Use variant prop
<Button variant="outline">Outline</Button>
<Button variant="destructive">Delete</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
<Button variant="warning">Warning</Button>

// Use size prop
<Input size="sm" placeholder="Small" />
<Input size="lg" placeholder="Large" />
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>

// Use Badge component
<Badge variant="default">Active</Badge>
<Badge variant="secondary">Pending</Badge>
<Badge variant="destructive">Error</Badge>
```

---

## No Raw Tailwind Colors

Never use raw Tailwind colors for status indicators or semantic colors. Use component variants or design tokens.

**Incorrect:**

```tsx
// Raw success color
<span className="text-green-600">Success</span>
<span className="text-green-500 font-semibold">+20%</span>

// Raw error color
<span className="text-red-500">Error occurred</span>

// Raw warning
<div className="bg-yellow-100 text-yellow-800 p-4">Warning message</div>

// Raw background
<div className="bg-gray-100 border-gray-300">Container</div>
```

**Correct:**

```tsx
// Use Badge variants
<Badge variant="default">Success</Badge>
<Badge variant="secondary">+20%</Badge>
<Badge variant="destructive">Error</Badge>

// Use semantic tokens
<span className="text-destructive">Error occurred</span>

// Use Alert/Banner components
<Alert variant="warning">Warning message</Alert>
<Banner variant="warning">Warning message</Banner>

// Use Card component
<Card>Container with proper styling</Card>
```

---

## buttonVariants() and Similar Functions

Use variant functions when you need component styles outside the component itself.

**Incorrect:**

```tsx
// Manually recreating button styles
<a
  href="/page"
  className="inline-flex items-center justify-center rounded-md border border-input bg-transparent px-4 py-2 text-sm font-medium hover:bg-accent"
>
  Link as button
</a>
```

**Correct:**

```tsx
import { buttonVariants } from "@vascon-solutions/bits";

// Use buttonVariants for links
<a href="/page" className={buttonVariants({ variant: "outline" })}>
  Link as button
</a>

// With size
<a href="/page" className={buttonVariants({ variant: "default", size: "lg" })}>
  Large link button
</a>

// Combined with cn for additional classes
<a
  href="/page"
  className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-start")}
>
  Full width ghost link
</a>
```

**Alternative: Use asChild**

```tsx
// Preferred approach for links
<Button asChild variant="outline">
  <a href="/page">Link as button</a>
</Button>
```

---

## Available Variants Reference

| Component | variant values                                                               | size values                   |
| --------- | ---------------------------------------------------------------------------- | ----------------------------- |
| Button    | `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `warning` | `default`, `sm`, `lg`, `icon` |
| Input     | `default`, `error`                                                           | `default`, `sm`, `lg`         |
| Badge     | `default`, `secondary`, `destructive`, `outline`                             | —                             |
| Alert     | `default`, `destructive`                                                     | —                             |
| Banner    | `default`, `warning`, `destructive`, `info`                                  | —                             |

---

## Summary: Styling Do's and Don'ts

**DO:**

- Use `cn()` for all class merging
- Use `variant` and `size` props
- Use `className` for layout only (`w-full`, `mt-4`, `max-w-md`)
- Use component-specific className props (`overlayClassName`, etc.)
- Use Badge, Alert, Banner for styled content
- Use `buttonVariants()` when needed

**DON'T:**

- Override component colors via className
- Use raw Tailwind colors for status (`text-green-500`)
- Manually concatenate class strings
- Recreate component styles manually
- Use className for typography or internal styles
