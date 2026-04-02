# Avoiding Unnecessary Effects

Effects are an escape hatch from React's rendering model. They let you synchronize your components with external systems. If there is no external system involved, you shouldn't need an Effect.

Based on [React documentation](https://react.dev/learn/you-might-not-need-an-effect).

## Contents

- Don't use Effect for derived state
- Use useMemo for expensive calculations
- Use key prop to reset state on prop change
- Adjust state during rendering (when necessary)
- Event handlers over Effects for user actions
- Avoid Effect chains
- Use useSyncExternalStore for external subscriptions
- Data fetching with cleanup

---

## Don't use Effect for derived state

When something can be calculated from existing props or state, calculate it during rendering. Don't put it in state and update it in an Effect.

**Incorrect:**

```tsx
function Form() {
  const [firstName, setFirstName] = useState("Taylor");
  const [lastName, setLastName] = useState("Swift");

  // 🔴 Avoid: redundant state and unnecessary Effect
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    setFullName(firstName + " " + lastName);
  }, [firstName, lastName]);

  return <span>{fullName}</span>;
}
```

```tsx
function TodoList({ todos, filter }) {
  // 🔴 Avoid: redundant state and unnecessary Effect
  const [visibleTodos, setVisibleTodos] = useState([]);

  useEffect(() => {
    setVisibleTodos(todos.filter((t) => t.status === filter));
  }, [todos, filter]);

  return <ul>{visibleTodos.map(...)}</ul>;
}
```

**Correct:**

```tsx
function Form() {
  const [firstName, setFirstName] = useState("Taylor");
  const [lastName, setLastName] = useState("Swift");

  // ✅ Good: calculated during rendering
  const fullName = firstName + " " + lastName;

  return <span>{fullName}</span>;
}
```

```tsx
function TodoList({ todos, filter }) {
  // ✅ Good: calculated during rendering
  const visibleTodos = todos.filter((t) => t.status === filter);

  return <ul>{visibleTodos.map(...)}</ul>;
}
```

---

## Use useMemo for expensive calculations

If the calculation is expensive and you want to avoid recalculating when unrelated state changes, wrap it in `useMemo`.

**Incorrect:**

```tsx
function SearchResults({ items, query }) {
  const [results, setResults] = useState([]);

  // 🔴 Avoid: Effect for derived data that could be memoized
  useEffect(() => {
    setResults(filterItems(items, query));
  }, [items, query]);

  return <ul>{results.map(...)}</ul>;
}
```

**Correct:**

```tsx
import { useMemo } from "react";

function SearchResults({ items, query }) {
  // ✅ Good: memoized expensive calculation
  const results = useMemo(
    () => filterItems(items, query),
    [items, query]
  );

  return <ul>{results.map(...)}</ul>;
}
```

---

## Use key prop to reset state on prop change

When you want to reset all state when a prop changes, use the `key` prop instead of an Effect.

**Incorrect:**

```tsx
function ProfilePage({ userId }) {
  const [comment, setComment] = useState("");

  // 🔴 Avoid: Resetting state on prop change in an Effect
  useEffect(() => {
    setComment("");
  }, [userId]);

  return <CommentForm comment={comment} onChange={setComment} />;
}
```

**Correct:**

```tsx
function ProfilePage({ userId }) {
  return (
    // ✅ Good: key tells React to remount Profile when userId changes
    <Profile userId={userId} key={userId} />
  );
}

function Profile({ userId }) {
  // State resets automatically when key changes
  const [comment, setComment] = useState("");

  return <CommentForm comment={comment} onChange={setComment} />;
}
```

---

## Adjust state during rendering (rare)

When you need to adjust some state (not all) based on a prop change, you can do it during rendering. This is preferable to an Effect but should be rare.

**Incorrect:**

```tsx
function List({ items }) {
  const [selection, setSelection] = useState(null);

  // 🔴 Avoid: Adjusting state on prop change in an Effect
  useEffect(() => {
    setSelection(null);
  }, [items]);

  return <ul>{items.map(...)}</ul>;
}
```

**Better (but complex):**

```tsx
function List({ items }) {
  const [selection, setSelection] = useState(null);
  const [prevItems, setPrevItems] = useState(items);

  // Adjust state during rendering
  if (items !== prevItems) {
    setPrevItems(items);
    setSelection(null);
  }

  return <ul>{items.map(...)}</ul>;
}
```

**Best (derive from data):**

```tsx
function List({ items }) {
  const [selectedId, setSelectedId] = useState(null);

  // ✅ Best: Calculate during rendering
  const selection = items.find((item) => item.id === selectedId) ?? null;

  return <ul>{items.map(...)}</ul>;
}
```

---

## Event handlers over Effects for user actions

Code that runs because a user did something belongs in event handlers, not Effects.

**Incorrect:**

```tsx
function ProductPage({ product, addToCart }) {
  // 🔴 Avoid: Event-specific logic inside an Effect
  useEffect(() => {
    if (product.isInCart) {
      showNotification(`Added ${product.name} to cart!`);
    }
  }, [product]);

  function handleBuyClick() {
    addToCart(product);
  }

  return <Button onClick={handleBuyClick}>Buy</Button>;
}
```

```tsx
function Form() {
  const [data, setData] = useState(null);

  // 🔴 Avoid: POST request triggered by state change
  useEffect(() => {
    if (data) {
      fetch("/api/submit", { method: "POST", body: JSON.stringify(data) });
    }
  }, [data]);

  function handleSubmit(formData) {
    setData(formData);
  }
}
```

**Correct:**

```tsx
function ProductPage({ product, addToCart }) {
  // ✅ Good: Event-specific logic in event handler
  function handleBuyClick() {
    addToCart(product);
    showNotification(`Added ${product.name} to cart!`);
  }

  return <Button onClick={handleBuyClick}>Buy</Button>;
}
```

```tsx
function Form() {
  // ✅ Good: POST request in event handler
  async function handleSubmit(formData) {
    await fetch("/api/submit", {
      method: "POST",
      body: JSON.stringify(formData),
    });
    showNotification("Submitted!");
  }

  return <form onSubmit={handleSubmit}>...</form>;
}
```

---

## Avoid Effect chains

Don't chain Effects that trigger each other by updating state.

**Incorrect:**

```tsx
function Game() {
  const [card, setCard] = useState(null);
  const [goldCardCount, setGoldCardCount] = useState(0);
  const [round, setRound] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);

  // 🔴 Avoid: Chains of Effects that trigger each other
  useEffect(() => {
    if (card !== null && card.gold) {
      setGoldCardCount((c) => c + 1);
    }
  }, [card]);

  useEffect(() => {
    if (goldCardCount > 3) {
      setRound((r) => r + 1);
      setGoldCardCount(0);
    }
  }, [goldCardCount]);

  useEffect(() => {
    if (round > 5) {
      setIsGameOver(true);
    }
  }, [round]);
}
```

**Correct:**

```tsx
function Game() {
  const [card, setCard] = useState(null);
  const [goldCardCount, setGoldCardCount] = useState(0);
  const [round, setRound] = useState(1);

  // ✅ Calculate during rendering
  const isGameOver = round > 5;

  function handlePlaceCard(nextCard) {
    if (isGameOver) {
      throw new Error("Game already ended.");
    }

    // ✅ Calculate all state updates in the event handler
    setCard(nextCard);
    if (nextCard.gold) {
      if (goldCardCount < 3) {
        setGoldCardCount(goldCardCount + 1);
      } else {
        setGoldCardCount(0);
        setRound(round + 1);
      }
    }
  }
}
```

---

## Use useSyncExternalStore for external subscriptions

For subscribing to external data sources, use `useSyncExternalStore` instead of manual Effects.

**Incorrect:**

```tsx
function useOnlineStatus() {
  // 🔴 Not ideal: Manual store subscription in an Effect
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    function updateState() {
      setIsOnline(navigator.onLine);
    }

    updateState();
    window.addEventListener("online", updateState);
    window.addEventListener("offline", updateState);

    return () => {
      window.removeEventListener("online", updateState);
      window.removeEventListener("offline", updateState);
    };
  }, []);

  return isOnline;
}
```

**Correct:**

```tsx
import { useSyncExternalStore } from "react";

function subscribe(callback) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function useOnlineStatus() {
  // ✅ Good: Built-in Hook for external store subscription
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine, // How to get value on client
    () => true, // How to get value on server (SSR)
  );
}
```

---

## Data fetching with cleanup

When fetching data in Effects, add cleanup to avoid race conditions.

**Incorrect:**

```tsx
function SearchResults({ query }) {
  const [results, setResults] = useState([]);

  // 🔴 Avoid: Fetching without cleanup logic
  useEffect(() => {
    fetchResults(query).then((json) => {
      setResults(json);
    });
  }, [query]);

  return <ul>{results.map(...)}</ul>;
}
```

**Correct:**

```tsx
function SearchResults({ query }) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    let ignore = false;

    fetchResults(query).then((json) => {
      // ✅ Good: Only update if this effect is still active
      if (!ignore) {
        setResults(json);
      }
    });

    return () => {
      ignore = true;
    };
  }, [query]);

  return <ul>{results.map(...)}</ul>;
}
```

**Best (extract to custom hook or use library):**

```tsx
// Extract data fetching to a custom hook
function useData(url) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let ignore = false;

    fetch(url)
      .then((response) => response.json())
      .then((json) => {
        if (!ignore) {
          setData(json);
        }
      });

    return () => {
      ignore = true;
    };
  }, [url]);

  return data;
}

// Or use TanStack Query (preferred for production)
import { useQuery } from "@tanstack/react-query";

function SearchResults({ query }) {
  const { data: results } = useQuery({
    queryKey: ["search", query],
    queryFn: () => fetchResults(query),
  });

  return <ul>{results?.map(...)}</ul>;
}
```

---

## Summary

| Scenario                   | Don't use Effect           | Use instead                   |
| -------------------------- | -------------------------- | ----------------------------- |
| Derived/computed data      | `useEffect` + `setState`   | Calculate during render       |
| Expensive calculations     | `useEffect` + `setState`   | `useMemo`                     |
| Reset state on prop change | `useEffect` + `setState`   | `key` prop                    |
| User interaction logic     | `useEffect` checking state | Event handlers                |
| Chained state updates      | Multiple `useEffect`       | Single event handler          |
| External subscriptions     | Manual `useEffect`         | `useSyncExternalStore`        |
| Data fetching              | Raw `useEffect`            | Custom hook or TanStack Query |

### When Effects are appropriate

Effects ARE needed for:

- Synchronizing with external systems (browser APIs, third-party widgets)
- Analytics on component mount (component was displayed)
- Setting up subscriptions that `useSyncExternalStore` can't handle
- Non-React controlled animations
