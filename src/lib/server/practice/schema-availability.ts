const missingTableCode = '42P01';

function errorFields(err: unknown): { code?: unknown; message?: string; cause?: unknown } {
	if (!err || typeof err !== 'object') return {};
	const record = err as Record<string, unknown>;
	return {
		code: record.code,
		message: typeof record.message === 'string' ? record.message : undefined,
		cause: record.cause
	};
}

export function isPracticeSchemaUnavailableError(err: unknown): boolean {
	const { code, message, cause } = errorFields(err);

	if (code === missingTableCode) return true;
	if (message?.includes('relation "practice_problems" does not exist')) return true;
	if (message?.includes('relation "practice_progress" does not exist')) return true;
	if (message?.includes('Failed query:') && message.includes('"practice_problems"')) return true;
	if (message?.includes('Failed query:') && message.includes('"practice_progress"')) return true;

	return cause ? isPracticeSchemaUnavailableError(cause) : false;
}

export function practiceSchemaUnavailableMessage(): string {
	return 'Practice storage is not available yet. Run the latest database migrations and try again.';
}
