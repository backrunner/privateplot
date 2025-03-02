import {
	App,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import { load, dump } from "js-yaml";

// Remember to rename these classes and interfaces!

interface PrivateplotSettings {
	instanceHost: string;
	authToken: string;
	concurrency: number;
}

const DEFAULT_SETTINGS: PrivateplotSettings = {
	instanceHost: "",
	authToken: "",
	concurrency: 5,
};

interface FrontMatter {
	"privateplot-id"?: string;
	"privateplot-host"?: string;
	"privateplot-last-published"?: string;
	title?: string;
	summary?: string;
	slug?: string;
	draft?: boolean;
	[key: string]: unknown;
}

interface ArticleResponse {
	id: string;
	title: string;
	content: string;
	summary?: string;
	slug?: string;
}

/**
 * Normalizes a host string by removing protocol and trailing slashes
 * @param host - The host string to normalize
 * @returns The normalized host string
 */
function normalizeHost(host: string | undefined): string {
	if (!host) return '';
	return host.replace(/^(https?:\/\/)/, "").replace(/\/+$/, "");
}

/**
 * Ensures a URL has the correct protocol prefix
 */
function getBaseUrl(host: string): string {
	// Remove any existing protocol
	const cleanHost = host.replace(/^(https?:\/\/)/, "");

	// Add appropriate protocol
	const protocol =
		cleanHost === "localhost" || cleanHost.startsWith("localhost:")
			? "http"
			: "https";
	return `${protocol}://${cleanHost}`;
}

export default class PrivateplotPlugin extends Plugin {
	settings: PrivateplotSettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icon for quick publish
		this.addRibbonIcon(
			"paper-plane",
			"Publish to PrivatePlot",
			async (evt: MouseEvent) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile.extension === "md") {
					await this.publishArticle(activeFile);
				} else {
					new Notice("Please open a markdown file to publish");
				}
			}
		);

		// Add command to publish current file
		this.addCommand({
			id: "publish-to-privateplot",
			name: "Publish current file to PrivatePlot",
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile.extension === "md") {
					if (!checking) {
						this.publishArticle(activeFile);
					}
					return true;
				}
				return false;
			},
		});

		// Add command to delete article from PrivatePlot
		this.addCommand({
			id: "delete-from-privateplot",
			name: "Delete current file from PrivatePlot",
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile.extension === "md") {
					if (!checking) {
						this.deleteArticle(activeFile);
					}
					return true;
				}
				return false;
			},
		});

		// Add settings tab
		this.addSettingTab(new PrivateplotSettingTab(this.app, this));
	}

	onunload() {
		// Nothing to clean up
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Makes an API request to the PrivatePlot instance
	 */
	async apiRequest<T = unknown>(options: {
		method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
		body?: Record<string, unknown>;
		path: string;
		queryParams?: Record<string, string>;
	}): Promise<{
		success: boolean;
		data?: T;
		error?: string;
		status?: number;
	}> {
		if (!this.settings.instanceHost) {
			return {
				success: false,
				error: "No instance host configured. Please set it in the plugin settings.",
			};
		}

		if (!this.settings.authToken) {
			return {
				success: false,
				error: "No auth token configured. Please set it in the plugin settings.",
			};
		}

		const baseUrl = getBaseUrl(this.settings.instanceHost);

		// Build URL with query parameters
		let url = `${baseUrl}${options.path}`;
		if (
			options.queryParams &&
			Object.keys(options.queryParams).length > 0
		) {
			const params = new URLSearchParams();
			Object.entries(options.queryParams).forEach(([key, value]) => {
				params.append(key, value);
			});
			url += `?${params.toString()}`;
		}

		// Prepare headers
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"X-Internal-Auth-Token": this.settings.authToken,
		};

		// Prepare request options
		const requestOptions: RequestInit = {
			method: options.method || "GET",
			headers,
		};

		// Add body if provided
		if (options.body && options.method !== "GET") {
			requestOptions.body = JSON.stringify(options.body);
		}

		try {
			const response = await fetch(url, requestOptions);
			const status = response.status;

			if (!response.ok) {
				const errorText = await response.text();
				return {
					success: false,
					error: errorText,
					status,
				};
			}

			// Parse JSON response if content exists
			let data: T | undefined;
			const contentType = response.headers.get("content-type");
			if (contentType && contentType.includes("application/json")) {
				const text = await response.text();
				if (text) {
					data = JSON.parse(text) as T;
				}
			}

			return {
				success: true,
				data,
				status,
			};
		} catch (error) {
			return {
				success: false,
				error: `Network error: ${String(error)}`,
			};
		}
	}

	/**
	 * Publishes an article to PrivatePlot
	 */
	async publishArticle(file: TFile) {
		try {
			// Check settings
			if (!this.settings.instanceHost || !this.settings.authToken) {
				new Notice("Please configure PrivatePlot settings first");
				return;
			}

			// Read file content
			const content = await this.app.vault.read(file);
			const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

			// Get filename without extension as default title
			const fileName = file.basename;
			// Convert kebab-case or snake_case to Title Case
			const defaultTitle = fileName
				.replace(/[-_]/g, " ")
				.replace(/\b\w/g, (char: string) => char.toUpperCase());

			let frontMatter: FrontMatter = {};
			let markdownContent = content;
			let frontMatterIndent = "";

			if (frontMatterMatch) {
				try {
					frontMatter = load(frontMatterMatch[1]) as FrontMatter;
					markdownContent = content
						.slice(frontMatterMatch[0].length)
						.trim();

					const indentMatch = frontMatterMatch[1].match(/^( +)/m);
					if (indentMatch) {
						frontMatterIndent = indentMatch[1];
					}
				} catch (e) {
					new Notice(`Error parsing frontmatter: ${e}`);
					return;
				}
			}

			// Check if file is a draft
			if (frontMatter.draft === true) {
				const confirmDraft = await this.confirmPublishDraft();
				if (!confirmDraft) {
					new Notice("Publishing cancelled");
					return;
				}
			}

			// Show publishing notice
			new Notice(`Publishing ${frontMatter.title || defaultTitle}...`);

			try {
				let result;

				// Update existing article
				if (
					frontMatter["privateplot-id"] &&
					normalizeHost(frontMatter["privateplot-host"]) === normalizeHost(this.settings.instanceHost)
				) {
					result = await this.apiRequest<ArticleResponse>({
						method: "PATCH",
						path: "/api/internal/article",
						queryParams: { id: frontMatter["privateplot-id"] },
						body: {
							content: markdownContent,
							title: frontMatter.title || defaultTitle,
							summary: frontMatter.summary,
						},
					});
				}
				// Create new article
				else {
					result = await this.apiRequest<ArticleResponse>({
						method: "PUT",
						path: "/api/internal/article",
						body: {
							content: markdownContent,
							title: frontMatter.title || defaultTitle,
							summary: frontMatter.summary,
							slug: frontMatter.slug,
						},
					});

					if (result.success && result.data) {
						frontMatter = {
							...frontMatter,
							"privateplot-id": result.data.id,
							"privateplot-host": normalizeHost(this.settings.instanceHost),
						};
					}
				}

				if (!result.success) {
					new Notice(`Failed to publish: ${result.error}`);
					return;
				}

				// Update publish time
				frontMatter["privateplot-last-published"] =
					new Date().toISOString();

				// Update frontmatter in file
				let yamlContent = dump(frontMatter);

				if (frontMatterIndent) {
					yamlContent = yamlContent
						.split("\n")
						.map((line, index) => {
							if (
								line &&
								index < yamlContent.split("\n").length - 1
							) {
								return frontMatterIndent + line;
							}
							return line;
						})
						.join("\n");
				}

				let updatedContent;
				if (!frontMatterMatch) {
					updatedContent = `---\n${yamlContent}---\n\n${markdownContent}`;
				} else {
					updatedContent = content.replace(
						/^---\n[\s\S]*?\n---/,
						`---\n${yamlContent}---`
					);
				}

				await this.app.vault.modify(file, updatedContent);
				new Notice(
					`Successfully published ${
						frontMatter.title || defaultTitle
					}`
				);
			} catch (error) {
				new Notice(`Error publishing: ${error}`);
			}
		} catch (error) {
			new Notice(`Error: ${error}`);
		}
	}

	/**
	 * Deletes an article from PrivatePlot
	 */
	async deleteArticle(file: TFile) {
		try {
			// Check settings
			if (!this.settings.instanceHost || !this.settings.authToken) {
				new Notice("Please configure PrivatePlot settings first");
				return;
			}

			// Read file content
			const content = await this.app.vault.read(file);
			const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

			if (!frontMatterMatch) {
				new Notice("No frontmatter found in the file");
				return;
			}

			let frontMatter: FrontMatter;
			try {
				frontMatter = load(frontMatterMatch[1]) as FrontMatter;
			} catch (e) {
				new Notice(`Error parsing frontmatter: ${e}`);
				return;
			}

			if (!frontMatter["privateplot-id"]) {
				new Notice(
					"No article ID found in frontmatter. The file might not have been published yet"
				);
				return;
			}

			if (
				normalizeHost(frontMatter["privateplot-host"]) !== normalizeHost(this.settings.instanceHost)
			) {
				new Notice(
					"Article was published to a different host. Please use the correct host to delete it"
				);
				return;
			}

			// Ask for confirmation
			const confirmed = await this.confirmDelete(
				frontMatter.title || file.basename
			);
			if (!confirmed) {
				new Notice("Delete operation cancelled");
				return;
			}

			// Show deleting notice
			new Notice(`Deleting ${frontMatter.title || file.basename}...`);

			try {
				const result = await this.apiRequest({
					method: "DELETE",
					path: "/api/internal/article",
					queryParams: { id: frontMatter["privateplot-id"] },
				});

				if (!result.success) {
					if (result.status === 404) {
						new Notice(
							"Article not found on server. It might have been deleted already"
						);
					} else {
						new Notice(`Failed to delete article: ${result.error}`);
					}
					return;
				}

				new Notice("Article deleted successfully");
			} catch (error) {
				new Notice(`Error deleting article: ${error}`);
			}
		} catch (error) {
			new Notice(`Error: ${error}`);
		}
	}

	/**
	 * Shows a confirmation dialog for deleting an article
	 */
	async confirmDelete(title: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new ConfirmModal(
				this.app,
				`Are you sure you want to delete "${title}"?`,
				"This action cannot be undone.",
				"Delete",
				(result) => resolve(result)
			);
			modal.open();
		});
	}

	/**
	 * Shows a confirmation dialog for publishing a draft
	 */
	async confirmPublishDraft(): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new ConfirmModal(
				this.app,
				"This file is marked as a draft",
				"Do you still want to publish it?",
				"Publish",
				(result) => resolve(result)
			);
			modal.open();
		});
	}
}

