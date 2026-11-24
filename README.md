# Taskflow — To-Do App

A clean, fast, zero-dependency To-Do web application built with vanilla HTML, CSS, and JavaScript. Works offline right in the browser and deploys directly to GitHub Pages with no build step required.

## Features

- **Full Task Management**: Add, complete, inline-edit (double-click or edit button), and delete tasks with an **Undo** toast.
- **Organization**: Assign priority levels (`Low`, `Medium`, `High`), due dates (with overdue highlighting), and custom `#tags`.
- **Search, Filter & Sort**: Filter by status (`All`, `Active`, `Completed`) or priority, search titles and tags (press `/` to focus search), and sort by manual order, newest, priority, or due date.
- **Drag & Drop**: Reorder tasks directly in manual sort mode.
- **Progress Tracking**: Live summary of remaining, completed, and overdue tasks with a progress bar.
- **Dark Mode**: Automatic system theme detection with manual toggle saved to `localStorage`.
- **JSON Export & Import**: Back up your tasks to a JSON file or restore them anytime.

## Project Structure

```text
.
├── index.html              # App entry point (GitHub Pages ready)
├── styles.css              # Responsive light/dark theme styling
├── src/
│   ├── todo-store.js       # Pure, testable state and task logic
│   └── app.js              # DOM rendering, events, drag & drop, storage
├── tests/
│   └── todo-store.test.js  # Unit tests using Node's built-in test runner
└── package.json            # Project metadata and test script
```

## Quick Start

### Run Locally

Open `index.html` directly in your browser, or start a local static server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

### Run Tests

Requires Node.js 18+:

```bash
npm test
```

## Deploy on GitHub Pages

1. Open your repository **Settings** on GitHub.
2. Go to **Pages** in the sidebar.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose `main` and `/ (root)`, then click **Save**.
5. Your live To-Do app will be published at `https://<username>.github.io/<repo>/`.
