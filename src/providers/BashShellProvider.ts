import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { AddBashScriptForm } from "../components/add_bash_script";

export interface ShellScript {
  name: string;
  content: string;
  created: string;
  tags?: string[];
}

export interface ActionItem {
  label: string;
  command: string;
  icon: string;
  script: ShellScript;
}

export class BashShellModel {
  constructor(
    readonly view: string,
    private context: vscode.ExtensionContext
  ) {}

  public get roots(): Thenable<ShellScript[]> {
    const shellScripts = this.context?.globalState
      ?.get("shell_scripts", [])
      .sort((a: ShellScript, b: ShellScript) => a.name.localeCompare(b.name));
    return Promise.resolve(shellScripts);
  }

  public getContent(resource: vscode.Uri): Thenable<string> {
    return Promise.resolve("");
  }
}

export class BashShellProvider
  implements vscode.TreeDataProvider<ShellScript | ActionItem>, vscode.TextDocumentContentProvider
{
  private _onDidChangeTreeData: vscode.EventEmitter<any> =
    new vscode.EventEmitter<any>();
  readonly onDidChangeTreeData: vscode.Event<any> =
    this._onDidChangeTreeData.event;

  constructor(
    private readonly model: BashShellModel,
    private context: vscode.ExtensionContext
  ) {}

  public refresh(): any {
    this._onDidChangeTreeData.fire(null);
  }

  public getTreeItem(element: ShellScript | ActionItem): vscode.TreeItem {
    // Check if this is an action item
    if ('command' in element) {
      const actionItem = element as ActionItem;
      const treeItem = new vscode.TreeItem(actionItem.label);
      treeItem.command = {
        command: actionItem.command,
        title: actionItem.label,
        arguments: [actionItem.script]
      };
      treeItem.iconPath = new vscode.ThemeIcon(actionItem.icon);
      treeItem.tooltip = `Click to ${actionItem.label.toLowerCase()}`;
      treeItem.contextValue = "actionItem";
      return treeItem;
    }

    // Handle regular shell script
    const script = element as ShellScript;
    
    // Create tooltip with script content preview
    let tooltipContent = `**${script.name}** - Shell Script\n\n`;
    
    if (script.created) {
      tooltipContent += `**Created:** ${new Date(script.created).toLocaleString()}\n\n`;
    }

    if (script.content && typeof script.content === 'string') {
      const previewLines = script.content.split('\n').slice(0, 10); // First 10 lines
      const preview = previewLines.join('\n');
      const hasMore = script.content.split('\n').length > 10;
      
      tooltipContent += `**Preview:**\n\`\`\`bash\n${preview}${hasMore ? '\n...(more)' : ''}\n\`\`\`\n\n`;
    } else {
      tooltipContent += `**Preview:** No content available\n\n`;
    }
    
    tooltipContent += `*Expand to see action buttons*`;

    // Create tree item with expandable actions
    const treeItem = new vscode.TreeItem(
      script.name || 'Unnamed Script', 
      vscode.TreeItemCollapsibleState.Collapsed
    );
    
    treeItem.iconPath = new vscode.ThemeIcon("file-code");
    treeItem.tooltip = new vscode.MarkdownString(tooltipContent);
    treeItem.contextValue = "shellScript";

    return treeItem;
  }

  public getChildren(element?: ShellScript | ActionItem): (ShellScript | ActionItem)[] | Thenable<(ShellScript | ActionItem)[]> {
    if (!element) {
      // Return root level shell scripts
      return this.model.roots;
    }
    
    // If element is a shell script, return its action items
    if ('content' in element) {
      const script = element as ShellScript;
      const actions: ActionItem[] = [
        {
          label: "Preview",
          command: "bashShells.previewEntry",
          icon: "eye",
          script: script
        },
        {
          label: "Run",
          command: "bashShells.runEntry", 
          icon: "play",
          script: script
        },
        {
          label: "Edit",
          command: "bashShells.editEntry",
          icon: "edit", 
          script: script
        },
        {
          label: "Delete",
          command: "bashShells.deleteEntry",
          icon: "trash",
          script: script
        }
      ];
      return Promise.resolve(actions);
    }
    
    // Action items have no children
    return Promise.resolve([]);
  }

  public provideTextDocumentContent(
    uri: vscode.Uri,
    token?: vscode.CancellationToken
  ): vscode.ProviderResult<string> {
    return this.model.getContent(uri).then((content) => {
      return content;
    });
  }
}

export class BashShellExplorer {
  private shellViewer: vscode.TreeView<ShellScript>;

