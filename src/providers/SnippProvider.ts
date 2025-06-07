import * as vscode from "vscode";
import { join as pathJoin } from "path";
import Snipp from "../interfaces/snipp";
import editSnippWebviewContent from "../components/edit_snipp";

export interface EditorActionItem {
  label: string;
  command: string;
  icon: string;
  snipp: Snipp;
}

/**
 * Group interface
 */
export interface Group {
  name: string;
  contentType: string | undefined;
}
export class SnippModel {
  constructor(
    readonly view: string,
    private context: vscode.ExtensionContext
  ) {}

  public get roots(): Thenable<Group[]> {
    const snipps = this.context?.globalState?.get("snipps", []);
    const types = snipps
      .map((snipp: Snipp) => snipp.contentType)
      .filter((value, index, self) => self.indexOf(value) === index)
      .map((type) => ({ name: type, contentType: undefined }));
    return Promise.resolve(types);
  }

  public getChildren(node: Group): Thenable<Snipp[]> {
    const snipps = this.context?.globalState
      ?.get("snipps", [])
      .filter((snipp: Snipp) => {
        return snipp.contentType === node.name;
      })
      .sort((a: Snipp, b: Snipp) => a.name.localeCompare(b.name));

    return Promise.resolve(snipps);
  }

  public getContent(resource: vscode.Uri): Thenable<string> {
    return Promise.resolve("");
  }
}

export class GroupModel {}

