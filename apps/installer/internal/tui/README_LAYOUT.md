# TUI Layout System and Overflow Prevention

This document describes the layout system implemented to prevent text overflow and ensure the TUI application adapts properly to different terminal sizes.

## Features Implemented

### 1. Text Wrapping and Layout Utilities (`view_common.go`)

#### Core Functions:

- `wrapText(text, width)` - Wraps text to fit within specified width
- `truncateText(text, maxWidth)` - Truncates text with ellipsis if too long
- `ensureMaxWidth(content, maxWidth)` - Ensures content doesn't exceed width
- `getUsableWidth(totalWidth)` - Calculates usable width accounting for margins
- `getUsableHeight(totalHeight)` - Calculates usable height accounting for banner/status
- `renderWithLayout(model, content)` - Applies layout constraints to content
- `createStyledBox(content, style, maxWidth)` - Creates responsive styled boxes

### 2. Responsive Banner System (`view_banner.go`)

#### Functions:

- `getBanner()` - Returns full banner (legacy)
- `getBannerWithWidth(maxWidth)` - Returns banner sized for specific width
- `getCompactBanner()` - Returns compact banner for small terminals
- `getResponsiveBanner(terminalWidth)` - Automatically chooses appropriate banner

### 3. Enhanced Logging and Debug Views (`view_logs.go`)

- Responsive log display with text wrapping
- Height-aware log truncation
- Proper handling of long log messages

### 4. Universal Application

**All views now implement:**

- ✅ `getResponsiveBanner(m)` instead of `getBanner()`
- ✅ `maxWidth := getUsableWidth(m.width)` for width calculations
- ✅ `wrapText()` for long text content
- ✅ `createStyledBox()` for input fields and bordered content
- ✅ `renderWithLayout(m, s.String())` as return statement
- ✅ Responsive progress bars and content sizing
- ✅ Proper input field sizing for different terminal widths

**Files Updated:**

- ✅ `view_common.go` - Core functions and utilities
- ✅ `view_banner.go` - Responsive banner system
- ✅ `view_logs.go` - Debug logs with wrapping
- ✅ `view_welcome.go` - Welcome screen
- ✅ `view_k3s_check.go` - K3s detection and uninstall views
- ✅ `view_k3s_install.go` - K3s installation progress
- ✅ `view_unbind_install.go` - Unbind installation progress
- ✅ `view_install.go` - Package installation and completion
- ✅ `view_swap.go` - Swap configuration views
- ✅ `view_dns_config.go` - DNS configuration input
- ✅ `view_dns_validation.go` - DNS validation and success screens
- ✅ `view_dns_detection.go` - Network detection
- ✅ `view_registry_domain.go` - Registry domain configuration
- ✅ `view_registry_external.go` - External registry configuration
- ✅ `app.go` - Main view dispatcher with height constraints

## Benefits

### 1. Overflow Prevention

- No more text cutting off screen edges
- Intelligent text wrapping for all content
- Responsive input fields and progress bars
- Height-aware content truncation

### 2. Terminal Adaptability

- Works on terminals from 40+ columns wide
- Compact banner for small terminals
- Responsive button centering
- Proper margin and padding calculations

### 3. Better User Experience

- Consistent layout patterns across all views
- Improved readability on different screen sizes
- Professional appearance on all terminals
- Proper handling of long messages and errors

### 4. Developer Benefits

- Reusable utility functions
- Consistent patterns across codebase
- Easy to extend and maintain
- Clear separation of layout logic

## Usage Examples

```go
// Basic view pattern
func viewExample(m Model) string {
    s := strings.Builder{}

    // Responsive banner
    s.WriteString(getResponsiveBanner(m))
    s.WriteString("\n\n")

    // Calculate usable width
    maxWidth := getUsableWidth(m.width)

    // Wrap long text
    longText := "This is a very long text that might overflow..."
    for _, line := range wrapText(longText, maxWidth) {
        s.WriteString(m.styles.Normal.Render(line))
        s.WriteString("\n")
    }

    // Create responsive input box
    inputBox := createStyledBox(
        fmt.Sprintf("Input: %s", m.input.View()),
        m.styles.InputStyle,
        maxWidth - 8,
    )
    s.WriteString(inputBox)

    // Apply layout constraints
    return renderWithLayout(m, s.String())
}
```

## Configuration

The layout system uses the following constants (adjustable in `view_common.go`):

- Default margins: 8 characters (4 on each side)
- Minimum usable width: 40 characters
- Minimum usable height: 10 lines
- Banner space allowance: ~6 lines
- Input field minimum width: 20 characters

## Testing

The system has been tested with terminal widths from 40 to 200+ columns and handles edge cases gracefully.