  constructor(context: vscode.ExtensionContext) {
    const shellModel = new BashShellModel("recent", context);
    const shellDataProvider = new BashShellProvider(shellModel, context);

    this.shellViewer = vscode.window.createTreeView("bashShells", {
      treeDataProvider: shellDataProvider,
    });

    /**
     * Creates a new shell script from scratch
     */
    vscode.commands.registerCommand("bashShells.createEntry", async () => {
      await AddBashScriptForm(context);
    });

    /**
     * Adds a new shell script to storage from file
     */
    vscode.commands.registerCommand("bashShells.addEntry", async () => {
      const options: vscode.OpenDialogOptions = {
        canSelectMany: true,
        canSelectFiles: true,
        canSelectFolders: false,
        openLabel: "Add Shell Script",
        filters: {
          'Shell Scripts': ['sh']
        }
      };

      const fileUris = await vscode.window.showOpenDialog(options);
      if (fileUris && fileUris.length > 0) {
        const existingScripts = context.globalState.get("shell_scripts", []);
        const newScripts: ShellScript[] = [];

        for (const fileUri of fileUris) {
          try {
            const fileName = path.basename(fileUri.fsPath, '.sh');
            const fileContent = fs.readFileSync(fileUri.fsPath, 'utf8');
            
            const script: ShellScript = {
              name: fileName,
              content: fileContent,
              created: new Date().toISOString(),
              tags: []
            };
            newScripts.push(script);
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to read ${fileUri.fsPath}: ${error}`);
          }
        }

        const updatedScripts = [...existingScripts, ...newScripts];
        context.globalState.update("shell_scripts", updatedScripts);
        
        vscode.window.showInformationMessage(`Added ${newScripts.length} shell script(s)`);
        shellDataProvider.refresh();
      }
    });

    /**
     * Removes a shell script from storage
     */
    vscode.commands.registerCommand(
      "bashShells.deleteEntry",
      async (scriptToDelete: ShellScript) => {
        const scriptName = scriptToDelete.name || 'Unnamed Script';
        
        const confirm = await vscode.window.showWarningMessage(
          `Are you sure you want to delete the shell script "${scriptName}"? This action cannot be undone.`,
          "Yes, Delete",
          "Cancel"
        );

        if (confirm === "Yes, Delete") {
          const existingScripts = context.globalState.get("shell_scripts", []);

          const updatedScripts = existingScripts.filter((script: ShellScript) => {
            return JSON.stringify(script) !== JSON.stringify(scriptToDelete);
          });

          context.globalState.update("shell_scripts", updatedScripts);

          vscode.window.showInformationMessage(`Shell Script "${scriptName}" removed successfully`);
          shellDataProvider.refresh();
        }
      }
    );

    /**
     * Refreshes the list of shell scripts
     */
    vscode.commands.registerCommand("bashShells.refreshEntry", () => {
      shellDataProvider.refresh();
    });

    /**
     * Shows a preview of the shell script content
     */
    vscode.commands.registerCommand(
      "bashShells.previewEntry",
      async (script: ShellScript) => {
        const scriptName = script.name || 'Unnamed Script';
        
        if (!script.content || typeof script.content !== 'string') {
          vscode.window.showErrorMessage(`Script "${scriptName}" has no content to preview`);
          return;
        }

        const panel = vscode.window.createWebviewPanel(
          "shellScriptPreview",
          `Preview: ${scriptName}`,
          vscode.ViewColumn.One,
          {
            enableScripts: false,
          }
        );

        panel.webview.html = getPreviewShellScriptWebviewContent(script);
      }
    );

    /**
     * Runs the shell script content directly in terminal (same as execute)
     */
    vscode.commands.registerCommand(
      "bashShells.runEntry",
      async (script: ShellScript) => {
        return vscode.commands.executeCommand("bashShells.executeEntry", script);
      }
    );

    /**
     * Executes the shell script content directly in terminal
     */
    vscode.commands.registerCommand(
      "bashShells.executeEntry",
      async (script: ShellScript) => {
        try {
          // Check if script has content
          if (!script.content || typeof script.content !== 'string') {
            vscode.window.showErrorMessage(`Script "${script.name}" has no content to execute`);
            return;
          }

          // Get current workspace folder as working directory
          let workingDirectory = process.cwd();
          if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            workingDirectory = vscode.workspace.workspaceFolders[0].uri.fsPath;
          }

          // Create or use existing terminal
          let terminal = vscode.window.activeTerminal;
          if (!terminal) {
            terminal = vscode.window.createTerminal({
              name: `Shell: ${script.name || 'Unnamed Script'}`,
              cwd: workingDirectory
            });
          }

          terminal.show();
          
          // Execute script content directly
          // Split content into lines and send each line
          const lines = script.content.split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            // Skip shebang line
            if (line.startsWith('#!')) {
              continue;
            }
            // Skip comments unless they contain commands
            if (line.trim().startsWith('#') && !line.includes('&&') && !line.includes('||')) {
              continue;
            }
            terminal.sendText(line);
          }

          vscode.window.showInformationMessage(`Executing: ${script.name || 'Unnamed Script'}`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to execute shell script: ${error}`);
        }
      }
    );

    /**
     * Opens shell script content for editing in a webview
     */
    vscode.commands.registerCommand(
      "bashShells.editEntry",
      async (script: ShellScript) => {
        let existingScripts = context.globalState.get("shell_scripts", []);
        const scriptIndex = existingScripts.findIndex(
          (s: ShellScript) => JSON.stringify(s) === JSON.stringify(script)
        );

        const panel = vscode.window.createWebviewPanel(
          "shellScriptEditor",
          `Edit: ${script.name}`,
          vscode.ViewColumn.One,
          {
            enableScripts: true,
          }
        );

        panel.webview.html = getEditShellScriptWebviewContent(script);

        panel.webview.onDidReceiveMessage(
          (message) => {
            switch (message.command) {
              case "save":
                const { name, content } = message.scriptData;

                if (name) {
                  script.name = name;
                }

                if (content) {
                  script.content = content;
                }

                const updatedScripts = existingScripts.map(
                  (existingScript: ShellScript, index) => {
                    if (index === scriptIndex) {
                      return script;
                    } else {
                      return existingScript;
                    }
                  }
                );
                context.globalState.update("shell_scripts", updatedScripts);

                panel.dispose();
                shellDataProvider.refresh();

                vscode.window.showInformationMessage(
                  `Shell Script Updated!`
                );

                return;
            }
          },
          undefined,
          context.subscriptions
        );
      }
    );
  }
}

function getEditShellScriptWebviewContent(script: ShellScript): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edit Shell Script</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input, textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }
        textarea {
            height: 400px;
            font-family: 'Courier New', monospace;
            resize: vertical;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 3px;
            cursor: pointer;
            margin-right: 10px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <h2>Edit Shell Script</h2>
    <form>
        <div class="form-group">
            <label for="name">Script Name:</label>
            <input type="text" id="name" value="${script.name}" required>
        </div>
        <div class="form-group">
            <label for="content">Script Content:</label>
            <textarea id="content" required>${script.content}</textarea>
        </div>
        <button type="button" onclick="saveScript()">Save</button>
        <button type="button" onclick="cancel()">Cancel</button>
    </form>

    <script>
        const vscode = acquireVsCodeApi();

        function saveScript() {
            const name = document.getElementById('name').value;
            const content = document.getElementById('content').value;

            if (!name || !content) {
                alert('Please fill in all fields');
                return;
            }

            vscode.postMessage({
                command: 'save',
                scriptData: {
                    name: name,
                    content: content
                }
            });
        }

        function cancel() {
            vscode.postMessage({
                command: 'cancel'
            });
        }
    </script>
</body>
</html>`;
}

function getPreviewShellScriptWebviewContent(script: ShellScript): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shell Script Preview</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
        }
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .script-name {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .script-info {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }
        .content-container {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            padding: 15px;
            overflow-x: auto;
        }
        .content {
            font-family: 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.5;
            white-space: pre;
            margin: 0;
        }
        .line-numbers {
            color: var(--vscode-editorLineNumber-foreground);
            user-select: none;
            margin-right: 15px;
            text-align: right;
            width: 30px;
            display: inline-block;
        }
        .code-line {
            display: block;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="script-name">${script.name || 'Unnamed Script'}</div>
        <div class="script-info">
            ${script.created ? `Created: ${new Date(script.created).toLocaleString()}` : ''}
            ${script.content ? ` • ${script.content.split('\n').length} lines` : ''}
        </div>
    </div>
    
    <div class="content-container">
        <pre class="content">${formatContentWithLineNumbers(script.content || 'No content available')}</pre>
    </div>
</body>
</html>`;
}

function formatContentWithLineNumbers(content: string): string {
  const lines = content.split('\n');
  return lines.map((line, index) => {
    const lineNumber = (index + 1).toString().padStart(3, ' ');
    return `<span class="line-numbers">${lineNumber}</span>${escapeHtml(line)}`;
  }).join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}