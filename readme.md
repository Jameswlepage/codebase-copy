# Flatten Workspace

Flatten Workspace (Flatspace) is a Visual Studio Code extension that lets you easily copy the entire structure and contents of your open workspace as a single flattened string. This is especially useful when working with AI tools that need your entire project context as inline text, or when sharing code snippets quickly without manually concatenating multiple files.

## Features

- **Copy Flattened Workspace Content**: Copies all non-ignored files from the current workspace into your clipboard as a single comprehensive text output. Each file is separated and includes line numbers for easy reference.
- **Copy Directory Structure**: Generates a textual representation of your workspace's directory structure, ignoring specified patterns, and copies it to your clipboard.

- **Ignore Patterns**: Configure which files or directories to exclude. By default, common directories like `node_modules` and `.git` are ignored, as well as certain file types. The extension also respects `.gitignore` settings if enabled.

## Installation

### From the VS Code Marketplace

1. Open VS Code.
2. Go to the Extensions view (`View` > `Extensions` or press `Ctrl+Shift+X`).
3. Search for **"Flatten Workspace"**.
4. Click **Install**.
5. Once installed, reload or restart VS Code if prompted.

### From a VSIX File

If you've built or obtained the `flatten-workspace-0.0.1.vsix` file locally:

1. Open a terminal.
2. Run:
   ```bash
   code --install-extension flatten-workspace-0.0.1.vsix
   ```
3. Restart VS Code if needed.

## Building From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/jameswlepage/flatten-workspace.git
   ```
2. Navigate into the project directory:
   ```bash
   cd flatten-workspace
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build the extension:
   ```bash
   npm run compile
   ```
5. Package the extension:

   ```bash
   npx vsce package
   ```

   This will create a `.vsix` file (e.g. `flatten-workspace-0.0.1.vsix`).

6. Install the `.vsix`:
   ```bash
   code --install-extension flatten-workspace-0.0.1.vsix
   ```

## Usage

1. **Copying the entire workspace**:

   - Open the command palette (`Ctrl+Shift+P` on Windows/Linux, `Cmd+Shift+P` on macOS).
   - Type **"Flatten Workspace: Copy Workspace Content"** and press enter.
   - The entire filtered workspace content (based on your ignore patterns) will be copied to your clipboard.
   - Paste it wherever you need (such as into an AI tool's prompt or a code snippet platform).

2. **Copying the directory structure**:
   - Open the command palette.
   - Run **"Flatten Workspace: Copy Directory Structure"**.
   - A textual directory tree representation of your workspace is copied to your clipboard.

### Keyboard Shortcuts

- **Ctrl+Shift+C (Windows/Linux)** or **Cmd+Shift+C (macOS)**: By default, triggers the **Flatten Workspace: Copy Workspace Content** command when the editor is in focus.

## Commands

- **`flatten-workspace.copyWorkspace`**: Copies the flattened workspace content into the clipboard.
- **`flatten-workspace.copyDirectory`**: Copies just the directory structure of the workspace into the clipboard.

You can also access **"Flatten Workspace: Copy Workspace Content"** via the editor title bar menu (the icon will appear when the editor is in focus).

## Configuration

You can customize ignore patterns and other settings in your VS Code `settings.json` or through the Settings UI:

- **`flatten-workspace.ignorePatterns`** (`array`, default as shown below)  
  Patterns to exclude from the flattened output:

  ```json
  [
    "node_modules/**",
    ".git/**",
    "out/**",
    "dist/**",
    "build/**",
    "*.vsix",
    "**/*.map",
    "**/*.log",
    ".vscode/**",
    ".vscode-test/**",
    "coverage/**",
    "tmp/**",
    ".DS_Store"
  ]
  ```

- **`flatten-workspace.useGitignore`** (`boolean`, default: `true`)  
  Whether to also use `.gitignore` patterns when ignoring files.

- **`flatten-workspace.maxFileSizeKB`** (`number`, default: `1024`)  
  Maximum file size (in KB) to include in the flattened output. Larger files will be skipped.

## Example

After running **"Flatten Workspace: Copy Workspace Content"**, you might get a single text output that includes a directory listing followed by each file and its contents with line numbers, like:

```
my-project/
├── src/
│   ├── index.js
│   └── utils.js
└── package.json

--------------------------------------------------------------------------------
/src/index.js:
--------------------------------------------------------------------------------
 1 | console.log('Hello, World!');
 2 |
 3 | // Some code here
...
```

This entire output is now in your clipboard, ready to be pasted elsewhere.

## License

Flatten Workspace is licensed under the [GPL-3.0-only](LICENSE).

## Contributing

Contributions and bug reports are welcome! Please visit the [GitHub repository](https://github.com/jameswlepage/flatten-workspace) to open issues, submit feature requests, or contribute changes.
