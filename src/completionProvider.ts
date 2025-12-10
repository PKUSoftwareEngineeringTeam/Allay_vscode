import * as vscode from 'vscode';
import * as path from 'path';

export class AllayCompletionItemProvider implements vscode.CompletionItemProvider {

    public async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | vscode.CompletionList | undefined> {

        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        
        // Initialize a container for all valid completion items
        const allItems: vscode.CompletionItem[] = [];

        // 0. Block Structure Completion (Snippets)
        // Check if the user just typed a block starter like "{-", "{:", or "{<"
        // Don't return early! Add to the list and continue.
        const blockCompletion = this.getBlockCompletions(linePrefix, position, document);
        if (blockCompletion) {
            allItems.push(...blockCompletion);
        }

        // 1. Handle Path Completion (include/extends)
        const includeMatch = linePrefix.match(/\{-(?:\s*)(?:include|extends)\s+"([^"]*)$/);
        if (includeMatch) {
            const pathItems = await this.getTemplateFileCompletions();
            return [...allItems, ...pathItems];
        }

        // 2. Handle Dot Access (site.xxx)
        if (linePrefix.match(/(\{:|\{-)([^}]+)$/)) {
            const dotMatch = linePrefix.match(/([a-zA-Z0-9_.]*)\.$/);
            if (dotMatch) {
                const fieldItems = await this.getFieldCompletions(dotMatch[1], document);
                return [...allItems, ...fieldItems];
            }
        }

        // 3. Handle Command Block {- ...
        // Strategy: Provide Control Keywords + Common Expressions (variables/functions)
        // Regex matches "{-" (empty content) as well, so this will trigger together with Step 0
        if (linePrefix.match(/\{-([^}]*)$/)) {
            const commandKeywords = this.getControlKeywords();
            const commonExpressions = this.getCommonExpressions(document); 
            allItems.push(...commandKeywords, ...commonExpressions);
        }

        // 4. Handle Expression Block {: ...
        // Strategy: Provide Output Keywords (block) + Common Expressions
        if (linePrefix.match(/\{:([^}]*)$/)) {
            const outputKeywords = this.getOutputKeywords();
            const commonExpressions = this.getCommonExpressions(document);
            allItems.push(...outputKeywords, ...commonExpressions);
        }

        // 5. Shortcodes
        if (linePrefix.match(/\{<\/?([^>}]*)$/)) {
            const shortcodeItems = await this.getShortcodeCompletions();
            allItems.push(...shortcodeItems);
        }

        // Return undefined if no items were found to allow VS Code default behavior,
        // otherwise return the accumulated list.
        return allItems.length > 0 ? allItems : undefined;
    }

    /**
     * Provides snippet completions for block structures.
     * Triggered when line ends with "{-", "{:", or "{<".
     */
    private getBlockCompletions(linePrefix: string, position: vscode.Position, document: vscode.TextDocument): vscode.CompletionItem[] | undefined {
        const items: vscode.CompletionItem[] = [];

        // 1. Calculate Range (Targeting ONLY the last character: -, :, or <)
        // We assume the opening '{' is already safely on screen.
        const startPos = position.translate(0, -1); 
        let endPos = position;

        // Check for auto-closed brace '}'
        const nextCharRange = new vscode.Range(position, position.translate(0, 1));
        const nextChar = document.getText(nextCharRange);

        if (nextChar === '}') {
            endPos = position.translate(0, 1);
        }

        const replaceRange = new vscode.Range(startPos, endPos);

        // Define the command to re-trigger suggestions immediately after snippet insertion
        const retriggerCommand = { command: 'editor.action.triggerSuggest', title: 'Re-trigger suggestions' };

        // --- Define Completion Items ---

        // 1. Command Block: {- ... -}
        // Trigger: User typed "-" after "{"
        if (linePrefix.endsWith('{-')) {
            const item = new vscode.CompletionItem('{- command -}', vscode.CompletionItemKind.Snippet);
            item.detail = 'Allay Command Block';
            
            // Insert remaining parts: "-" + cursor + "-}"
            // The opening "{" is preserved from user input.
            item.insertText = new vscode.SnippetString('- $0 -}'); 
            
            item.range = replaceRange;
            item.filterText = '-'; // Explicitly match the trigger character
            item.sortText = '001';
            item.preselect = true; // High confidence guess
            item.command = retriggerCommand; 

            items.push(item);
            return items;
        }

        // 2. Expression Block: {: ... :}
        // Trigger: User typed ":" after "{"
        if (linePrefix.endsWith('{:')) {
            const item = new vscode.CompletionItem('{: expression :}', vscode.CompletionItemKind.Snippet);
            item.detail = 'Allay Expression Block';
            
            // Insert remaining parts: ":" + cursor + ":}"
            item.insertText = new vscode.SnippetString(': $0 :}');
            
            item.range = replaceRange;
            item.filterText = ':';
            item.sortText = '001';
            item.preselect = true;
            item.command = retriggerCommand;

            items.push(item);
            return items;
        }

        // 3. Shortcode Block: {< ... >}
        // Trigger: User typed "<" after "{"
        if (linePrefix.endsWith('{<')) {
            
            // Option A: Standard Call
            const item1 = new vscode.CompletionItem('{< shortcode >}', vscode.CompletionItemKind.Snippet);
            item1.detail = 'Shortcode Call';
            // Insert: "<" + tag + ">" + cursor
            item1.insertText = new vscode.SnippetString('< $1 >}$0'); 
            item1.range = replaceRange;
            item1.filterText = '<';
            item1.sortText = '001';
            item1.command = retriggerCommand;
            items.push(item1);

            // Option B: Self-closing
            const item2 = new vscode.CompletionItem('{< shortcode />}', vscode.CompletionItemKind.Snippet);
            item2.detail = 'Self-closing Shortcode';
            // Insert: "<" + tag + "/>}"
            item2.insertText = new vscode.SnippetString('< $1 />}');
            item2.range = replaceRange;
            item2.filterText = '<';
            item2.sortText = '002';
            item2.command = retriggerCommand; 
            items.push(item2);

            // Option C: Paired Block
            const item3 = new vscode.CompletionItem('{< pair >}...{</ pair >}', vscode.CompletionItemKind.Snippet);
            item3.detail = 'Shortcode Block Pair';
            // Insert complex structure starting with "<"
            item3.insertText = new vscode.SnippetString('< $1 >}\n\t$0\n{</ $1 >}');
            item3.range = replaceRange;
            item3.filterText = '<';
            item3.sortText = '003';
            item3.command = retriggerCommand; 
            items.push(item3);

            return items;
        }

        return undefined;
    }

