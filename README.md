# Virtual Viewport System for Multi-Monitor Setups

This project is an innovative web application that implements a **virtual viewport system** for multi-monitor environments. It allows multiple browser windows across different monitors to be treated as a cohesive virtual world, similar to desktop environments with multiple screens. The application leverages modern web APIs like the Screen Details API and BroadcastChannel to enable seamless interaction between windows.

## What is this?

In traditional web applications, each browser window is isolated and unaware of the position or size of other windows. This system breaks this isolation by providing:

- **Virtual coordinates** that are consistent across all monitors.
- **Real-time communication** between windows (e.g., for events, shared state, timers).
- **A minimap** that visualizes all open windows and monitors.
- **Automatic assignment** of windows to monitors based on their position.

The system is particularly useful for applications like collaborative whiteboards, multi-screen presentations, or games that span multiple displays.

## Key Features

- **Multi-Monitor Support**: Detects and utilizes multiple monitors using the Screen Details API.
- **Virtual Viewport**: Creates a shared coordinate space encompassing all monitors.
- **Window Registry**: Tracks all open windows in real-time via BroadcastChannel.
- **Shared State and Events**: Enables sharing data and events between windows.
- **Minimap**: Displays an overview of all windows and monitors (optionally activatable).
- **Permission Management**: Handles permissions for accessing monitor details gracefully.
- **Responsive Design**: Adapts to various window sizes and positions.

## Prerequisites

- **Node.js** (version 18 or higher)
- **npm**, **yarn**, **pnpm**, or **bun** as package manager
- A modern web browser that supports the Screen Details API (e.g., Chrome 116+, Edge 116+)
- Multiple monitors for full functionality (optional, works on a single monitor too)

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd background-website
   ```

2. **Install dependencies**:
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   # or
   bun install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   # or
   bun dev
   ```

4. **Open browser**: Navigate to [http://localhost:3000](http://localhost:3000).

## Usage

### Getting Started

1. **Launch the application**: After starting the server, the application opens in your browser.

2. **Grant permissions**: On first visit, a dialog appears asking for permissions to access monitor details.
   - **Recommended**: Click "Grant Permission and Scan All Monitors" to detect all monitors.
   - **Alternative**: Choose "Continue Without Permission" to use only the current monitor.

3. **Open multiple windows**: Open the URL in multiple browser windows or tabs to test the system. Each window is automatically integrated into the virtual space.

### Enable Minimap

Add `?minimap=true` to the URL to display the minimap:
```
http://localhost:3000?minimap=true
```

The minimap shows:
- **Blue rectangles**: Monitors
- **Green/Yellow rectangles**: Windows (yellow for the current window)
- **Purple highlight**: The assigned monitor of the current window

### Load Layout from URL

You can load a saved layout directly via the URL:
```
http://localhost:3000?layout=vfl1.<encoded-layout>
```

The layout is automatically computed from the Screen Details API or manually.

### Specify Screen and Position via URL

You can explicitly specify the screen assignment and/or window position via URL parameters. These parameters override the automatic calculations when provided.

- **`screenId`**: Forces assignment to a specific screen (skips automatic screen assignment).
- **`screenPosition`**: Sets the window's position relative to its assigned screen (skips offset calculation).

#### Examples

1. **Specify screen only**:
   ```
   http://localhost:3000?layout=vfl1.<encoded-layout>&screenId=S1
   ```
   Assigns the window to screen `S1` and computes the offset based on the window's actual position.

2. **Specify position only**:
   ```
   http://localhost:3000?layout=vfl1.<encoded-layout>&screenPosition=pos1.%7B%22x%22%3A100%2C%22y%22%3A200%7D
   ```
   Uses automatic screen assignment but sets the viewport offset to (100, 200) relative to the assigned screen.

3. **Specify both**:
   ```
   http://localhost:3000?layout=vfl1.<encoded-layout>&screenId=S2&screenPosition=pos1.%7B%22x%22%3A50%2C%22y%22%3A150%7D
   ```
   Assigns to screen `S2` and sets the position to (50, 150).

#### Encoding

- `screenId`: Use `encodeURIComponent()` for special characters.
- `screenPosition`: Use the format `pos1.<encoded-json>`, where the JSON is `{"x": number, "y": number}` and encoded with `encodeURIComponent()`.

Use the helper functions `encodeScreenIdToUrlParam()` and `encodeScreenPositionToUrlParam()` from `src/lib/virtual/screenUtils.ts` to generate these parameters.

### Development and Customization

- **Edit the page**: Modify `src/app/page.tsx` to customize the content of the virtual world.
- **Use hooks**: Utilize the provided hooks in your components:
  - `useVirtualMouseCoordinates()`: For global mouse coordinates.
  - `useVirtualInputs()`: For input events across windows.
  - `useSharedState()`: For shared state.
- **Styling**: The application uses Tailwind CSS for styling.

## Architecture

### Core Components

- **VirtualViewportProvider**: The main provider that supplies the virtual context.
- **Minimap**: Visualizes the virtual space.
- **PermissionDialog**: Manages permissions and layout selection.

### Library (src/lib/virtual)

- **coordinates.ts**: Helper functions for coordinate transformations.
- **eventManager.ts**: BroadcastChannel-based event management.
- **inputHandler.ts**: Collects and distributes input events.
- **sharedState.ts**: Synchronizes state between windows.
- **timeManager.ts**: Shared timers and timestamps.
- **registry.ts**: Tracks windows and their positions.
- **vfl.ts**: Virtual Frame Layout - logic for monitor layouts.
- **screenUtils.ts**: Helper functions for Screen API.
- **windowId.ts**: Generates unique IDs for windows.
- **types.ts**: TypeScript types.
- **hooks/**: React hooks for easy integration.

### APIs and Technologies

- **BroadcastChannel API**: For communication between tabs/windows.
- **Screen Details API**: For detailed monitor information.
- **SessionStorage**: For persistent window IDs.
- **localStorage**: For layout and state storage.

## API Reference

### Hooks

#### useVirtualMouseCoordinates()
```typescript
const coordinates = useVirtualMouseCoordinates();
// Returns global mouse coordinates or null
```

#### useVirtualInputs()
```typescript
const inputs = useVirtualInputs();
// Returns array of input events
```

#### useSharedState(key, initialValue)
```typescript
const [value, setValue] = useSharedState('myKey', 'initial');
// Synchronizes value across all windows
```

#### useLayout()
```typescript
const { layout, permissionPending, requestPermission, computeWithoutPermission } = useLayout();
// Manages the monitor layout
```

### Classes

#### EventManager
```typescript
const em = new EventManager();
em.addEventListener('myEvent', callback);
em.dispatchEvent('myEvent', data);
```

#### SharedState
```typescript
const ss = new SharedState();
ss.set('key', value);
const value = ss.get('key');
```

#### TimeManager
```typescript
const tm = new TimeManager();
tm.startTimer('id', 1000); // 1 second
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Add tests (if applicable).
5. Submit a pull request.

### Development Guidelines

- Use TypeScript for new code.
- Keep comments in English and Doxygen style.
- Test across multiple browsers and monitor setups.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Support

For questions or issues:
- Open an issue on GitHub.
- Check browser compatibility for Screen Details API.

---

Built with [Next.js](https://nextjs.org) and modern web APIs.
