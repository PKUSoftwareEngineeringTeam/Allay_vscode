import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'child_process';

let serverProcess: ChildProcess | null = null;
let previewPanel: vscode.WebviewPanel | null = null;
let logChannel: vscode.LogOutputChannel;

const ALLAY_PORT = 8000;

export function activate(context: vscode.ExtensionContext) {

	// Create a log output channel
	logChannel = vscode.window.createOutputChannel('Allay', { log: true });

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

	context.subscriptions.push(previewCommand);
}

function getWebviewContent(port: number): string {
const url = `http://localhost:${port}`;
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
                frame-src ${url};
            ">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Allay Preview</title>
            <style>
                html, body, iframe {
                    height: 100%;
                    width: 100%;
                    margin: 0;
                    padding: 0;
                    border: none;
                    overflow: hidden;
                }
            </style>
        </head>
        <body>
            <iframe src="${url}"></iframe>
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
