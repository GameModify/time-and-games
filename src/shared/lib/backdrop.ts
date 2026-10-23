type PointerLike = Pick<PointerEvent, 'button' | 'target' | 'currentTarget'>;
// A drag that starts in the dialog must never dismiss it when released outside.
interface SelectionText {
  toString(): string;
}
class BackdropDismiss {
  beganOutside = false;
  close: () => void;
  selection: () => SelectionText | null;
  constructor(close: () => void, selection: () => SelectionText | null) {
    this.close = close;
    this.selection = selection;
  }
  down = (event: PointerLike) => {
    this.beganOutside = event.button === 0 && event.target === event.currentTarget;
  };
  up = (event: PointerLike) => {
    const dismiss =
      this.beganOutside &&
      event.button === 0 &&
      event.target === event.currentTarget &&
      !this.selection()?.toString();
    this.beganOutside = false;
    if (dismiss) this.close();
  };
  cancel = () => {
    this.beganOutside = false;
  };
}
export function createBackdropDismiss(
  close: () => void,
  selection: () => SelectionText | null = () => window.getSelection(),
) {
  return new BackdropDismiss(close, selection);
}
