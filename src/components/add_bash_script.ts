import * as vscode from "vscode";

export default function addBashScriptWebviewContent(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Add Shell Script</title>
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
        .template-buttons {
            margin-bottom: 10px;
        }
        .template-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
            margin-right: 5px;
            font-size: 12px;
        }
        .template-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
</head>
<body>
    <h2>Add New Shell Script</h2>
    <form>
        <div class="form-group">
            <label for="name">Script Name:</label>
            <input type="text" id="name" placeholder="my-script" required>
        </div>
        <div class="form-group">
            <label for="content">Script Content:</label>
            <div class="template-buttons">
                <button type="button" class="template-button" onclick="insertTemplate('basic')">Basic Template</button>
                <button type="button" class="template-button" onclick="insertTemplate('git')">Git Commands</button>
                <button type="button" class="template-button" onclick="insertTemplate('build')">Build Script</button>
                <button type="button" class="template-button" onclick="insertTemplate('deploy')">Deployment</button>
            </div>
            <textarea id="content" placeholder="#!/bin/bash&#10;&#10;echo 'Hello World!'" required></textarea>
        </div>
        <button type="button" onclick="saveScript()">Save Script</button>
        <button type="button" onclick="cancel()">Cancel</button>
    </form>

    <script>
        const vscode = acquireVsCodeApi();

        const templates = {
            basic: \`#!/bin/bash

echo "Starting script..."

# Your commands here
echo "Script completed successfully!"
\`,
            git: \`#!/bin/bash

# Git workflow commands
git status
git add .
git commit -m "Update files"
git push origin main

echo "Git operations completed!"
\`,
            build: \`#!/bin/bash

echo "Starting build process..."

# Install dependencies
npm install

# Run build
npm run build

# Run tests
npm test

echo "Build completed successfully!"
\`,
            deploy: \`#!/bin/bash

echo "Starting deployment..."

# Build the project
npm run build

# Deploy to server
rsync -avz ./dist/ user@server:/path/to/deployment/

echo "Deployment completed!"
\`
        };

        function insertTemplate(templateName) {
            const content = document.getElementById('content');
            content.value = templates[templateName];
        }

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

export async function AddBashScriptForm(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    "addBashScript",
    "Add Shell Script",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
    }
  );

  panel.webview.html = addBashScriptWebviewContent();

  panel.webview.onDidReceiveMessage(
    (message) => {
      switch (message.command) {
        case "save":
          const { name, content } = message.scriptData;

          if (!name || !content) {
            vscode.window.showErrorMessage("Please fill in all fields");
            return;
          }

          const existingScripts = context.globalState.get("shell_scripts", []);
          
          const newScript = {
            name: name,
            content: content,
            created: new Date().toISOString(),
            tags: []
          };

          const updatedScripts = [...existingScripts, newScript];
          context.globalState.update("shell_scripts", updatedScripts);

          panel.dispose();
          vscode.commands.executeCommand("bashShells.refreshEntry");
          vscode.window.showInformationMessage("Shell Script Added!");
          break;

        case "cancel":
          panel.dispose();
          break;
      }
    },
    undefined,
    context.subscriptions
  );
}