export type Outcome<Value, Failure> =
	| Readonly<{ok: true; value: Value}>
	| Readonly<{ok: false; error: Failure}>;

export function success<Value>(value: Value): Outcome<Value, never> {
	return Object.freeze({ok: true, value});
}

export function failure<Failure>(error: Failure): Outcome<never, Failure> {
	return Object.freeze({ok: false, error});
}

export function mapOutcome<Value, Next, Failure>(
	outcome: Outcome<Value, Failure>,
	map: (value: Value) => Next,
): Outcome<Next, Failure> {
	return outcome.ok ? success(map(outcome.value)) : outcome;
}

export function flatMapOutcome<Value, Next, Failure, NextFailure>(
	outcome: Outcome<Value, Failure>,
	map: (value: Value) => Outcome<Next, NextFailure>,
): Outcome<Next, Failure | NextFailure> {
	return outcome.ok ? map(outcome.value) : outcome;
}
