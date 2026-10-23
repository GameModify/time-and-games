import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Category } from '../src/shared/api/contracts.ts';
import type { CategoryWriteDto } from '../src/shared/api/inputContracts.ts';
import { ensure } from './http.ts';
const text = (value: string | undefined, max: number) => (value ?? '').trim().slice(0, max);
export const validColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
export function newCategory(db: DatabaseSync, input: CategoryWriteDto): Category {
  const name = text(input.name, 55),
    group = text(input.group_name, 40);
  ensure(name && group, 'Нужны название и группа категории');
  const order = Number(
    db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM categories').get()?.n,
  );
  return {
    id: randomUUID(),
    name,
    group_name: group,
    color: input.color && validColor(input.color) ? input.color : '#8e77ff',
    icon: text(input.icon, 30) || 'circle',
    is_work: Boolean(input.is_work),
    sort_order: order,
  };
}
export function categoryPatch(old: Category, input: CategoryWriteDto): Category {
  const next = {
    ...old,
    name: text(input.name ?? old.name, 55),
    group_name: text(input.group_name ?? old.group_name, 40),
    color: input.color && validColor(input.color) ? input.color : old.color,
    is_work: input.is_work ?? old.is_work,
  };
  ensure(next.name && next.group_name, 'Категория не может быть пустой');
  return next;
}
export function insertCategory(db: DatabaseSync, category: Category): void {
  db.prepare(
    'INSERT INTO categories (id,group_name,name,color,icon,is_work,sort_order) VALUES (@id,@group_name,@name,@color,@icon,@is_work,@sort_order)',
  ).run({ ...category, is_work: Number(category.is_work) });
}
