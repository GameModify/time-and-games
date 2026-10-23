// A drag that starts in the dialog must never dismiss it when released outside.
export function createBackdropDismiss(close, selection = () => window.getSelection()) {
  let beganOutside = false;
  return {
    down(event) {
      beganOutside = event.button === 0 && event.target === event.currentTarget;
    },
    up(event) {
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
