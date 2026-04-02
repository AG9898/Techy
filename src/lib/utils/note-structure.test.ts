import { describe, expect, it } from 'vitest';
import { validateStandardNoteBody } from './note-structure.js';

describe('validateStandardNoteBody', () => {
	it('accepts the required section skeleton and normalizes recognized headings', () => {
		const result = validateStandardNoteBody(`# Topic Name

## overview
Short summary.

## description
Longer explanation.

## key concepts
- concept

## connections
- [[Techy]]

## resources
- [Docs](https://example.com)`);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error(result.error);
		}

		expect(result.normalizedBody).toContain('## Overview');
		expect(result.normalizedBody).toContain('## Description');
		expect(result.normalizedBody).toContain('## Key Concepts');
		expect(result.normalizedBody).toContain('## Connections');
		expect(result.normalizedBody).toContain('## Resources');
	});

	it('accepts approved optional sections only in the documented slot', () => {
		const result = validateStandardNoteBody(`# Topic Name

## Overview
Short summary.

## Description
Longer explanation.

## Key Concepts
- concept

## Use Cases
- shipping knowledge notes

## Tradeoffs
- more structure

## Version Notes
- only when warranted

## Connections
- [[Techy]]

## Resources
- [Docs](https://example.com)`);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error(result.error);
		}

		expect(result.topLevelSections).toEqual([
			'Overview',
			'Description',
			'Key Concepts',
			'Use Cases',
			'Tradeoffs',
			'Version Notes',
			'Connections',
			'Resources'
		]);
	});

	it('rejects deprecated default headings', () => {
		const result = validateStandardNoteBody(`# Topic Name

## Overview
Short summary.

## Description
Longer explanation.

## Key Concepts
- concept

## Current Status
- deprecated

## Connections
- [[Techy]]

## Resources
- [Docs](https://example.com)`);

		expect(result).toEqual({
			ok: false,
			error: 'Assistant note bodies cannot use deprecated heading "Current Status"'
		});
	});

	it('rejects approved headings at the wrong level', () => {
		const result = validateStandardNoteBody(`# Topic Name

### Overview
Short summary.

## Description
Longer explanation.

## Key Concepts
- concept

## Connections
- [[Techy]]

## Resources
- [Docs](https://example.com)`);

		expect(result).toEqual({
			ok: false,
			error: 'Assistant note bodies must use "Overview" as an h2 section heading.'
		});
	});

	it('rejects optional sections that appear after Connections', () => {
		const result = validateStandardNoteBody(`# Topic Name

## Overview
Short summary.

## Description
Longer explanation.

## Key Concepts
- concept

## Connections
- [[Techy]]

## Example
\`\`\`ts
console.log('too late');
\`\`\`

## Resources
- [Docs](https://example.com)`);

		expect(result).toEqual({
			ok: false,
			error: 'Assistant note bodies must end with Resources after Connections.'
		});
	});
});
