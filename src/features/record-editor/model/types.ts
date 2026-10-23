import type { Ref } from 'vue';
import type {
  Category,
  Game,
  Session,
  Backup,
  GameStatus,
  NumericInput,
} from '../../../shared/api/contracts.ts';
export type RecordResource = 'sessions' | 'games' | 'categories';
export type ModalKind = 'session' | 'game' | 'category' | 'steam' | 'backup' | 'delete' | 'reset';
export interface EditorDependencies {
  categories: Ref<Category[]>;
  groupNames: Ref<string[]>;
  games: Ref<Game[]>;
  sessions: Ref<Session[]>;
  now: Ref<number>;
  date: Ref<string>;
  selected: Ref<string[]>;
  error: Ref<string>;
  flash: (message: string) => void;
  load: () => Promise<void>;
  category: (id: string) => Pick<Category, 'name' | 'color' | 'group_name'>;
  gameName: (id?: string | null) => string;
}
export interface EditorForm extends Partial<Omit<Game, 'rating'>>, Partial<Category> {
  name: string;
  poster: string;
  status: GameStatus;
  rating: number | null;
  review: string;
  started_at: string;
  completed_at: string;
  title: string;
  note: string;
  group_name: string;
  color: string;
  is_work: boolean;
  category_ids: string[];
  game_id: string | null;
  start: string;
  end: string;
  playtime_hours: NumericInput;
  playtime_remainder: NumericInput;
  duration_hours: NumericInput;
  duration_minutes: NumericInput;
  confirmation: string;
  resource: RecordResource;
  data: Backup;
}
export type EditorValues = Omit<Partial<EditorForm>, 'started_at' | 'completed_at'> & {
  started_at?: string | null;
  completed_at?: string | null;
};
const emptyEditorFormDefaults: EditorForm = {
  name: '',
  poster: '',
  status: 'backlog',
  rating: null,
  review: '',
  started_at: '',
  completed_at: '',
  title: '',
  note: '',
  group_name: '',
  color: '#8e77ff',
  is_work: false,
  category_ids: [],
  game_id: '',
  start: '',
  end: '',
  playtime_hours: '',
  playtime_remainder: '',
  duration_hours: '',
  duration_minutes: '',
  confirmation: '',
  resource: 'sessions',
  data: {
    format: 'time-and-games-backup',
    version: 1,
    exported_at: '',
    categories: [],
    games: [],
    sessions: [],
    media: [],
  },
};
export function emptyEditorForm(): EditorForm {
  return structuredClone(emptyEditorFormDefaults);
}
