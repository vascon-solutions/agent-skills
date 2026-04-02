# Forms & Inputs

This file covers correct usage of all form and input components in the library.

## Contents

- Input component
- TextArea component
- Password input
- Number input
- Select components (Native, Multi, Combo)
- Checkbox and CheckboxGroup
- Switch component
- Radio component
- Slider component
- DatePicker component
- CurrencyInput component
- TextEditor component
- File upload (Dropzone, DropzoneUploader)
- Label component
- Controlled vs uncontrolled patterns

---

## Input Component

Input has `variant`, `size`, `icon`, and `iconPosition` props. Never use className for these.

**Incorrect:**

```tsx
// Custom icon positioning
<div className="relative">
  <Input placeholder="Search..." className="pl-10" />
  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
</div>

// Custom error border
<Input className="border-red-500 focus:ring-red-500" placeholder="Email" />

// Custom height
<Input className="h-8 py-1 text-sm" placeholder="Small" />

// Icon without position
<Input icon={<SearchIcon />} placeholder="Search" />
```

**Correct:**

```tsx
// Icon with position
<Input
  icon={<SearchIcon />}
  iconPosition="left"
  placeholder="Search..."
/>

<Input
  icon={<MailIcon />}
  iconPosition="right"
  placeholder="Enter email"
/>

// Error state
<Input variant="error" placeholder="Email" />
<span className="text-sm text-destructive mt-1">Invalid email address</span>

// Sizes
<Input size="sm" placeholder="Small input" />
<Input size="default" placeholder="Default input" />
<Input size="lg" placeholder="Large input" />

// Combined
<Input
  variant="error"
  size="lg"
  icon={<AlertIcon />}
  iconPosition="right"
  placeholder="Error with icon"
/>
```

---

## Password Input

Password inputs have built-in visibility toggle. Never build custom toggle.

**Incorrect:**

```tsx
// Custom password toggle
const [showPassword, setShowPassword] = useState(false);

<div className="relative">
  <Input type={showPassword ? "text" : "password"} />
  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    className="absolute right-3 top-1/2 -translate-y-1/2"
  >
    {showPassword ? <EyeOff /> : <Eye />}
  </button>
</div>;
```

**Correct:**

```tsx
// Password toggle is built-in
<Input type="password" placeholder="Enter password" />

// With label
<Label htmlFor="password">Password</Label>
<Input type="password" id="password" placeholder="Enter password" />
```

---

## Number Input

Number inputs automatically block invalid characters. Never add custom filtering.

**Incorrect:**

```tsx
// Manual key filtering
<Input
  type="number"
  onKeyDown={(e) => {
    if (['e', 'E', '+', '-'].includes(e.key)) {
      e.preventDefault();
    }
  }}
/>

// Preventing scroll wheel
<Input
  type="number"
  onWheel={(e) => e.currentTarget.blur()}
/>
```

**Correct:**

```tsx
// Built-in filtering
<Input type="number" placeholder="Enter amount" min={0} max={100} />

// With step
<Input type="number" placeholder="Quantity" min={1} step={1} />
```

---

## TextArea Component

TextArea for multi-line text. Never use Input with custom height.

**Incorrect:**

```tsx
// Input with custom height for multi-line
<Input className="h-32" placeholder="Description" />

// Raw textarea without library component
<textarea className="border rounded p-2 w-full" placeholder="Message" />
```

**Correct:**

```tsx
import { TextArea } from "@vascon-solutions/bits";

<TextArea placeholder="Enter description" rows={4} />

// With variant
<TextArea variant="error" placeholder="Description" />
<span className="text-sm text-destructive">Description is required</span>

// With size
<TextArea size="lg" placeholder="Large text area" />
```

---

## NativeSelect Component

NativeSelect for simple dropdowns without search.

**Incorrect:**

```tsx
// Raw select element
<select className="border rounded p-2" value={value} onChange={handleChange}>
  <option value="">Select...</option>
  <option value="a">Option A</option>
</select>

// DropdownMenu for form selection (wrong use case)
<DropdownMenu>
  <DropdownMenuTrigger>Select country</DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => setCountry("US")}>USA</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Correct:**

```tsx
import { NativeSelect } from "@vascon-solutions/bits";

<NativeSelect value={country} onChange={(e) => setCountry(e.target.value)}>
  <option value="">Select country...</option>
  <option value="us">United States</option>
  <option value="uk">United Kingdom</option>
  <option value="ca">Canada</option>
</NativeSelect>;
```

---

## MultiSelect and MultipleCombo

Use for searchable/multi-select dropdowns.

**Incorrect:**

```tsx
// Building custom multi-select
<div className="border rounded p-2">
  {selectedOptions.map((opt) => (
    <span key={opt} className="bg-gray-100 px-2 py-1 rounded mr-1">
      {opt} <button onClick={() => remove(opt)}>×</button>
    </span>
  ))}
  <input placeholder="Search..." onChange={handleSearch} />
