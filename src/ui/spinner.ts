import ora from 'ora';

let spinner: any = null;

export function showSpinner(text: string) {
  if (spinner) {
    spinner.text = text;
  } else {
    spinner = ora(text).start();
  }
}

export function stopSpinner() {
  if (spinner) {
    spinner.stop();
    spinner = null;
  }
}

export function succeedSpinner(text: string) {
  if (spinner) {
    spinner.succeed(text);
    spinner = null;
  }
}