    /**
     * Keywords strictly for Control Flow (inside {- ... -})
     */
    private getControlKeywords(): vscode.CompletionItem[] {
        // 'block' removed from here, 'else if' added for convenience
        const keywords = [
            'set', 'for', 'with', 'if', 'else if', 'else', 'end', 
            'include', 'extends', 'get', 'param'
        ];

        return keywords.map(word => {
            const item = new vscode.CompletionItem(word, vscode.CompletionItemKind.Keyword);
            item.detail = `Allay Command`;
            return item;
        });
    }

    /**
     * Keywords strictly for Output/Placeholder (inside {: ... :})
     * Based on practice.md: {: block "title" :}
     */
    private getOutputKeywords(): vscode.CompletionItem[] {
        const item = new vscode.CompletionItem('block', vscode.CompletionItemKind.Keyword);
        item.detail = 'Allay Block Definition';
        item.documentation = new vscode.MarkdownString('Define a block for template inheritance: `{: block "name" :}`');
        return [item];
    }

    /**
     * Common items available in BOTH Command and Expression blocks.
     * Includes: Variables, Built-in Functions, Constants.
     */
    private getCommonExpressions(document: vscode.TextDocument): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];

        // A. Static Built-in Variables
        ['this', 'site', 'pages', 'param'].forEach(v => {
            const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.Variable);
            item.detail = 'Allay Built-in Variable';
            items.push(item);
        });

        // B. Constants
        ['null'].forEach(c => {
            const item = new vscode.CompletionItem(c, vscode.CompletionItemKind.Constant);
            item.detail = 'Allay Constant';
            items.push(item);
        });

        // C. Built-in Functions
        // These are used in {: len x :} AND {- if len(x) -}
        ['len', 'slice', 'append', 'list', 'format_date', 'truncate'].forEach(f => {
            const item = new vscode.CompletionItem(f, vscode.CompletionItemKind.Function);
            item.detail = 'Allay Built-in Function';
            items.push(item);
        });

        ['end'].forEach(f => {
            const item = new vscode.CompletionItem(f, vscode.CompletionItemKind.Function);
            item.detail = 'Allay Keyword';
            items.push(item);
        });

        // D. Dynamic User Variables (Scanned from document)
        // Combines logic for scanning 'set' and 'for'
        const text = document.getText();
        const existingLabels = new Set(items.map(i => i.label)); // To prevent duplicates

        // Regex for 'set $var' and 'for $var'
        const varRegex = /\{-\s*(?:set|for)\s+([\$a-zA-Z0-9_,\s]+)(?:=|:)/g;
        
        let match;
        while ((match = varRegex.exec(text)) !== null) {
            // Extract variable part, split by comma, trim
            const vars = match[1].split(',').map(v => v.trim()).filter(v => v.startsWith('$'));
            
            vars.forEach(v => {
                if (!existingLabels.has(v)) {
                    const item = new vscode.CompletionItem(v, vscode.CompletionItemKind.Variable);
                    item.detail = 'User Defined Variable';
                    items.push(item);
                    existingLabels.add(v);
                }
            });
        }

        return items;
    }

    /**
     * Scans the workspace for files in the `templates` directory.
     * Used for 'include' and 'extends' autocompletion.
     * Strips file extensions from the completion label.
     */
    private async getTemplateFileCompletions(): Promise<vscode.CompletionItem[]> {
        // Find all HTML and Markdown files in any 'templates' directory
        const files = await vscode.workspace.findFiles('**/templates/*.{html,md}');

        return files.map(file => {
            const name = path.parse(file.fsPath).name;
            
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.File);
            item.detail = "Template File";
            item.documentation = new vscode.MarkdownString(`Located at: \`${vscode.workspace.asRelativePath(file)}\``);
            
            return item;
        });
    }

    /**
     * Scans the workspace for shortcode files.
     */
    private async getShortcodeCompletions(): Promise<vscode.CompletionItem[]> {
        const files = await vscode.workspace.findFiles('**/shortcodes/*.{html,md}');
        const shortcodeNames = new Set<string>();

        files.forEach(file => {
            const name = path.basename(file.fsPath, path.extname(file.fsPath));
            shortcodeNames.add(name);
        });

        const completionItems: vscode.CompletionItem[] = [];
        shortcodeNames.forEach(name => {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Snippet);
            item.detail = `Allay Shortcode`;
            item.documentation = new vscode.MarkdownString(`Shortcode defined in **shortcodes/${name}.(md|html)**`);
            completionItems.push(item);
        });

        return completionItems;
    }

    /**
     * Provides field completions based on the parent object.
     */
    private async getFieldCompletions(parent: string, document: vscode.TextDocument): Promise<vscode.CompletionItem[]> {
        
        if (parent === 'site') {
            return [
                this.createFieldItem('param', 'Global configurations from allay.toml'),
                this.createFieldItem('pages', 'List of all markdown pages')
            ];
        }

        if (parent === 'site.param') {
            return await this.getAllayConfigKeys();
        }

        // Matches current page scope (empty string or ending in .page)
        if (parent === '' || parent.endsWith('page')) {
            return this.getMarkdownPageKeys(document);
        }

        return [];
    }

    /**
     * Scans `allay.toml` for global configuration keys under [Param].
     */
    private async getAllayConfigKeys(): Promise<vscode.CompletionItem[]> {
        const items: vscode.CompletionItem[] = [];
        const files = await vscode.workspace.findFiles('allay.toml', null, 1);
        
        if (files.length === 0) { return []; }

        try {
            const doc = await vscode.workspace.openTextDocument(files[0]);
            const text = doc.getText();
            
            // Simple regex to find the [Param] section content
            const paramBlockRegex = /\[Param\]([\s\S]*?)(?:\[|$)/i;
            const match = text.match(paramBlockRegex);
            
            if (match) {
                const paramContent = match[1];
                // Match "key =" pattern
                const keyRegex = /^\s*([a-zA-Z0-9_-]+)\s*=/gm;
                let keyMatch;
                while ((keyMatch = keyRegex.exec(paramContent)) !== null) {
                    items.push(this.createFieldItem(keyMatch[1], `Config from allay.toml`));
                }
            }
        } catch (e) {
            console.error('Error parsing allay.toml', e);
        }

        return items;
    }

    /**
     * Provides keys for the current markdown page.
     * Includes standard Front-matter fields and custom fields found in the file.
     */
    private getMarkdownPageKeys(document: vscode.TextDocument): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        const existingKeys = new Set<string>();

        // 1. Add Standard Front-matter Fields
        const standardFields = [
            'title', 'date', 'description', 'tags', 'template', 'url', 'head', 'content'
        ];

        standardFields.forEach(field => {
            items.push(this.createFieldItem(field, 'Standard Page Metadata'));
            existingKeys.add(field);
        });

        // 2. Scan Custom Fields in current file's Front-matter
        const text = document.getText();
        const yamlMatch = text.match(/^---\s*([\s\S]*?)\s*---/);
        
        if (yamlMatch) {
            const yamlContent = yamlMatch[1];
            // Match keys at the start of the line (e.g., "custom_field:")
            const keyRegex = /^\s*([a-zA-Z0-9_-]+):/gm;
            
            let keyMatch;
            while ((keyMatch = keyRegex.exec(yamlContent)) !== null) {
                const key = keyMatch[1];
                if (!existingKeys.has(key)) {
                    items.push(this.createFieldItem(key, 'Front-matter variable from current file'));
                }
            }
        }

        return items;
    }

    /**
     * Helper to create a completion item for an object field.
     */
    private createFieldItem(label: string, doc: string): vscode.CompletionItem {
        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Field);
        item.detail = doc;
        return item;
    }
}