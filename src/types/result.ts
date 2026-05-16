export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}

export function unwrapOr<T, E>(
  result: Result<T, E>,
  defaultValue: T
): T {
  return result.ok ? result.value : defaultValue;
}

/** Wraps a promise into a Result. Catches any rejection as E. */
export async function fromPromise<T, E = Error>(
  promise: Promise<T>,
  mapError: (reason: unknown) => E
): Promise<Result<T, E>> {
  try {
    return ok(await promise);
  } catch (reason) {
    return err(mapError(reason));
  }
}

/** Wraps a sync function into a Result. */
export function tryCatch<T, E = Error>(
  fn: () => T,
  mapError: (reason: unknown) => E
): Result<T, E> {
  try {
    return ok(fn());
  } catch (reason) {
    return err(mapError(reason));
  }
}
