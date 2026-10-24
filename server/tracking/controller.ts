import { categoryLabels } from './labels.ts';
import { publishLabels } from './http.ts';
import { intervalCategory } from './bindings.ts';
import type { DatabaseSync } from 'node:sqlite';
import { trackingSettingsSchema } from '../../src/shared/api/trackingContracts.ts';
import type { TrackerStatus, TrackingState } from '../../src/shared/api/trackingContracts.ts';
import { configuration, inbox, saveConfiguration, storePage } from './storage.ts';
import { readPage, readStatus } from './http.ts';
import { importInterval } from './import.ts';
export class TrackingController {
  db: DatabaseSync;
  status: TrackerStatus | null = null;
  error = '';
  labelRevision = '';
  syncing: Promise<number> | null = null;
  constructor(db: DatabaseSync) {
    this.db = db;
  }
  state(): TrackingState {
    const config = configuration(this.db);
    return {
      settings: trackingSettingsSchema.parse({ ...config, token_set: Boolean(config.token) }),
      connected: Boolean(this.status),
      status: this.status,
      error: this.error,
      pending: inbox(this.db).length,
    };
  }
  sync(): Promise<number> {
    this.syncing ??= this.performSync().finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }
  async fetchPage(): Promise<boolean> {
    const config = configuration(this.db),
      page = await readPage(config),
      current = configuration(this.db);
    if (!current.enabled || current.token !== config.token || current.endpoint !== config.endpoint)
      return false;
    if (config.device_id && config.device_id !== page.device_id) {
      saveConfiguration(this.db, { ...config, cursor: 0, device_id: page.device_id });
      return true;
    }
    storePage(this.db, page);
    return page.has_more;
  }
  autoImport(): number {
    const config = configuration(this.db);
    if (!config.auto_import) return 0;
    let added = 0;
    for (const item of inbox(
      this.db,
      config.mappings.map((mapping) => mapping.activity),
    )) {
      const category = intervalCategory(this.db, item, config.mappings);
      if (category && this.db.prepare('SELECT 1 FROM categories WHERE id=?').get(category))
        added += importInterval(this.db, {
          id: item.id,
          device_id: item.device_id,
          category_id: category,
        });
    }
    return added;
  }
  async publishCategories(): Promise<void> {
    const labels = categoryLabels(this.db);
    const revision = labels
      .map((label) => [label.id, label.name, label.color, ...label.aliases].join(':'))
      .join('|');
    const targetRevision =
      configuration(this.db).endpoint + ':' + (this.status?.device_id ?? '') + ':' + revision;
    if (targetRevision === this.labelRevision) return;
    try {
      await publishLabels(configuration(this.db), labels);
      this.labelRevision = targetRevision;
    } catch {
      // Older tracker versions can continue importing without the optional category catalog.
    }
  }
  disabled(): boolean {
    if (configuration(this.db).enabled) return false;
    this.status = null;
    this.error = '';
    return true;
  }
  async performSync(): Promise<number> {
    if (this.disabled()) return 0;
    try {
      this.status = await readStatus(configuration(this.db));
      await this.publishCategories();
      for (let count = 0; count < 5; count++) {
        if (!(await this.fetchPage())) break;
      }
      if (this.disabled()) return 0;
      const added = this.autoImport();
      this.error = '';
      return added;
    } catch {
      this.status = null;
      this.error = 'Трекер недоступен или ключ неверен. Ручной учёт продолжает работать.';
      return 0;
    }
  }
}
