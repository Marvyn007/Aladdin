# Resume Editor UI - Test Plan

## Manual Test Cases

### 1. Wheel scrolls panels when cursor is over them
- Open resume editor
- Move cursor to left Content panel
- Scroll mouse wheel - panel should scroll
- Move cursor to right Design panel
- Scroll mouse wheel - panel should scroll
- Expected: Panels scroll normally

### 2. Wheel zooms preview when cursor is elsewhere
- Move cursor to preview area (center)
- Scroll mouse wheel - preview should zoom
- Move cursor to background outside resume card
- Scroll mouse wheel - preview should zoom
- Expected: Preview zooms and shows zoom indicator (e.g., "70%")

### 3. Zoom constraints work correctly
- Zoom in/out multiple times
- Verify zoom stays within 0.4 - 2.0 range (40% - 200%)
- Expected: Zoom indicator shows clamped values

### 4. Draggable handles resize panels
- Grab left handle (between left panel and preview)
- Drag to resize panel width
- Expected: Panel resizes smoothly, constrained to 240-420px range
- Grab right handle (between preview and right panel)
- Drag to resize
- Expected: Panel resizes smoothly

### 5. Dragging below threshold collapses panel
- Drag left handle to the left until panel collapses
- Expected: Panel collapses (width becomes 0)
- Click expand button to restore panel
- Expected: Panel expands back to previous width

### 6. Hide icons swap correctly
- Click left panel hide button
- Expected: Icon changes from panel-left-close to panel-left-open
- Click again to show
- Expected: Icon changes back

### 7. Scrollbars show only on hover
- View left or right panel
- Scrollbars should be hidden by default
- Hover over panel area
- Expected: Scrollbar appears on the side

### 8. Accessibility
- Verify handles have aria-label attributes
- Tab to handle elements
- Expected: Screen reader announces "Resize content panel" / "Resize design panel"

## Test Setup
1. Navigate to `/resume-editor/[jobId]`
2. Ensure browser window is at least 1200px wide
3. Use mouse with wheel (or trackpad)
