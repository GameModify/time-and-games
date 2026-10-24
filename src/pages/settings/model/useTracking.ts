import { onMounted, onUnmounted, reactive } from 'vue';
import { z } from 'zod';
import { api, readApi } from '../../../shared/api/client.ts';
import {
  trackingStateSchema,
  trackingInboxSchema,
  trackerRuleSchema,
} from '../../../shared/api/trackingContracts.ts';
import type {
  TrackingConnection,
  TrackingImport,
  TrackingIgnore,
  TrackingState,
  TrackingSettings,
  TrackingInboxItem,
  TrackerRule,
} from '../../../shared/api/trackingContracts.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
function emptyConnection(): TrackingConnection {
  return { enabled: false, endpoint: 'http://127.0.0.1:3536', auto_import: false, mappings: [] };
}
function connectionForm(settings: TrackingSettings): TrackingConnection {
  return {
    enabled: settings.enabled,
    endpoint: settings.endpoint,
    auto_import: settings.auto_import,
    mappings: settings.mappings.map((mapping) => ({ ...mapping })),
  };
}
function createState() {
  return reactive({
    state: null as TrackingState | null,
    items: Array<TrackingInboxItem>(),
    rules: [] as TrackerRule[],
    form: emptyConnection(),
    token: '',
    busy: false,
    error: '',
    notice: '',
  });
}
type TrackingModel = ReturnType<typeof createState>;
class TrackingActions {
  model: TrackingModel;
  constructor(model: TrackingModel) {
    this.model = model;
  }
  run = async (action: () => Promise<void>) => {
    if (this.model.busy) return;
    this.model.busy = true;
    this.model.error = '';
    this.model.notice = '';
    try {
      await action();
    } catch (error) {
      this.model.error = errorMessage(error);
    } finally {
      this.model.busy = false;
    }
  };
  refresh = async () => {
    this.model.state = await readApi('/tracking', trackingStateSchema);
    this.model.items = await readApi('/tracking/inbox', trackingInboxSchema.array());
  };
  load = async () => {
    await this.run(async () => {
      await this.refresh();
      if (this.model.state) this.model.form = connectionForm(this.model.state.settings);
      if (this.model.state?.connected)
        this.model.rules = await readApi('/tracking/rules', trackerRuleSchema.array());
    });
  };
  save = async () => {
    await this.run(async () => {
      await api('/tracking', 'PATCH', {
        ...this.model.form,
        token: this.model.token.trim() || undefined,
      });
      this.model.token = '';
      await this.refresh();
      if (this.model.state?.connected)
        this.model.rules = await readApi('/tracking/rules', trackerRuleSchema.array());
      this.model.notice = 'Настройки подключения сохранены';
    });
  };
  sync = async () => {
    await this.run(async () => {
      const result = await readApi(
        '/tracking/sync',
        z.object({ added: z.number(), state: trackingStateSchema }),
        'POST',
      );
      await this.refresh();
      this.model.notice = 'Добавлено записей: ' + String(result.added);
    });
  };
  importItem = async (input: TrackingImport) => {
    await this.run(async () => {
      await api('/tracking/import', 'POST', input);
      await this.refresh();
      this.model.notice = 'Интервал добавлен в таймлайн';
    });
  };
  ignore = async (input: TrackingIgnore) => {
    await this.run(async () => {
      await api('/tracking/ignore', 'POST', input);
      await this.refresh();
    });
  };
  pause = async () => {
    await this.run(async () => {
      await api('/tracking/pause', 'POST', { paused: !this.model.state?.status?.paused });
      await api('/tracking/sync', 'POST');
      await this.refresh();
    });
  };
  saveRules = async () => {
    await this.run(async () => {
      await api('/tracking/rules', 'PATCH', { rules: this.model.rules });
      this.model.notice = 'Правила сохранены. Они применяются к новым интервалам.';
    });
  };
  addRule = () => {
    this.model.rules.push({
      id: crypto.randomUUID(),
      name: 'Новое правило',
      enabled: true,
      field: 'app',
      operator: 'contains',
      value: '',
      activity: 'projects',
      priority: 100,
    });
  };
  addFolderRule = () => {
    this.model.rules.push({
      id: crypto.randomUUID(),
      name: 'Научные документы',
      enabled: true,
      field: 'resource_id',
      operator: 'within',
      value: '',
      activity: 'science',
      priority: 100,
    });
  };
  addMapping = () => {
    this.model.form.mappings.push({ activity: '', category_id: '' });
  };
}
export function useTracking() {
  const model = createState(),
    actions = new TrackingActions(model);
  onMounted(() => {
    void actions.load();
  });
  registerRefresh(model, actions);
  return { model, actions };
}
export type TrackingActionsView = Pick<
  TrackingActions,
  | 'addFolderRule'
  | 'load'
  | 'save'
  | 'sync'
  | 'importItem'
  | 'ignore'
  | 'pause'
  | 'saveRules'
  | 'addRule'
  | 'addMapping'
>;

function registerRefresh(model: TrackingModel, actions: TrackingActions): void {
  let timer: ReturnType<typeof setInterval> | undefined;
  onMounted(() => {
    timer = setInterval(() => {
      if (!model.busy)
        void actions.refresh().catch((error: unknown) => {
          model.error = errorMessage(error);
        });
    }, 5000);
  });
  onUnmounted(() => {
    clearInterval(timer);
  });
}