export class SnippProvider
  implements
    vscode.TreeDataProvider<Snipp | Group | EditorActionItem>,
    vscode.TextDocumentContentProvider
{
  private _onDidChangeTreeData: vscode.EventEmitter<any> =
    new vscode.EventEmitter<any>();
  readonly onDidChangeTreeData: vscode.Event<any> =
    this._onDidChangeTreeData.event;

  constructor(
    private readonly model: SnippModel,
    private context: vscode.ExtensionContext
  ) {}

  public refresh(): any {
    this._onDidChangeTreeData.fire(null);
  }

  public isSnipp(object: any): object is Group {
    return "content" in object;
  }

  public getTreeItem(element: Snipp | Group | EditorActionItem): vscode.TreeItem {
    // Check if this is an action item
    if ('command' in element && 'snipp' in element) {
      const actionItem = element as EditorActionItem;
      const treeItem = new vscode.TreeItem(actionItem.label);
      treeItem.command = {
        command: actionItem.command,
        title: actionItem.label,
        arguments: [actionItem.snipp]
      };
      treeItem.iconPath = new vscode.ThemeIcon(actionItem.icon);
      treeItem.tooltip = `Click to ${actionItem.label.toLowerCase()}`;
      treeItem.contextValue = "editorActionItem";
      return treeItem;
    }

    // Handle Group
    if ('contentType' in element && element.contentType === undefined) {
      const group = element as Group;
      let icn = pathJoin(
        __filename,
        "..",
        "..",
        "..",
        "resources",
        "icons",
        `folder-${group.name}.svg`
      );

      return {
        label: group.name.toUpperCase(),
        iconPath: icn,
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        contextValue: "snippGroup"
      };
    }

    // Handle Snipp
    const snipp = element as Snipp;
    const isSnip = this.isSnipp(element);
    
    if (isSnip) {
      // Create tooltip with snippet content preview
      let snippetInfo: string = `**${snipp.name}⇥ ${snipp.contentType}** _\n___`;
      let tooltipContent = new vscode.MarkdownString(
        `${snippetInfo}\n\n\`\`\`${snipp.contentType}\n${snipp.content}\n\`\`\``
      );
      tooltipContent.appendMarkdown(`\n\n*Expand to see action buttons*`);

      let icn = pathJoin(
        __filename,
        "..",
        "..",
        "..",
        "resources",
        "icons",
        `${snipp.contentType}.svg`
      );

      // Create tree item with expandable actions
      const treeItem = new vscode.TreeItem(
        snipp.name, 
        vscode.TreeItemCollapsibleState.Collapsed
      );
      
      treeItem.iconPath = icn;
      treeItem.tooltip = tooltipContent;
      treeItem.contextValue = "editorSnipp";

      return treeItem;
    }

    // Fallback
    return new vscode.TreeItem("Unknown Item");
  }

  public getChildren(
    element?: Snipp | Group | EditorActionItem
  ): (Snipp | Group | EditorActionItem)[] | Thenable<(Snipp | Group | EditorActionItem)[]> {
    if (!element) {
      // Return root level groups
      return this.model.roots;
    }
    
    // If element is an action item, no children
    if ('command' in element && 'snipp' in element) {
      return Promise.resolve([]);
    }
    
    // If element is a snippet, return its action items
    if ('content' in element && 'contentType' in element && element.contentType !== undefined) {
      const snipp = element as Snipp;
      const actions: EditorActionItem[] = [
        {
          label: "Insert",
          command: "allSnipps.insertEntry",
          icon: "insert",
          snipp: snipp
        },
        {
          label: "Edit",
          command: "allSnipps.editEntry",
          icon: "edit", 
          snipp: snipp
        },
        {
          label: "Delete",
          command: "allSnipps.deleteEntry",
          icon: "trash",
          snipp: snipp
        }
      ];
      return Promise.resolve(actions);
    }
    
    // If element is a group, return its snippets
    if ('contentType' in element && element.contentType === undefined) {
      const group = element as Group;
      return this.model.getChildren(group);
    }
    
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

export class SnippExplorer {
  private snippViewer: vscode.TreeView<Snipp>;

  constructor(context: vscode.ExtensionContext) {
    const snippModel = new SnippModel("recent", context);

    const snippDataProvider = new SnippProvider(snippModel, context);

    this.snippViewer = vscode.window.createTreeView("allSnipps", {
      treeDataProvider: snippDataProvider,
    });

    vscode.commands.registerCommand("allSnipps.refreshEntry", () => {
      snippDataProvider.refresh();
    });

    vscode.commands.registerCommand("allSnipps.addEntry", () => {
      vscode.window.showInformationMessage(`Successfully called add entry.`);
    });

    vscode.commands.registerCommand(
      "allSnipps.deleteEntry",
      (snippToDelete: Snipp) => {
        if (!snippToDelete.content) {
          vscode.window.showErrorMessage(`You can't delete a snippet group!`);
          return;
        }
        const existingSnipps = context.globalState.get("snipps", []);

        const updatedSnipps = existingSnipps.filter((snipp: Snipp) => {
          return JSON.stringify(snipp) !== JSON.stringify(snippToDelete);
        });

        context.globalState.update("snipps", updatedSnipps);

        vscode.window.showInformationMessage(`Snipp deleted`);
        snippDataProvider.refresh();
      }
    );

    vscode.commands.registerCommand("allSnipps.insertEntry", (snipp: Snipp) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && snippDataProvider.isSnipp(snipp)) {
        const position = editor?.selection.active;
        editor.edit((edit) => {
          edit.insert(position, snipp.content || "");
        });
      } else if (editor && !snippDataProvider.isSnipp(snipp)) {
        vscode.window.showErrorMessage(
          `Please choose a Snipp instead of a group`
        );
      } else if (!editor) {
        vscode.window.showErrorMessage(`Please open a file to insert a Snipp`);
      } else {
        vscode.window.showErrorMessage(`Failed to insert Snipp!`);
      }
    });

    vscode.commands.registerCommand("allSnipps.editEntry", (snipp: Snipp) => {
      if (!snipp.content) {
        vscode.window.showErrorMessage(`You can't edit a snippet group!`);
        return;
      }

      let existingSnipps = context.globalState.get("snipps", []);
      const snipIndex = existingSnipps.findIndex(
        (snipp1: Snipp) => JSON.stringify(snipp1) === JSON.stringify(snipp)
      );

      const panel = vscode.window.createWebviewPanel(
        "snippetEditor", // Identifies the type of the webview. Used internally
        `Edit: ${snipp.name}`, // Title of the panel displayed to the user
        vscode.ViewColumn.One, // Editor column to show the new webview panel in.
        {
          enableScripts: true,
        } // Webview options. More on these later.
      );

      panel.webview.html = editSnippWebviewContent(snipp);

      panel.webview.onDidReceiveMessage(
        (message) => {
          switch (message.command) {
            case "save":
              const { name, content, tags } = message.snippetData;

              if (name) {
                snipp.name = name;
              }

              if (content) {
                snipp.content = content;
              }

              if (tags) {
                snipp.tags = tags
                  .split("+")
                  .map((sty: string) => sty.trim())
                  .filter((e: string) => e.length >= 2);
              }

              const updatedSnipps = existingSnipps.map(
                (exsnip: Snipp, index) => {
                  if (index === snipIndex) {
                    return snipp;
                  } else {
                    return exsnip;
                  }
                }
              );
              context.globalState.update("snipps", updatedSnipps);

              panel.dispose();
              snippDataProvider.refresh();

              vscode.window.showInformationMessage(`Snippet Updated!`);

              return;
          }
        },
        undefined,
        context.subscriptions
      );
    });
  }
}
