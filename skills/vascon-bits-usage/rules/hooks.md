# Hooks

## Contents

- useDisclosure for open/close state
- useControllableState for controlled/uncontrolled
- useComposedRefs for merging refs
- useClickOutside for dismissal
- useDebounce for rate limiting
- useMediaQuery for responsive logic

---

## useDisclosure

Use `useDisclosure` for boolean open/close state. Returns `{ open, onOpen, onClose, onToggle }`.

**Incorrect:**

```tsx
// Manual boolean state management
const [isOpen, setIsOpen] = useState(false);
const handleOpen = () => setIsOpen(true);
const handleClose = () => setIsOpen(false);
const handleToggle = () => setIsOpen((prev) => !prev);

<Modal open={isOpen} onOpenChange={setIsOpen}>
```

**Correct:**

```tsx
import { useDisclosure } from "@vascon-solutions/bits";

const { open, onOpen, onClose, onToggle } = useDisclosure();

<Button onClick={onOpen}>Open Modal</Button>

<Modal open={open} onOpenChange={(isOpen) => isOpen ? onOpen() : onClose()}>
  <ModalClose asChild>
    <Button variant="outline" onClick={onClose}>Cancel</Button>
  </ModalClose>
</Modal>
```

```tsx
// With default open state
const { open, onToggle } = useDisclosure({ defaultOpen: true });

<Button onClick={onToggle}>{open ? "Close" : "Open"} Panel</Button>;
```

---

## useControllableState

Use `useControllableState` for components that can be either controlled or uncontrolled. Supports optional `onUpdate` callback.

**Incorrect:**

```tsx
// Manual controlled/uncontrolled logic
function Select({ value, defaultValue, onChange }) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const handleChange = (newValue) => {
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };
  // ...
}
```

**Correct:**

```tsx
import { useControllableState } from "@vascon-solutions/bits";

function Select({ value, defaultValue, onChange }) {
  const [currentValue, setCurrentValue] = useControllableState({
    value,
    defaultValue,
    onUpdate: onChange,
  });

  return (
    <select
      value={currentValue}
      onChange={(e) => setCurrentValue(e.target.value)}
    >
      {/* options */}
    </select>
  );
}
```

---

## useComposedRefs

Use `useComposedRefs` to merge multiple refs into one. Common when forwarding refs while also using a local ref.

**Incorrect:**

```tsx
// Manual ref composition
const MyInput = forwardRef((props, forwardedRef) => {
  const localRef = useRef(null);

  useEffect(() => {
    // Try to set both refs manually
    if (typeof forwardedRef === "function") {
      forwardedRef(localRef.current);
    } else if (forwardedRef) {
      forwardedRef.current = localRef.current;
    }
  }, [forwardedRef]);

  return <input ref={localRef} {...props} />;
});
```

**Correct:**

```tsx
import { useComposedRefs } from "@vascon-solutions/bits";

const MyInput = forwardRef((props, forwardedRef) => {
  const localRef = useRef(null);
  const composedRef = useComposedRefs(forwardedRef, localRef);

  // Can use localRef.current for internal logic
  useEffect(() => {
    localRef.current?.focus();
  }, []);

  return <input ref={composedRef} {...props} />;
});
```

---

## useClickOutside

Use `useClickOutside` to detect clicks outside an element. Common for custom dropdowns or popovers.

**Incorrect:**

```tsx
// Manual click outside detection
useEffect(() => {
  const handleClick = (e) => {
    if (ref.current && !ref.current.contains(e.target)) {
      onClose();
    }
  };

  document.addEventListener("mousedown", handleClick);
  return () => document.removeEventListener("mousedown", handleClick);
}, [onClose]);
```

**Correct:**

```tsx
import { useClickOutside } from "@vascon-solutions/bits";

const ref = useRef(null);

useClickOutside(ref, () => {
  onClose();
});

return <div ref={ref}>{/* Dropdown content */}</div>;
```

---

## useDebounce

Use `useDebounce` to debounce rapidly changing values. Common for search inputs.

**Incorrect:**

```tsx
// Manual debounce with useEffect
const [search, setSearch] = useState("");
const [debouncedSearch, setDebouncedSearch] = useState("");

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(search);
  }, 300);

  return () => clearTimeout(timer);
}, [search]);
```

**Correct:**

```tsx
import { useDebounce } from "@vascon-solutions/bits";

const [search, setSearch] = useState("");
const debouncedSearch = useDebounce(search, 300);

// Use debouncedSearch for API calls
useEffect(() => {
  if (debouncedSearch) {
    fetchResults(debouncedSearch);
  }
}, [debouncedSearch]);
```

---

## useMediaQuery

Use `useMediaQuery` for responsive logic that can't be handled with CSS.

**Incorrect:**

```tsx
// Manual media query detection
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const mq = window.matchMedia("(max-width: 768px)");
  setIsMobile(mq.matches);

  const handler = (e) => setIsMobile(e.matches);
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}, []);
```

**Correct:**

```tsx
import { useMediaQuery } from "@vascon-solutions/bits";

const isMobile = useMediaQuery("(max-width: 768px)");

return isMobile ? <MobileNav /> : <DesktopNav />;
```

---

## useUrlQuery

Use `useUrlQuery` for components that sync state with URL query parameters.

**Incorrect:**

```tsx
// Manual URL search param handling
const [searchParams, setSearchParams] = useSearchParams();

const tab = searchParams.get("tab") ?? "details";
const setTab = (value) => {
  searchParams.set("tab", value);
  setSearchParams(searchParams);
};
```

**Correct:**

```tsx
import { useUrlQuery } from "@vascon-solutions/bits";

const [tab, setTab] = useUrlQuery("tab", "details");

<Tabs
  tabs={tabConfig}
  urlKey="tab"
  // Tabs component handles URL sync automatically when urlKey is provided
/>;
```

---

## Hook reference

| Hook                   | Purpose                               | Returns                               |
| ---------------------- | ------------------------------------- | ------------------------------------- |
| `useDisclosure`        | Boolean open/close state              | `{ open, onOpen, onClose, onToggle }` |
| `useControllableState` | Controlled/uncontrolled value pattern | `[value, setValue]`                   |
| `useComposedRefs`      | Merge multiple refs into one          | Combined ref callback                 |
| `useClickOutside`      | Fire callback on outside click        | void (imperative)                     |
| `useMediaQuery`        | Responsive breakpoint detection       | `boolean`                             |
| `useDebounce`          | Debounce rapidly changing value       | Debounced value                       |
| `useUrlQuery`          | Read/write URL query parameters       | `[value, setValue]`                   |
| `useUrlQueryMocker`    | Mock URL params in tests/stories      | Context provider                      |
