# Change Log

All notable changes to the "allay-vscode" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.2] - 2025-12-24

### Added
- Added extension icon.

## [0.0.1] - 2025-12-24

### Added
- Initial release of Allay VS Code extension.
- **Syntax Highlighting**: Support for Allay command blocks `{- ... -}`, expression blocks `{: ... :}`, and shortcodes `{< ... >}` in HTML and Markdown files.
- **IntelliSense**:
    - Auto-completion for control flow keywords (`if`, `for`, `set`, etc.).
    - Variable completion (built-in, front-matter, and config variables).
    - File path completion for `include` and `extends`.
    - Shortcode tag completion.
- **Live Preview**: Added `Allay: Open Preview` command to render templates side-by-side using the local Allay CLI.
- **Commands**: Added `Allay: Restart Service` to reload the preview server manually.