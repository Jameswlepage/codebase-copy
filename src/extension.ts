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
        const entries = await flattenPaths(rootUri.fsPath, "**/*");

        const textOutput = createTextRepresentation(entries);
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

  const copyFileOrFolderCommand = vscode.commands.registerCommand(
    "flatten-workspace.copyFileOrFolder",
    async (resource: vscode.Uri) => {
      try {
        if (!resource || !resource.fsPath) {
          vscode.window.showErrorMessage("No resource selected.");
          return;
        }

        const stat = await fs.lstat(resource.fsPath);

        // If it's a directory, flatten all files recursively inside it.
        // If it's a file, flatten just that file.
        let pattern: string;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          vscode.window.showErrorMessage("No workspace opened.");
          return;
        }

        const rootUri = workspaceFolders[0].uri;
        const rootPath = rootUri.fsPath;
        const relativeResourcePath = path.relative(rootPath, resource.fsPath);

        if (stat.isDirectory()) {
          // For directories, recursively flatten everything inside
          // Using a RelativePattern will search inside that directory only.
          const relativePattern = new vscode.RelativePattern(
            rootUri.fsPath,
            path.posix.join(relativeResourcePath.replace(/\\/g, "/"), "**/*")
          );
          const entries = await flattenPaths(rootPath, relativePattern);
          const textOutput = createTextRepresentation(entries);
          await vscode.env.clipboard.writeText(textOutput);
          vscode.window.showInformationMessage(
            "Folder flattened and copied to clipboard!"
          );
        } else if (stat.isFile()) {
          // For single file, just flatten that file
          const entries = await flattenSingleFile(rootPath, resource.fsPath);
          const textOutput = createTextRepresentation(entries);
          await vscode.env.clipboard.writeText(textOutput);
          vscode.window.showInformationMessage("File flattened and copied!");
        } else {
          vscode.window.showErrorMessage(
            "Selected resource is not a file or folder."
          );
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Error flattening selected resource: ${error.message}`
        );
      }
    }
  );

  context.subscriptions.push(
    copyWorkspaceCommand,
    copyDirectoryCommand,
    copyFileOrFolderCommand
  );
}

export function deactivate() {}

interface FileEntry {
  path: string;
  lines: { lineNumber: number; content: string }[];
}

async function flattenSingleFile(
  rootPath: string,
  filePath: string
): Promise<FileEntry[]> {
  const config = vscode.workspace.getConfiguration("flatten-workspace");
  const ignorePatterns: string[] = config.get("ignorePatterns") || [];
  const ig = ignore().add(ignorePatterns);

  if (config.get("useGitignore")) {
    const gitignorePath = path.join(rootPath, ".gitignore");
    if (fsSync.existsSync(gitignorePath)) {
      const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
      ig.add(gitignoreContent);
    }
  }

  const relativePath = path.relative(rootPath, filePath);
  if (ig.ignores(relativePath)) {
    // If ignored, return empty
    return [];
  }

  // Check file size limit
  const maxFileSizeKB = config.get("maxFileSizeKB", 1024);
  const fileStat = await fs.lstat(filePath);
  if (fileStat.size / 1024 > maxFileSizeKB) {
    return [];
  }

  let fileContent: string;
  try {
    fileContent = await fs.readFile(filePath, "utf8");
  } catch {
    // If can't read the file, skip
    return [];
  }

  const lines = fileContent.split("\n").map((content, idx) => ({
    lineNumber: idx + 1,
    content,
  }));

  return [
    {
      path: "/" + relativePath.replace(/\\/g, "/"),
      lines,
    },
  ];
}

async function flattenPaths(
  rootPath: string,
  globPattern: string | vscode.RelativePattern
): Promise<FileEntry[]> {
  const config = vscode.workspace.getConfiguration("flatten-workspace");
  const ignorePatterns: string[] = config.get("ignorePatterns") || [];
  const ig = ignore().add(ignorePatterns);

  if (config.get("useGitignore")) {
    const gitignorePath = path.join(rootPath, ".gitignore");
    if (fsSync.existsSync(gitignorePath)) {
      const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
      ig.add(gitignoreContent);
    }
  }

  const allFiles = await vscode.workspace.findFiles(globPattern);
  const maxFileSizeKB = config.get("maxFileSizeKB", 1024);
  const entries: FileEntry[] = [];

  for (const file of allFiles) {
    const relativePath = path.relative(rootPath, file.fsPath);
    if (ig.ignores(relativePath)) {
      continue;
    }

    const fileStat = await fs.lstat(file.fsPath);
    if (!fileStat.isFile()) {
      // Ignore directories; findFiles should return files, but just in case
      continue;
    }

    // Check file size limit
    if (fileStat.size / 1024 > maxFileSizeKB) {
      continue;
    }

    let fileContent: string;
    try {
      fileContent = await fs.readFile(file.fsPath, "utf8");
    } catch {
      continue;
    }

    const lines = fileContent.split("\n").map((content, idx) => ({
      lineNumber: idx + 1,
      content,
    }));

    entries.push({
      path: "/" + relativePath.replace(/\\/g, "/"),
      lines,
    });
  }

  return entries;
}

function createTextRepresentation(
  entries: { path: string; lines: { lineNumber: number; content: string }[] }[]
) {
  // Sort entries by path for deterministic output
  entries.sort((a, b) => a.path.localeCompare(b.path));

  let output = "";

  // Build a directory tree for the header
  const tree = buildDirectoryTree(entries.map((e) => e.path));

  // Include a directory structure at the top
  output += printDirectoryTree(tree, "").trim() + "\n\n";

  // Print each file's contents
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
  [key: string]: TreeNode | null;
}

function buildDirectoryTree(paths: string[]): TreeNode {
  const root: TreeNode = {};
  for (const p of paths) {
    const segments = p.split("/").filter(Boolean);
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

function printDirectoryTree(
  node: TreeNode,
  indent: string,
  isLast = true
): string {
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

  const config = vscode.workspace.getConfiguration("flatten-workspace");
  const ignorePatterns: string[] = config.get("ignorePatterns") || [];
  const ig = ignore().add(ignorePatterns);

  if (config.get("useGitignore")) {
    const gitignorePath = path.join(rootPath, ".gitignore");
    if (fsSync.existsSync(gitignorePath)) {
      const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
      ig.add(gitignoreContent);
    }
  }

  const allFiles = await vscode.workspace.findFiles("**/*");
  const filteredFiles = allFiles.filter((file) => {
    const relativePath = path.relative(rootPath, file.fsPath);
    return !ig.ignores(relativePath);
  });

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
