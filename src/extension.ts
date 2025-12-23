import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'child_process';
import { AllayCompletionItemProvider } from './completionProvider';

let serverProcess: ChildProcess | null = null;
let previewPanel: vscode.WebviewPanel | null = null;
let logChannel: vscode.LogOutputChannel;

const ALLAY_PORT = 8000;

export function activate(context: vscode.ExtensionContext) {

	// Register an empty TreeDataProvider to create the Allay view
	vscode.window.registerTreeDataProvider('allay-view', new class implements vscode.TreeDataProvider<vscode.TreeItem> {
		getTreeItem(element: any): vscode.TreeItem {
			return element;
		}
		getChildren(element?: any): vscode.ProviderResult<vscode.TreeItem[]> {
			return [];
		}
	});

	// Create a log output channel
	logChannel = vscode.window.createOutputChannel('Allay', { log: true });

	// Register the completion provider for Markdown and HTML files
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        ['markdown', 'html'],
        new AllayCompletionItemProvider(),
        ' ',  // Triggers general completions after a space
		'-',  // Triggers command block completion (e.g., "{-")
		':',  // Triggers tag block completion (e.g., "{:")
        '<',  // Triggers shortcode opening (e.g., "{<")
        '/',  // Triggers shortcode closing (e.g., "{</")
		'%',  // Triggers comment block completion (e.g., "{%")
        '.',  // Triggers member access (e.g., "site.")
        '"',  // Triggers file path completion (e.g., include "...")
        '$'   // Triggers variable completion inside expressions (e.g., "$var")
    );
	context.subscriptions.push(completionProvider);

	const startService = (projectRoot: string) => {
		// If a server process is already running, kill it
		if (serverProcess) {
			logChannel.info('Killing existing Allay server process.');
			serverProcess.kill();
		}

		// Get configuration settings
		const config = vscode.workspace.getConfiguration('allay');

		// Get the path to the Allay server executable
		const allayExecutable = config.get<string>('path') || 'allay';
		vscode.window.showInformationMessage('Using Allay executable at: ' + allayExecutable);
		logChannel.info('Using Allay executable at: ' + allayExecutable);

		// Start a new Allay server process
		serverProcess = spawn(allayExecutable, ['--root', projectRoot, 'serve'], {
			cwd: projectRoot,
			shell: false // Set to false for security, and because we don't need shell features
		});

		serverProcess.stdout?.on('data', (data) => {
			logChannel.info(`Allay stdout: ${data}`);
		});

		serverProcess.stderr?.on('data', (data) => {
			logChannel.error(`Allay stderr: ${data}`);
			vscode.window.showErrorMessage(`Allay error: ${data}`);
		});
	};

	const previewCommand = vscode.commands.registerCommand('allay.preview', () => {
		// Check workspace folder
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			logChannel.error('No workspace folder is open.');
			vscode.window.showErrorMessage('Please open a workspace folder to use Allay Preview.');
			return;
		}
		const projectRoot = workspaceFolders[0].uri.fsPath;
		logChannel.info('Using workspace folder: ' + projectRoot);

		// Check structure of workspace folder
		// PASS, implement later

		// Display the preview panel if it has already been created
		if (previewPanel) {
			logChannel.info('Revealing existing preview panel.');
			previewPanel.reveal(vscode.ViewColumn.Two);
			return;
		}

		// Create and show a new webview panel
		logChannel.info('Creating new preview panel.');
		previewPanel = vscode.window.createWebviewPanel(
			'allayPreview',
			'Allay Preview',
			vscode.ViewColumn.Two, // Show in second column
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);

		// Start the Allay server process
		startService(projectRoot);

		// Listen message form webview to handle navigation
		previewPanel.webview.onDidReceiveMessage(
			async (message) => {
				switch (message.command)
				{
					case 'openExternal':
						if (message.url) {
							const uri = vscode.Uri.parse(message.url);
							await vscode.env.openExternal(uri);
						}
						break;
					// ... more commands later, maybe
				}
			},
			undefined,
			context.subscriptions
		);

		// Set the webview panel's HTML to load the Allay server
		previewPanel.webview.html = getWebviewContent(ALLAY_PORT);

		// Handle panel disposal
		previewPanel.onDidDispose(() => {
			if (serverProcess) {
				serverProcess.kill();
				serverProcess = null;
			}
			previewPanel = null;
		}, null, context.subscriptions);

	});

	const restartCommand = vscode.commands.registerCommand('allay.restartService', () => {
        if (!serverProcess) {
            return;
        } else {
			serverProcess.kill();
		}

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }
        const projectRoot = workspaceFolders[0].uri.fsPath;

        startService(projectRoot);
        vscode.window.showInformationMessage('Allay Service Restarted');
        
        if (previewPanel) {
             previewPanel.webview.html = getWebviewContent(ALLAY_PORT);
        }
	});

	context.subscriptions.push(previewCommand);
	context.subscriptions.push(restartCommand);
}

function getWebviewContent(port: number): string {
	const url = `http://localhost:${port}`;
	const ipUrl = `http://127.0.0.1:${port}`;
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-R">
            <meta http-equiv="Content-Security-Policy" content="
                default-src 'none';
                img-src data: https:;
                script-src 'unsafe-inline';
                style-src 'unsafe-inline';
                frame-src ${url} ${ipUrl} ;
            ">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Allay Preview</title>
            <style>
                html, body {
                    height: 100vh;
                    width: 100%;
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                }
                body {
                    display: flex;
                    flex-direction: column;
                }
                #toolbar {
                    flex-shrink: 0;
                    padding: 4px 8px;
                    background-color: var(--vscode-sideBar-background);
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                #toolbar button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: 1px solid var(--vscode-button-border, transparent);
                    padding: 4px 8px;
                    cursor: pointer;
                }
                #toolbar button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                iframe {
                    flex-grow: 1; 
                    width: 100%;
                    margin: 0;
                    padding: 0;
                    border: none;
                    overflow: hidden;
                }
            </style>
        </head>
        <body>
            <div id="toolbar">
                <button id="history-back"><-</button>
                <button id="history-forward">-></button>
            </div>
            
            <iframe id="content-iframe" src="${url}"></iframe>

            <script>
                (function() {
					const vscode = acquireVsCodeApi();

                    const iframe = document.getElementById('content-iframe');
                    const backButton = document.getElementById('history-back');
                    const forwardButton = document.getElementById('history-forward');

                    const targetOrigin = '${url}';
					const targetIpOrigin = '${ipUrl}';

                    backButton.addEventListener('click', () => {
                        iframe.contentWindow.postMessage({ command: 'navigateBack' }, targetOrigin);
						iframe.contentWindow.postMessage({ command: 'navigateBack' }, targetIpOrigin);
                    });

                    forwardButton.addEventListener('click', () => {
                        iframe.contentWindow.postMessage({ command: 'navigateForward' }, targetOrigin);
						iframe.contentWindow.postMessage({ command: 'navigateForward' }, targetIpOrigin);
                    });

					window.addEventListener('message', event => {
						if (event.origin !== targetOrigin) {
							return;
						}
						const message = event.data;
						if (message.command === 'openExternal' && message.url) {
							vscode.postMessage({ 
								command: 'openExternal', 
								url: message.url 
							});
						}
					});
                }());
            </script>
        </body>
        </html>
    `;
}

export function deactivate() {
	if (serverProcess) {
        serverProcess.kill();
    }
    if (previewPanel) {
        previewPanel.dispose();
    }
}
