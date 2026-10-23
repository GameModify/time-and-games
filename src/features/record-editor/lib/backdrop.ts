type PointerLike = Pick<PointerEvent, 'button' | 'target' | 'currentTarget'>;
// A drag that starts in the dialog must never dismiss it when released outside.
export function createBackdropDismiss(
  close: () => void,
  selection: () => { toString(): string } | null = () => window.getSelection(),
) {
  let beganOutside = false;
  return {
    down(event: PointerLike) {
      beganOutside = event.button === 0 && event.target === event.currentTarget;
    },
    up(event: PointerLike) {
      const dismiss =
        beganOutside &&
        event.button === 0 &&
        event.target === event.currentTarget &&
        !selection()?.toString();
      beganOutside = false;
      if (dismiss) close();
    },
    cancel() {
      beganOutside = false;
    },
  };
}