</div>
```

**Correct:**

```tsx
import { MultiSelect, MultipleCombo } from "@vascon-solutions/bits";

// MultiSelect for multi-selection
<MultiSelect
  options={[
    { value: "react", label: "React" },
    { value: "vue", label: "Vue" },
    { value: "angular", label: "Angular" },
  ]}
  value={selectedValues}
  onChange={setSelectedValues}
  placeholder="Select frameworks..."
/>

// MultipleCombo for searchable combobox
<MultipleCombo
  options={users}
  value={selectedUsers}
  onChange={setSelectedUsers}
  placeholder="Search users..."
  searchPlaceholder="Type to search..."
/>
```

---

## Checkbox Component

Checkbox for form selections. Use `checked` and `onCheckedChange`.

**Incorrect:**

```tsx
// Raw HTML checkbox
<input
  type="checkbox"
  checked={agreed}
  onChange={(e) => setAgreed(e.target.checked)}
/>

// Missing onCheckedChange
<Checkbox checked={agreed} />

// Using Checkbox for settings toggle
<Checkbox checked={darkMode} onCheckedChange={setDarkMode} />
<label>Dark mode</label>
```

**Correct:**

```tsx
import { Checkbox, Label } from "@vascon-solutions/bits";

// Checkbox for form agreement
<div className="flex items-center gap-2">
  <Checkbox
    id="terms"
    checked={agreed}
    onCheckedChange={setAgreed}
  />
  <Label htmlFor="terms">I agree to the terms and conditions</Label>
</div>

// Disabled checkbox
<Checkbox checked={true} disabled />
```

---

## CheckboxGroup Component

CheckboxGroup for multiple related checkboxes.

**Incorrect:**

```tsx
// Manual checkbox group
<div>
  <Checkbox
    checked={values.includes("a")}
    onCheckedChange={() => toggle("a")}
  />
  <label>Option A</label>
  <Checkbox
    checked={values.includes("b")}
    onCheckedChange={() => toggle("b")}
  />
  <label>Option B</label>
</div>
```

**Correct:**

```tsx
import { CheckboxGroup } from "@vascon-solutions/bits";

<CheckboxGroup
  value={selectedFeatures}
  onValueChange={setSelectedFeatures}
  options={[
    { value: "notifications", label: "Email notifications" },
    { value: "updates", label: "Product updates" },
    { value: "marketing", label: "Marketing emails" },
  ]}
/>;
```

---

## Switch Component

Switch for settings/toggles. Different from Checkbox semantically.

**Incorrect:**

```tsx
// Using Checkbox for settings
<Checkbox checked={notifications} onCheckedChange={setNotifications} />
<label>Enable notifications</label>

// Raw toggle
<button
  onClick={() => setEnabled(!enabled)}
  className={enabled ? "bg-blue-500" : "bg-gray-300"}
>
  <span className={enabled ? "translate-x-5" : "translate-x-0"} />
</button>
```

**Correct:**

```tsx
import { Switch, Label } from "@vascon-solutions/bits";

// Switch for settings toggle
<div className="flex items-center justify-between">
  <Label htmlFor="notifications">Enable notifications</Label>
  <Switch
    id="notifications"
    checked={notifications}
    onCheckedChange={setNotifications}
  />
</div>

// Disabled switch
<Switch checked={true} disabled />
```

---

## Radio Component

Radio for single selection from options.

**Incorrect:**

```tsx
// Raw HTML radio
<input type="radio" name="plan" value="free" checked={plan === "free"} />
<input type="radio" name="plan" value="pro" checked={plan === "pro"} />
```

**Correct:**

```tsx
import { Radio } from "@vascon-solutions/bits";

<Radio
  value={selectedPlan}
  onValueChange={setSelectedPlan}
  options={[
    { value: "free", label: "Free Plan" },
    { value: "pro", label: "Pro Plan" },
    { value: "enterprise", label: "Enterprise Plan" },
  ]}
/>;
```

---

## Slider Component

Slider for range selection.

**Incorrect:**

```tsx
// Raw HTML range
<input
  type="range"
  min={0}
  max={100}
  value={volume}
  onChange={(e) => setVolume(Number(e.target.value))}
/>
```

**Correct:**

```tsx
import { Slider } from "@vascon-solutions/bits";

<Slider
  value={[volume]}
  onValueChange={([val]) => setVolume(val)}
  min={0}
  max={100}
  step={1}
/>