class ConfirmModal extends Modal {
	private result: (value: boolean) => void;
	private title: string;
	private message: string;
	private confirmText: string;

	constructor(
		app: App,
		title: string,
		message: string,
		confirmText: string,
		result: (value: boolean) => void
	) {
		super(app);
		this.title = title;
		this.message = message;
		this.confirmText = confirmText;
		this.result = result;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h2", { text: this.title });
		contentEl.createEl("p", { text: this.message });

		const buttonContainer = contentEl.createDiv({
			cls: "modal-button-container",
		});

		buttonContainer
			.createEl("button", { text: "Cancel" })
			.addEventListener("click", () => {
				this.result(false);
				this.close();
			});

		buttonContainer
			.createEl("button", {
				cls: "mod-warning",
				text: this.confirmText,
			})
			.addEventListener("click", () => {
				this.result(true);
				this.close();
			});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class PrivateplotSettingTab extends PluginSettingTab {
	plugin: PrivateplotPlugin;

	constructor(app: App, plugin: PrivateplotPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "PrivatePlot Settings" });

		new Setting(containerEl)
			.setName("Instance Host")
			.setDesc(
				'The URL of your PrivatePlot instance (e.g. "example.com" or "localhost:3000")'
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter your PrivatePlot host")
					.setValue(this.plugin.settings.instanceHost)
					.onChange(async (value) => {
						this.plugin.settings.instanceHost = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Auth Token")
			.setDesc("Your PrivatePlot authentication token")
			.addText((text) =>
				text
					.setPlaceholder("Enter your auth token")
					.setValue(this.plugin.settings.authToken)
					.onChange(async (value) => {
						this.plugin.settings.authToken = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Concurrency")
			.setDesc(
				"Maximum number of concurrent requests (for bulk operations)"
			)
			.addSlider((slider) =>
				slider
					.setLimits(1, 20, 1)
					.setValue(this.plugin.settings.concurrency)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.concurrency = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
