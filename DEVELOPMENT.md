# Development Guide

This document provides instructions for setting up the development environment, debugging, and testing the Snippet VS Code extension locally.

## Prerequisites

- **Node.js** (v14 or higher)
- **Yarn** package manager
- **Visual Studio Code** (v1.48.0 or higher)
- **TypeScript** knowledge

## Getting Started

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/devon2018/snippet.git
cd snippet-store
yarn install
```

### 2. Build the Project

```bash
# Compile TypeScript to JavaScript
yarn run compile

# Watch mode for development (auto-recompile on changes)
yarn run watch
```

## Local Development & Debugging

### Method 1: Using VS Code Debug Configuration (Recommended)

The project includes pre-configured debug settings in `.vscode/launch.json`:

1. **Open the project in VS Code**
2. **Start the watch task** (automatically compiles on file changes):
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "Tasks: Run Task"
   - Select "npm: watch"

3. **Launch Extension Host**:
   - Go to Run and Debug view (`Ctrl+Shift+D` or `Cmd+Shift+D`)
   - Select "Run Extension" from the dropdown
   - Press `F5` or click the play button
   
   This will:
   - Compile the extension
   - Open a new VS Code window with your extension loaded
   - Enable debugging with breakpoints

### Method 2: Manual Debug Setup

If you prefer manual setup:

```bash
# Terminal 1: Start watch mode
yarn run watch

# Terminal 2: Package and test
yarn run vscode:prepublish
```

Then press `F5` in VS Code to launch the Extension Development Host.

### Debugging Tips

- **Set breakpoints** in your TypeScript source files (`src/` folder)
- **Use Debug Console** in VS Code to inspect variables and execute code
- **Hot reload**: The watch task automatically recompiles when you save files
- **Inspect extension host**: The new VS Code window shows debug info in Developer Console (`Help > Toggle Developer Tools`)

## Testing

### Running Tests

```bash
# Run all tests
yarn test

# Run tests with coverage
yarn run coverage

# Run linting
yarn run lint
```

### Test Configuration

- Tests are located in `src/test/`
- Main test file: `src/test/extension.test.ts`
- Uses Mocha test framework with NYC for coverage
- Tests run in the Extension Host environment

### Writing Tests

The extension currently has minimal test coverage. To add tests:

1. Create test files in `src/test/`
2. Follow the existing pattern in `extension.test.ts`
3. Import VS Code API and your extension modules
4. Use Mocha `describe` and `it` blocks

Example test structure:
```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';

describe('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Sample test', () => {
        assert.equal(-1, [1, 2, 3].indexOf(5));
    });
});
```

## Project Structure

```
├── src/
│   ├── components/          # UI components and forms
│   ├── functions/           # Utility functions
│   ├── interfaces/          # TypeScript interfaces
│   ├── providers/           # VS Code providers (tree view, completion, etc.)
│   ├── test/               # Test files
│   └── extension.ts        # Main extension entry point
├── out/                    # Compiled JavaScript output
├── resources/              # Icons and assets
├── .vscode/               # VS Code configuration
│   ├── launch.json        # Debug configurations
│   ├── tasks.json         # Build tasks
│   └── settings.json      # Workspace settings
├── package.json           # Extension manifest and dependencies
└── tsconfig.json          # TypeScript configuration
```

## Development Workflow

1. **Make changes** to TypeScript files in `src/`
2. **Watch mode** automatically compiles changes
3. **Reload extension** in the Extension Development Host:
   - `Ctrl+R` (or `Cmd+R`) in the Extension Development Host window
   - Or restart debugging session
4. **Test changes** in the Extension Development Host
5. **Run tests** before committing: `yarn test`
6. **Lint code** before committing: `yarn run lint`

## Extension Features to Test

When debugging locally, test these key features:

- **Create Snippet**: Select text and create a snippet (`Shift+Cmd+C`)
- **Insert Snippet**: Insert existing snippets (`Shift+Cmd+I`)
- **Search Snippets**: Search through saved snippets
- **Terminal Snippets**: Add and manage terminal commands
- **Import/Export**: Test snippet import/export functionality
- **Tree View**: Verify snippet tree view in the sidebar

## Common Issues

### TypeScript Compilation Errors
- Run `yarn run compile` to see detailed errors
- Check `tsconfig.json` for configuration issues

### Extension Not Loading
- Verify `package.json` activation events
- Check VS Code Developer Console for errors
- Ensure the extension is properly compiled in `out/` folder

### Debugging Not Working
- Ensure the watch task is running
- Verify `.vscode/launch.json` configuration
- Check that source maps are enabled in `tsconfig.json`

## Building for Production

```bash
# Build optimized version
yarn run vscode:prepublish

# Package extension (requires vsce)
npm install -g vsce
vsce package
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the existing code style
4. Run tests and linting
5. Submit a pull request

For more details, see the main [README.md](./README.md) file.