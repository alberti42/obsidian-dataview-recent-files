// obsidian-augmentations.d.ts

// Import Obsidian base module for extension
import 'obsidian';

import DataviewPlugin from 'dataview_types/main';
import { DataviewApi } from 'dataview_types';

// Augmenting the Obsidian module
declare module 'obsidian' {
    // Update the PluginManager interface to use PluginManifest
    interface PluginManager {
        plugins: { [id: string]: any };
        enabledPlugins: Set<string>;
        manifests: { [id: string]: PluginManifest };
        getPlugin(pluginId: string): Plugin | undefined;
        enablePlugin(pluginId: string): Promise<void>;
        disablePlugin(pluginId: string): Promise<void>;
        enablePluginAndSave(pluginId: string): Promise<void>;
        disablePluginAndSave(pluginId: string): Promise<void>;
        // installPlugin(id: string, url: string, options?: any): Promise<void>;
        uninstallPlugin(pluginId: string): Promise<void>;
        loadPlugin(pluginId: string): Promise<void>;
        unloadPlugin(pluginId: string): Promise<void>;
        isEnabled(pluginId: string): boolean;
        initialize(): void;
        checkForUpdates(): void;
        checkForDeprecations(): void;
        getPluginFolder(): string;
        isDeprecated(pluginId: string): boolean;
        loadManifest(pluginId: string): void;
        loadManifests(): void;
        saveConfig(): void;
        setEnable(pluginId: string, enable: boolean): void;
    }

    // Define the FullIndex interface
    interface FullIndex {
        app: App;
        // csv: CsvCache;
        // etags: ValueCaseInsensitiveIndexMap;
        // importer: FileImporter;
        indexVersion: string;
        initialized: boolean;
        // links: IndexMap;
        metadataCache: MetadataCache; // Assuming MetadataCache is defined elsewhere
        onChange: Function; // Define function signature if more details are known
        // pages: Map<string, PageMetadata>; // Specify the key type if different
        // persister: LocalStorageCache;
        // prefix: PrefixIndex;
        revision: number;
        // starred: StarredCache;
        // tags: ValueCaseInsensitiveIndexMap;
        vault: Vault;
    }

    interface Chooser<T> {
        values: T[];
        selectedItem: number;
        useSelectedItem: (event?: KeyboardEvent) => void;
        setSuggestions: (items: T[]) => void;
    }

    interface FuzzySuggestModal<T> {
        chooser: Chooser<T>;
        containerEl: HTMLDivElement;
        selectedItem: number;
        suggestions: HTMLDivElement[];
        moveDown: () => void;
        moveUp: () => void;
        setSelectedItem: (index: number, scroll?: boolean) => void;
        setSuggestions: (items: T[]) => void;
        useSelectedItem: (event?: KeyboardEvent) => void;
    }

    interface App {
        appId?: string;
        plugins: {
            isEnabled(str: string): unknown;
            getPlugin(str: string): DataviewPlugin;
            enabledPlugins: Set<string>;
            plugins: {
                dataview?: {
                    api: DataviewApi;
                };
            };
        };
    }
}