// Range slider
<Slider
  value={priceRange}
  onValueChange={setPriceRange}
  min={0}
  max={1000}
  step={10}
/>
```

---

## DatePicker Component

DatePicker for date selection. Built on react-day-picker.

**Incorrect:**

```tsx
// Raw HTML date input
<input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

// Building custom calendar
<div className="grid grid-cols-7">
  {days.map(day => <button key={day}>{day}</button>)}
</div>
```

**Correct:**

```tsx
import { DatePicker } from "@vascon-solutions/bits";

// Single date
<DatePicker
  value={selectedDate}
  onChange={setSelectedDate}
  placeholder="Select date"
/>

// Date range
<DatePicker
  mode="range"
  value={dateRange}
  onChange={setDateRange}
  placeholder="Select date range"
/>
```

---

## CurrencyInput Component

CurrencyInput for money fields with built-in formatting.

**Incorrect:**

```tsx
// Raw input with manual formatting
<Input
  type="text"
  value={formatCurrency(amount)}
  onChange={(e) => setAmount(parseCurrency(e.target.value))}
/>
```

**Correct:**

```tsx
import { CurrencyInput } from "@vascon-solutions/bits";

<CurrencyInput
  value={amount}
  onChange={setAmount}
  currency="USD"
  placeholder="Enter amount"
/>

// Different currency
<CurrencyInput
  value={amount}
  onChange={setAmount}
  currency="EUR"
/>
```

---

## TextEditor Component

TextEditor for rich text editing. Built on Tiptap.

**Incorrect:**

```tsx
// Raw contentEditable
<div contentEditable onInput={(e) => setContent(e.currentTarget.innerHTML)} />

// TextArea for rich content
<TextArea value={htmlContent} onChange={(e) => setHtmlContent(e.target.value)} />
```

**Correct:**

```tsx
import { TextEditor } from "@vascon-solutions/bits";

<TextEditor
  value={content}
  onChange={setContent}
  placeholder="Start writing..."
/>;
```

---

## File Upload Components

Dropzone and DropzoneUploader for file uploads. Built on react-dropzone.

**Incorrect:**

```tsx
// Raw file input
<input type="file" onChange={(e) => handleFiles(e.target.files)} />

// Custom drop zone
<div
  onDragOver={(e) => e.preventDefault()}
  onDrop={(e) => handleDrop(e.dataTransfer.files)}
  className="border-2 border-dashed p-8"
>
  Drop files here
</div>
```

**Correct:**

```tsx
import { Dropzone, DropzoneUploader } from "@vascon-solutions/bits";

// Simple dropzone
<Dropzone
  onDrop={(files) => handleFiles(files)}
  accept={{ "image/*": [".png", ".jpg", ".jpeg"] }}
>
  <p>Drag and drop files here, or click to select</p>
</Dropzone>

// Full uploader with preview
<DropzoneUploader
  onUpload={handleUpload}
  maxFiles={5}
  maxSize={5 * 1024 * 1024} // 5MB
  accept={{ "image/*": [] }}
/>
```

---

## Label Component

Label for accessible form labels. Always use `htmlFor`.

**Incorrect:**

```tsx
// Raw label without htmlFor
<label>Email</label>
<Input placeholder="Email" />

// Span as label
<span className="font-medium">Email</span>
<Input placeholder="Email" />
```

**Correct:**

```tsx
import { Label, Input } from "@vascon-solutions/bits";

<Label htmlFor="email">Email</Label>
<Input id="email" placeholder="Enter email" />

// With required indicator
<Label htmlFor="name">
  Name <span className="text-destructive">*</span>
</Label>
<Input id="name" required />
```

---

## Controlled vs Uncontrolled Inputs

Choose one pattern and use it correctly.

**Incorrect:**

```tsx
// Value without onChange (read-only)
<Input value={email} />

// Mixing controlled and uncontrolled
<Input value={email} defaultValue="initial@email.com" />

// Controlled but reading from form
const [email, setEmail] = useState("");

<form onSubmit={(e) => {
  const formData = new FormData(e.currentTarget);
  submit(formData.get("email")); // Should use state
}}>
  <Input value={email} onChange={(e) => setEmail(e.target.value)} name="email" />
</form>
```

**Correct:**

```tsx
// Controlled - state manages value
const [email, setEmail] = useState("");

<form onSubmit={(e) => {
  e.preventDefault();
  submit({ email }); // Use state value
}}>
  <Input
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    placeholder="Email"
  />
  <Button type="submit">Submit</Button>
</form>

// Uncontrolled - form manages value
<form onSubmit={(e) => {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
  submit({ email: formData.get("email") });
}}>
  <Input
    name="email"
    defaultValue=""
    placeholder="Email"
  />
  <Button type="submit">Submit</Button>
</form>
```
