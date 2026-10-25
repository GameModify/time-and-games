import type { SessionContext } from '../../../shared/api/contracts.ts';
import type { Classification } from '../../../shared/api/trackingContracts.ts';
export interface ClassificationScope {
  value: Classification['scope'];
  label: string;
  detail: string;
}
interface ScopeSpec {
  value: Classification['scope'];
  label: string;
  field: keyof SessionContext;
  detail(value: string): string;
}
const specs: ScopeSpec[] = [
  {
    value: 'video',
    label: 'Это видео',
    field: 'media_id',
    detail: () => 'Будущие просмотры только этого видео. Другие видео канала не изменятся.',
  },
  {
    value: 'channel',
    label: 'Весь канал YouTube',
    field: 'media_creator',
    detail: (value) =>
      'Будущие видео канала ' + value + '. Правила отдельных видео важнее правила канала.',
  },
  {
    value: 'site',
    label: 'Этот сайт',
    field: 'website',
    detail: (value) =>
      'Все прошлые и будущие записи сайта ' + value + '. Категория фоновых видео не изменится.',
  },
  {
    value: 'app',
    label: 'Это приложение',
    field: 'app',
    detail: (value) => 'Работа в активном окне ' + value + '.',
  },
];
const recordScope: ClassificationScope = {
  value: 'record',
  label: 'Только эта запись',
  detail: 'Изменится категория выбранного отрезка. Следующие занятия останутся без изменений.',
};
export function classificationScopes(context?: SessionContext): ClassificationScope[] {
  return [
    recordScope,
    ...specs.flatMap((spec) => {
      const value = context?.[spec.field];
      if (
        !value ||
        (spec.value === 'app' && value.toLowerCase() === 'chrome.exe') ||
        (spec.value === 'site' && context.media_id)
      )
        return [];
      return [{ value: spec.value, label: spec.label, detail: spec.detail(value) }];
    }),
  ];
}
