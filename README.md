# Allay for VS Code

VS Code support for the [Allay](https://github.com/pkusoftwareengineeringteam/allay) blog template language. This extension provides syntax highlighting, IntelliSense, and a live preview feature to make template development easier and more efficient.

## ✨ Features

### 1. Syntax Highlighting
Provides syntax highlighting for Allay code blocks in `.html` and `.markdown` files, including:
* **Command Blocks**: `{- set $var = ... -}`
* **Expression Blocks**: `{: $var :}`
* **Shortcodes**: `{< tag ... >}`

### 2. IntelliSense
Context-aware code completion to boost your productivity:
* **Code Blocks**: Automatically closes tags when you type `{-`, `{:`, ` {<`, or `{%`.
* **Keywords**: Completion for control keywords like `if`, `for`, `set`, `include`, `extends`, etc.
* **Variables**:
    * Built-in variables: `site`, `this`, `pages`, `param`.
    * Custom variables: Automatically scans variables defined via `set` and `for` in the current context.
    * Front-matter: Automatically recognizes YAML front-matter fields in the current page.
    * Configuration: Reads fields from `allay.toml`.
* **Paths**: Auto-completion for file paths in `templates/` directory when using `include` or `extends`.
* **Shortcodes**: Scans and suggests components from the `shortcodes/` directory.

### 3. Live Preview
Real-time preview of your Allay templates directly within VS Code.
* **Integrated View**: View the rendered page side-by-side with your code.
* **Auto-Refresh**: The preview automatically updates as you edit your templates.

## ⚙️ Extension Settings

This extension contributes the following settings:

* `allay.path`: Specifies the file path to the `allay` executable.
    * **Default**: `allay` (assumes Allay is in your system's PATH environment variable).
    * If Allay is not in your PATH, please provide the full absolute path (e.g., `D:/bin/allay.exe` or `/usr/local/bin/allay`).

## 🚀 Usage

1.  Ensure you have the [Allay CLI](https://github.com/pkusoftwareengineeringteam/allay) installed and configured (or set the path in extension settings).
2.  Open your Allay blog project folder in VS Code.
3.  Click the **Allay** icon in the **Activity Bar** (the navigation bar on the far left).
4.  Click the **Start Preview** button in the view that appears.

## 📝 Known Issues

## 📅 Change Log

See [CHANGELOG.md](CHANGELOG.md)