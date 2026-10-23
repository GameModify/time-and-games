export function clock(value) {
  return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function shortDate(d) {
  return new Date(`${d}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function weekday(d) {
  return new Date(`${d}T12:00:00`).toLocaleDateString('ru-RU', { weekday: 'short' });
}

export function posterFailed(e) {
  e.target.style.display = 'none';
}
