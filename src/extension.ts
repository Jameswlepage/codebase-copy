import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import ignore from "ignore";
import * as fsSync from "fs";

export async function activate(context: vscode.ExtensionContext) {
  const copyDirectoryCommand = vscode.commands.registerCommand(
    "flatten-workspace.copyDirectory",
    async () => {
      try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          vscode.window.showErrorMessage("No workspace opened.");
          return;
        }

        const rootUri = workspaceFolders[0].uri;
        const tree = await buildDirectoryTreeFromFiles(rootUri.fsPath);
        const output = printDirectoryTree(tree, "").trim();

        await vscode.env.clipboard.writeText(output);
        vscode.window.showInformationMessage(
          "Directory structure copied to clipboard!"
        );
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Error copying directory structure: ${error.message}`
        );
      }
    }
  );

  const copyWorkspaceCommand = vscode.commands.registerCommand(
    "flatten-workspace.copyWorkspace",
    async () => {
      try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          vscode.window.showErrorMessage("No workspace opened.");
          return;
        }

        const rootUri = workspaceFolders[0].uri;

        // Get ignore patterns from settings
        const config = vscode.workspace.getConfiguration("flatten-workspace");
        const ignorePatterns: string[] = config.get("ignorePatterns") || [];

        // Initialize ignore instance
        const ig = ignore().add(ignorePatterns);

        // Add .gitignore patterns if enabled
        if (config.get("useGitignore")) {
          const gitignorePath = path.join(rootUri.fsPath, ".gitignore");
          if (fsSync.existsSync(gitignorePath)) {
            const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
            ig.add(gitignoreContent);
          }
        }

        // Modify file finding to use ignore patterns
        const allFiles = await vscode.workspace.findFiles("**/*");
        const filteredFiles = allFiles.filter((file) => {
          const relativePath = path.relative(rootUri.fsPath, file.fsPath);
          return !ig.ignores(relativePath);
        });

        // Retrieve text of all files and build the representation
        const entries: any[] = [];
        for (const file of filteredFiles) {
          const relativePath = path.relative(rootUri.fsPath, file.fsPath);
          let fileContent: string;
          try {
            fileContent = await fs.readFile(file.fsPath, "utf8");
          } catch (err) {
            // If can't read file for some reason, skip
            continue;
          }

          const lines = fileContent.split("\n");
          entries.push({
            path: "/" + relativePath,
            lines: lines.map((line, idx) => {
              return { lineNumber: idx + 1, content: line };
            }),
          });
        }

        // Format the output.
        // Option 1: A text format that resembles the specification
        const textOutput = createTextRepresentation(entries);

        // Option 2: A JSON representation (if desired)
        // const jsonOutput = JSON.stringify(entries, null, 2);

        // Copy to clipboard (using the textOutput here)
        await vscode.env.clipboard.writeText(textOutput);

        vscode.window.showInformationMessage(
          "Workspace flattened and copied to clipboard!"
        );
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Error flattening workspace: ${error.message}`
        );
      }
    }
  );

  context.subscriptions.push(copyWorkspaceCommand, copyDirectoryCommand);
}

export function deactivate() {}

function createTextRepresentation(
  entries: { path: string; lines: { lineNumber: number; content: string }[] }[]
) {
  // Sort entries by path for deterministic output
  entries.sort((a, b) => a.path.localeCompare(b.path));

  let output = "";

  // Print a UNIX-like tree structure first
  // Because we have all files, we can reconstruct a sort of tree
  // However, the user provided a sample. We can either skip dynamic tree building or do a simplified version.
  // For simplicity, let's skip an actual drawn tree and just list all files. Or produce a short form:
  // If you want an actual tree representation, you'd have to build directory structure from paths, which is more involved.
  // Let's just print them grouped by directories (somewhat).

  // To get a tree-like structure, we can split paths and build a tree object:
  const tree = buildDirectoryTree(entries.map((e) => e.path));

  // Include a UNIX-like directory structure at the top
  output += printDirectoryTree(tree, "").trim() + "\n\n";

  // Now print each file detail as specified
  for (const entry of entries) {
    output +=
      "--------------------------------------------------------------------------------\n";
    output += `${entry.path}:\n`;
    output +=
      "--------------------------------------------------------------------------------\n";
    for (const lineObj of entry.lines) {
      output += `${lineObj.lineNumber.toString().padStart(2, " ")} | ${
        lineObj.content
      }\n`;
    }
    output += "\n\n";
  }

  return output.trim();
}

interface TreeNode {
  [key: string]: TreeNode | null; // directories and files
}

function buildDirectoryTree(paths: string[]): TreeNode {
  const root: TreeNode = {};
  for (const p of paths) {
    const segments = p.split("/").filter(Boolean);
    let current: TreeNode = root;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (!current[segment]) {
        // If it's the last segment, it's a file (null)
        current[segment] = i === segments.length - 1 ? null : {};
      }
      if (current[segment] !== null) {
        current = current[segment] as TreeNode;
      }
    }
  }
  return root;
}

function printDirectoryTree(
  node: TreeNode,
  indent: string,
  isLast = true
): string {
  // This recursive function tries to mimic a UNIX tree listing.
  // Node keys that map to {} are directories, keys that map to null are files.
  // Sorting keys so directories/files appear consistently.
  const keys = Object.keys(node).sort();

  let output = "";
  keys.forEach((key, index) => {
    const value = node[key];
    const last = index === keys.length - 1;
    const prefix = indent + (isLast ? "└── " : "├── ");

    if (value === null) {
      // File
      output += prefix + key + "\n";
    } else {
      // Directory
      output += prefix + key + "\n";
      const deeperIndent = indent + (isLast ? "    " : "│   ");
      output += printDirectoryTree(value, deeperIndent, last);
    }
  });

  return output;
}

async function buildDirectoryTreeFromFiles(
  rootPath: string
): Promise<TreeNode> {
  const root: TreeNode = {};

  // Get ignore patterns from settings
  const config = vscode.workspace.getConfiguration("flatten-workspace");
  const ignorePatterns: string[] = config.get("ignorePatterns") || [];

  // Initialize ignore instance
  const ig = ignore().add(ignorePatterns);

  // Add .gitignore patterns if enabled
  if (config.get("useGitignore")) {
    const gitignorePath = path.join(rootPath, ".gitignore");
    if (fsSync.existsSync(gitignorePath)) {
      const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
      ig.add(gitignoreContent);
    }
  }

  // Get all files in workspace
  const allFiles = await vscode.workspace.findFiles("**/*");
  const filteredFiles = allFiles.filter((file) => {
    const relativePath = path.relative(rootPath, file.fsPath);
    return !ig.ignores(relativePath);
  });

  // Build tree structure
  for (const file of filteredFiles) {
    const relativePath = path.relative(rootPath, file.fsPath);
    const segments = relativePath.split(path.sep).filter(Boolean);

    let current: TreeNode = root;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (!current[segment]) {
        current[segment] = i === segments.length - 1 ? null : {};
      }
      if (current[segment] !== null) {
        current = current[segment] as TreeNode;
      }
    }
  }

  return root;
}
